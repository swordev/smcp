import { ClientController } from "./ClientController";
import { ConfigsType } from "./utils/ejson";
import { MessageTypeEnum, parse, serialize } from "./utils/self/message";
import { web } from "./utils/stream";
import { URL } from "./utils/url";
import { WebSocketController } from "./utils/ws";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";

export type ClientOptionsType = {
  configs?: ConfigsType;
  session?: string;
  logging?: boolean;
  connectionToken?: string;
  url?:
    | string
    | {
        protocol?: string;
        hostname?: string;
        port?: number;
        pathname?: string;
      };
};

export class Client<TApi> {
  readonly ws: WebSocketController;
  readonly controller: ClientController<
    TApi extends () => infer TApi ? TApi : TApi
  >;
  constructor(readonly options: ClientOptionsType) {
    this.controller = new ClientController({
      configs: this.options.configs,
      logging: this.options.logging,
      onBeforeJsonRequest: async () =>
        !this.ws.isOpen() && (await this.ws.open()),
      onSessionRequest: async (message) =>
        this.ws.socket.send(serialize(message)),
      onJsonRequest: async (message) => this.ws.socket.send(serialize(message)),
      onStreamRequest: async (message, object) => {
        const stream =
          object instanceof web.ReadableStream
            ? object
            : (object.stream() as unknown as ReadableStream);
        const reader = stream.getReader();
        for (;;) {
          const chunk = await reader.read();
          this.ws.socket.send(
            serialize(
              !chunk.done
                ? {
                    id: message.id,
                    type: MessageTypeEnum.StreamResponseChunk,
                    data: chunk.value,
                  }
                : {
                    id: message.id,
                    type: MessageTypeEnum.StreamResponseEnd,
                    data: undefined,
                  }
            )
          );
          if (chunk.done) break;
        }
      },
    });
    this.ws = new WebSocketController({
      url: this.getUrl().toString(),
      onOpen: async () => {
        const session = await this.controller.sesionRequest({
          id: this.controller.nextMessageId(),
          type: MessageTypeEnum.SessionRequest,
          data: this.options.session ?? this.readSession(),
        });
        if (session) this.writeSession(session);
      },
      onError: async (error) => this.controller.cancelRequests(error),
      onClose: async (event) =>
        this.controller.cancelRequests(new Error(`Reason: ${event.code}`)),
      onMessage: async (event) => {
        const message = parse(event.data as Uint8Array);
        await this.controller.processMessage(message);
      },
    });
  }
  get api() {
    return this.controller.api;
  }
  readSession() {
    const cookie = parseCookie(globalThis.document?.cookie ?? "");
    return cookie["session"];
  }
  writeSession(value: string) {
    if (globalThis.document)
      document.cookie = serializeCookie("session", value, {
        path: "/",
      });
  }
  getUrl() {
    const input = this.options.url;
    let url: URL;
    if (typeof input === "string") {
      url = new URL(input);
    } else {
      url = new URL(globalThis.location?.origin ?? "http://127.0.0.1");
      if (url.protocol === "http:") {
        url.protocol = "ws:";
      } else if (url.protocol === "https:") {
        url.protocol = "wss:";
      }
      if (input) {
        if (typeof input.protocol !== "undefined")
          url.protocol = input.protocol;
        if (typeof input.hostname !== "undefined")
          url.hostname = input.hostname;
        if (typeof input.port !== "undefined") url.port = input.port.toString();
        if (typeof input.pathname !== "undefined")
          url.pathname = input.pathname;
      }
    }
    if (this.options.connectionToken)
      url.searchParams.set("x-smcp-token", this.options.connectionToken);
    return url;
  }
}
