import { ConfigsType, DataType } from "./utils/ejson";
import { getObjectValue, isClass, merge } from "./utils/object";
import { parsePath } from "./utils/proxy";
import {
  MessageType,
  MessageTypeEnum,
  StreamMapType,
  encodeData,
  decodeData,
  MessageMapType,
  log,
} from "./utils/self/message";
import { makeReadableStream, web } from "./utils/stream";
import { DeepPartial, DeepReadonly } from "ts-essentials";

type OnJsonRequestType = (constructor: {
  new (...args: unknown[]): unknown;
}) => unknown | Promise<unknown>;

export type OptionsType<TApi> = {
  configs?: ConfigsType;
  api: TApi | (() => Promise<TApi> | TApi);
  logging?: boolean;
};

function isApiCallback<TApi>(api: unknown): api is () => Promise<TApi> {
  return typeof api === "function" && !isClass(api);
}

export class ServerController<TApi, TClientKey> {
  protected streams: StreamMapType<TClientKey> = new Map();
  constructor(readonly options: DeepReadonly<OptionsType<TApi>>) {}
  updateOptions(options: DeepPartial<OptionsType<TApi>>) {
    merge(this.options, options);
  }
  async closeStreams(clientKey: TClientKey) {
    const streams = this.streams.get(clientKey);
    if (streams)
      for (const [, [stream]] of streams) {
        await stream.cancel();
      }
  }
  async callApi(path: string, args: unknown[], onInstance?: OnJsonRequestType) {
    let data: unknown;
    let error: unknown = null;
    try {
      if (!Array.isArray(args)) throw new Error(`Arguments are not array`);
      const [classLevels, method] = parsePath(path);
      const api = (
        isApiCallback(this.options.api)
          ? await this.options.api()
          : this.options.api
      ) as Record<string, unknown>;
      const Constructor = getObjectValue(api, classLevels);

      if (typeof Constructor !== "function")
        throw new Error(`Class constructor not found: ${path}`);
      const instance = onInstance
        ? await onInstance(Constructor)
        : new Constructor();
      if (!instance) throw new Error(`Instance is empty: ${instance}`);
      if (typeof instance[method] !== "function")
        throw new Error(`Class method not found: ${method}`);
      data = await instance[method](...args);
    } catch (_error) {
      error = _error;
    }
    return encodeData(
      error ? [error, null] : [null, data],
      this.options.configs
    ) as DataType<[unknown, unknown]>;
  }
  getStream(key: TClientKey) {
    const stream = this.streams.get(key);
    if (!stream) throw new Error(`Client streams not found: ${key}`);
    return stream;
  }
  getStreamMessage(key: TClientKey, id: number) {
    const stream = this.getStream(key);
    const streamMsg = stream.get(id);
    if (!streamMsg) throw new Error(`Client stream message not found: ${id}`);
    return streamMsg;
  }
  async processServerMessage(options: {
    clientKey?: TClientKey;
    message: MessageType;
    onSend: (message: MessageType) => void;
    onSessionRequest?: (
      message: MessageMapType[MessageTypeEnum.SessionRequest]
    ) => string | undefined;
    onJsonRequest?: OnJsonRequestType;
  }) {
    const msg = options.message;
    const clientKey = options.clientKey;
    const send = (message: MessageType) => {
      if (this.options.logging) log("server", "sent", message);
      options.onSend(message);
    };

    if (this.options.logging) log("server", "received", msg);

    if (clientKey)
      if (
        msg.type === MessageTypeEnum.JsonRequest &&
        !this.streams.has(clientKey)
      ) {
        this.streams.set(clientKey, new Map());
      }

    if (msg.type === MessageTypeEnum.SessionRequest) {
      if (!options.onSessionRequest)
        throw new Error(`Session request not implemented`);
      const result = options.onSessionRequest(msg);
      send({
        id: msg.id,
        type: MessageTypeEnum.SessionResponse,
        data: result,
      });
    } else if (msg.type === MessageTypeEnum.JsonRequest) {
      const args = decodeData({
        data: {
          bufferTypes: [],
          buffers: [],
          callbacks: [],
          object: msg.data.args,
          streams: [],
        },
        configs: this.options.configs,
        onCallback: (index, args) =>
          send({
            id: msg.id,
            type: MessageTypeEnum.JsonResponseCallback,
            data: { index, args },
          }),
        onStream: (index) => {
          if (!clientKey) throw new Error(`'clientKey' not implemented`);
          const stream = makeReadableStream();
          this.getStream(clientKey).set(msg.id, stream);
          send({
            id: msg.id,
            type: MessageTypeEnum.StreamRequest,
            data: { index },
          });
          return stream[0];
        },
      }) as unknown[];
      const response = await this.callApi(
        msg.data.path,
        args,
        options.onJsonRequest
      );
      send({
        id: msg.id,
        type: MessageTypeEnum.JsonResponse,
        data: response.object,
      });
    } else if (msg.type === MessageTypeEnum.StreamResponseChunk) {
      if (!clientKey) throw new Error(`'clientKey' not implemented`);
      const stream = this.getStreamMessage(clientKey, msg.id);
      const [, controller] = stream;
      controller.enqueue(msg.data);
    } else if (msg.type === MessageTypeEnum.StreamResponseEnd) {
      if (!clientKey) throw new Error(`'clientKey' not implemented`);
      const stream = this.getStreamMessage(clientKey, msg.id);
      const [, controller] = stream;
      controller.close();
    } else if (msg.type === MessageTypeEnum.StreamResponseData) {
      if (!clientKey) throw new Error(`'clientKey' not implemented`);
      const stream = this.getStreamMessage(clientKey, msg.id);
      const [, controller] = stream;
      await msg.data.pipeTo(
        new web.WritableStream({
          write(chunk) {
            controller.enqueue(chunk);
          },
          close() {
            controller.close();
          },
          abort(e) {
            controller.error(new Error(`Aborted: ${e}`));
          },
        })
      );
    }
  }
}
