import { makePromise, PromiseType } from "./utils/async";
import { ConfigsType, DataType } from "./utils/ejson";
import { createProxy } from "./utils/proxy";
import {
  MessageMapType,
  MessageType,
  MessageTypeEnum,
  encodeData,
  decodeData,
  log,
} from "./utils/self/message";
import { ResolveType } from "./utils/ts";

export type OptionsType = {
  configs?: ConfigsType;
  logging?: boolean;
  onBeforeJsonRequest?: () => unknown;
  onJsonRequest(
    message: MessageMapType[MessageTypeEnum.JsonRequest],
    promise: Promise<DataType>
  ): Promise<unknown>;
  onSessionRequest(
    message: MessageMapType[MessageTypeEnum.SessionRequest],
    promise: Promise<string | undefined>
  ): Promise<unknown>;
  onStreamRequest(
    message: MessageMapType[MessageTypeEnum.StreamRequest],
    stream: ReadableStream | Blob
  ): unknown;
};

export class ClientController<TApi> {
  private messageCounterId = 0;
  readonly api: ResolveType<TApi>;
  protected jsonRequests = new Map<
    number,
    { path: string; args: DataType; promise: PromiseType<DataType> }
  >();

  protected sessionRequests = new Map<
    number,
    { promise: PromiseType<string | undefined> }
  >();
  constructor(readonly options: OptionsType) {
    this.api = createProxy(async (path, args) => {
      return await this.request({
        id: this.nextMessageId(),
        type: MessageTypeEnum.JsonRequest,
        data: {
          args: args,
          path: path,
        },
      });
    }) as ResolveType<TApi>;
  }

  cancelRequests(error: Error) {
    for (const [, { promise }] of this.jsonRequests) promise.reject(error);
    for (const [, { promise }] of this.sessionRequests) promise.reject(error);
  }

  async sesionRequest(message: MessageMapType[MessageTypeEnum.SessionRequest]) {
    if (this.options.logging) log("client", "sent", message);
    const promise = makePromise<string | undefined>();
    this.sessionRequests.set(message.id, { promise });
    try {
      this.options
        .onSessionRequest(message, promise)
        .catch((error) => promise.reject(error));
      return await promise;
    } finally {
      this.sessionRequests.delete(message.id);
    }
  }

  async request(message: MessageMapType[MessageTypeEnum.JsonRequest]) {
    await this.options.onBeforeJsonRequest?.();
    if (this.options.logging) log("client", "sent", message);
    const args = encodeData(message.data.args, this.options.configs);

    try {
      const promise = makePromise<DataType>();
      this.jsonRequests.set(message.id, {
        args,
        path: message.data.path,
        promise,
      });
      this.options
        .onJsonRequest(message, promise)
        .catch((error) => promise.reject(error));
      const encodedResponse = await promise;
      const response = decodeData({
        data: encodedResponse,
        configs: this.options.configs,
        onCallback: () => {
          throw new Error("Not implemented");
        },
        onStream: () => {
          throw new Error("Not implemented");
        },
      });
      if (!Array.isArray(response))
        throw new Error(`Response is not array: ${JSON.stringify(response)}`);
      const [error, data] = response;
      if (error) throw error;
      return data;
    } finally {
      this.jsonRequests.delete(message.id);
    }
  }

  nextMessageId() {
    return ++this.messageCounterId;
  }

  async processMessage(msg: MessageType) {
    if (this.options.logging) log("client", "received", msg);
    if (msg.type === MessageTypeEnum.JsonResponseCallback) {
      const jsonRequest = this.jsonRequests.get(msg.id);
      if (jsonRequest) {
        await jsonRequest.args.callbacks[msg.data.index](...msg.data.args);
      }
    } else if (msg.type === MessageTypeEnum.StreamRequest) {
      const jsonRequest = this.jsonRequests.get(msg.id);
      if (jsonRequest) {
        const stream = jsonRequest.args.streams[msg.data.index];
        this.options.onStreamRequest(msg, stream);
      }
    } else if (msg.type === MessageTypeEnum.SessionResponse) {
      const sessionRequest = this.sessionRequests.get(msg.id);
      if (sessionRequest) sessionRequest.promise.resolve(msg.data);
    } else if (msg.type === MessageTypeEnum.JsonResponse) {
      const jsonRequest = this.jsonRequests.get(msg.id);
      if (jsonRequest)
        jsonRequest.promise.resolve({
          bufferTypes: [],
          buffers: [],
          callbacks: [],
          streams: [],
          object: msg.data as unknown,
        });
    } else {
      throw new Error(`Invalid message type: ${msg.type}`);
    }
  }
}
