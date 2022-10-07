import { ServerController } from "./ServerController";
import {
  SessionManager,
  ConstructorOptionsType as SessionManagerOptionsType,
} from "./SessionManager";
import { makePromise } from "./utils/async";
import { ConfigsType } from "./utils/ejson";
import { fetchPayload, processStaticFileRequest } from "./utils/http";
import { DependencyContainer } from "./utils/ioc";
import { merge, StrictMap } from "./utils/object";
import { log, MessageTypeEnum, parse, serialize } from "./utils/self/message";
import { ConstructorType } from "./utils/ts";
import { URL } from "./utils/url";
import { createServer, IncomingMessage, ServerResponse } from "http";
import type { Socket } from "net";
import { DeepPartial, DeepReadonly } from "ts-essentials";
import { WebSocketServer, WebSocket } from "ws";

export type OptionsType<
  TApi,
  TClientSession,
  TContainer extends DependencyContainer | undefined = undefined
> = {
  api: TApi | (() => Promise<TApi> | TApi);
  configs?: ConfigsType;
  logging?: boolean;
  publicPath?: string;
  connectionTokens?: string[];
  requireConnectionToken?: boolean;
  port?: number;
  address?: string;
  protocols?: { http: boolean; ws: boolean };
  sessionManager?: SessionManagerOptionsType<TClientSession>;
  container?: TContainer;
  onJsonRequest?: (data: {
    constructor: { new (...args: unknown[]): unknown };
    session: TClientSession;
    container: TContainer;
  }) => unknown | Promise<unknown>;
};

export class Server<
  TApi,
  TClientSession,
  TContainer extends DependencyContainer | undefined = undefined
