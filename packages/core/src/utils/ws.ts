import { makePromise, PromiseType } from "./async";
import { include } from "./module";
import { encode } from "./querystring";

export const WebSocket = include(["ws", "WebSocket"], globalThis.WebSocket);

export class WebSocketController {
  socket!: WebSocket;
  private openPromises: PromiseType[] = [];
  private isOpening = false;
  constructor(
    readonly options: {
      url: string;
      onMessage: (event: MessageEvent<unknown>) => unknown;
      onClose?: (event: CloseEvent) => unknown;
      onError?: (error: Error) => unknown;
      onOpen?: () => unknown;
    }
  ) {}
  isOpen() {
    return !this.isOpening && this.socket?.readyState === 1;
  }
  async open(query?: Record<string, string>) {
    if (this.isOpening) {
      const promise = makePromise();
      this.openPromises.push(promise);
      await promise;
    } else if (this.socket?.readyState !== 1) {
      this.isOpening = true;
      try {
        await new Promise<void>((resolve, reject) => {
          let resolvedOrRejected = false;
          try {
            const url = this.options.url + (query ? `?${encode(query)}` : "");

            this.socket = new WebSocket(url);
            this.socket.onerror = async () => {
              if (!resolvedOrRejected) {
                reject(new Error("Socket error"));
              } else {
                await this.options.onError?.(new Error("Socket error"));
              }
            };
            this.socket.onopen = async () => {
              resolvedOrRejected = true;
              try {
                await this.options.onOpen?.();
                resolve();
              } catch (error) {
                reject(error);
              }
            };
            this.socket.onclose = async (event) =>
              await this.options.onClose?.(event);
            this.socket.onmessage = (event) => {
              this.options.onMessage(event);
            };
          } catch (error) {
            resolvedOrRejected = true;
            reject(error);
          }
        });
        try {
          for (const promise of this.openPromises) {
            promise.resolve();
          }
          // eslint-disable-next-line no-empty
        } catch (error) {}
      } catch (error) {
        for (const promise of this.openPromises) {
          promise.reject(error as Error);
        }
        throw error;
      } finally {
        this.isOpening = false;
        this.openPromises = [];
      }
    }
  }
}