> {
  readonly controller: ServerController<TApi, typeof WebSocket>;
  readonly http: ReturnType<typeof createServer>;
  readonly ws: WebSocketServer | undefined;
  readonly sessionManager: SessionManager<TClientSession> | undefined;

  constructor(
    readonly options: DeepReadonly<
      OptionsType<TApi, TClientSession, TContainer>
    >
  ) {
    this.controller = new ServerController({
      logging: this.options.logging,
      api: this.options.api,
      configs: this.options.configs,
    });
    this.http = createServer();
    if (this.options.protocols?.ws ?? true)
      this.ws = new WebSocketServer({
        noServer: true,
        verifyClient: (info, next) => {
          if (
            this.options.requireConnectionToken ||
            this.options.connectionTokens
          ) {
            const error = this.getConnectionTokenError(
              new URL(info.req.url as string, "file://").searchParams.get(
                "x-smcp-token"
              )
            );
            if (error) return next(false, 401, error.message);
          }
          next(true);
        },
      });
    if (this.options.sessionManager) {
      this.sessionManager = new SessionManager(this.options.sessionManager);
      if (this.sessionManager.options.gargabeCollector.rutineInterval)
        this.sessionManager.startGcRutine();
    }
  }

  updateOptions(
    options: DeepPartial<OptionsType<TApi, TClientSession, TContainer>>
  ) {
    merge(this.options, options);
    this.controller.updateOptions({
      logging: options.logging,
      configs: options.configs,
      api: options.api,
    });
    if (options.sessionManager)
      this.sessionManager?.updateOptions(options.sessionManager);
  }

  protected getConnectionTokenError(token: unknown) {
    const error = (reason: string) => {
      if (this.options.logging)
        log("server", "sent", `disconnection (${reason})`);
      return new Error(reason);
    };
    if (typeof token !== "string") return error("token is required");
    if (!token.length) return error("token is empty");
    if (!this.options.connectionTokens?.includes(token))
      return error("invalid token");
  }

  protected async onJsonRequest(
    constructor: ConstructorType,
    session: string | undefined
  ) {
    let container: TContainer | undefined;
    if (this.options.container) {
      container =
        this.options.container.createChildContainer() as NonNullable<TContainer>;
      container.register(
        DependencyContainer as { new (): DependencyContainer },
        {
          useValue: container,
        }
      );
    }
    let sessionDataObject!: TClientSession;
    if (this.sessionManager) {
      if (!session) throw new Error(`Session is undefined`);
      const sessionData = this.sessionManager.getData(session);
      sessionData.datetime = Date.now();
      sessionDataObject = sessionData.object;
      if (container)
        container.register(this.sessionManager.options.constructor, {
          useValue: sessionDataObject,
        });
    }
    await this.options.onJsonRequest?.({
      constructor,
      container: container as TContainer,
      session: sessionDataObject,
    });
    if (container) {
      return container.resolve(constructor);
    } else {
      return new constructor();
    }
  }

  protected prepareWsServer(ws: WebSocketServer) {
    const socketSessions = new StrictMap<unknown, string>();
    ws.on("connection", (socket, request) => {
      if (this.options.logging)
        log("server", "received", `connection ${request.url}`);
      socket.on("close", async () => {
        socketSessions.delete(socket);
        await this.controller.closeStreams(
          socket as unknown as typeof WebSocket
        );
      });
      socket.on("error", (error) => console.error("Socket error", error));
      socket.on("message", async (data, binary) => {
        const message = parse(binary ? (data as Uint8Array) : data.toString());
        await this.controller.processServerMessage({
          clientKey: socket as unknown as typeof WebSocket,
          message,
          onSend: (msg) => socket.send(serialize(msg)),
          onSessionRequest: (msg) => {
            const session = this.sessionManager?.init({
              input: msg.data,
            });
            if (session) socketSessions.set(socket, session);
            return session;
          },
          onJsonRequest: async (constructor) => {
            const session = this.sessionManager
              ? socketSessions.get(socket)
              : undefined;
            return await this.onJsonRequest(constructor, session);
          },
        });
      });
    });
    this.http.on("upgrade", (request, socket, head) => {
      if (this.options.logging) log("server", "received", "upgrade");
      ws.handleUpgrade(request, socket as Socket, head, (socket, request) => {
        ws.emit("connection", socket, request);
      });
    });
  }

  protected prepareHttpServer() {
    this.http.on("request", async (request, response) => {
      try {
        await this.processHttpRequest(request, response);
      } catch (error) {
        console.error(error);
        response.statusCode = 400;
        response.end();
      }
    });
  }

  protected async processHttpRequest(
    request: IncomingMessage,
    response: ServerResponse
  ) {
    if (this.options.logging)
      log("server", "received", `request ${request.url}`);

    const url = new URL(request.url as string, "file://");

    if (this.options.requireConnectionToken || this.options.connectionTokens) {
      const token =
        request.headers["x-smcp-token"] ?? url.searchParams.get("x-smcp-token");
      const tokenError = this.getConnectionTokenError(token);
      if (tokenError) throw tokenError;
    }

    const session = this.sessionManager?.init({ input: request, response });
    if (
      // Message
      (this.options.protocols?.http ?? true) &&
      ("x-smcp" in request.headers ||
        "x-smcp-token" in request.headers ||
        url.searchParams.has("x-smcp") ||
        url.searchParams.has("x-smcp-token"))
    ) {
      await this.processHttpRequestMessage(request, response, {
        session,
        url,
      });
    } else if (
      // Resource
      this.options.publicPath
    ) {
      await processStaticFileRequest(request, response, {
        dir: this.options.publicPath,
      });
    } else {
      response.end();
    }
  }

  protected async processHttpRequestMessage(
    request: IncomingMessage,
    response: ServerResponse,
    data: {
      url: URL;
      session?: string;
    }
  ) {
    const payload = await fetchPayload(request);
    await this.controller.processServerMessage({
      message: parse(payload ?? "{}", {
        url: data.url,
      }),
      onJsonRequest: async (constructor) =>
        await this.onJsonRequest(constructor, data.session),
      onSend: (msg) => {
        if (msg.type === MessageTypeEnum.JsonResponse) {
          const [error] = msg.data;
          if (error) response.statusCode = 400;
        }
        response.end(serialize(msg));
      },
    });
  }

  async start(port = this.options.port ?? 80, address = this.options.address) {
    this.prepareHttpServer();
    if (this.ws) this.prepareWsServer(this.ws);
    return await new Promise<void>((resolve, reject) => {
      let resolved = false;
      this.http.once("error", (error) => {
        if (!resolved) reject(error);
      });
      this.http.listen(port, address, () => {
        resolved = true;
        resolve();
      });
    });
  }

  async stop() {
    const wsPromise = makePromise<Error | undefined>();
    const httpPromise = makePromise<Error | undefined>();

    this.ws?.close((error) => wsPromise.resolve(error));
    this.http.close((error) => httpPromise.resolve(error));

    for (const client of this.ws?.clients || []) client.close();

    const wsError = await wsPromise;
    const httpError = await httpPromise;

    if (wsError && httpError)
      throw new Error(
        `WebSocket server close error: ${wsError.message} | Http server close error: ${httpError.message}`
      );
    if (wsError) throw wsError;
    if (httpError) throw httpError;
  }

  get port() {
    const address = this.http.address();
    if (!address || typeof address === "string")
      throw new Error("HTTP address is not an object");
    return address.port;
  }
}
