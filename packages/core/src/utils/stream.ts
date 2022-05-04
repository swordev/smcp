import { include } from "./module";
import { Readable } from "stream";

export const web = {
  get TransformStream() {
    return include(
      ["stream/web", "TransformStream"],
      globalThis.TransformStream
    );
  },
  get ReadableStream() {
    return include(["stream/web", "ReadableStream"], globalThis.ReadableStream);
  },
  get ReadableStreamDefaultController() {
    return include(
      ["stream/web", "ReadableStreamDefaultController"],
      globalThis.ReadableStreamDefaultController
    );
  },
  get WritableStream() {
    return include(["stream/web", "WritableStream"], globalThis.WritableStream);
  },
  get TextDecoderStream() {
    return include(
      ["stream/web", "TextDecoderStream"],
      globalThis.TextDecoderStream
    );
  },
};

export type JsonControllerOutType = {
  payload: boolean;
  data: unknown;
};

export function makeJsonDecoder() {
  let buffer = "";
  let lastChar: string;
  let payload = false;
  const delimiterChar = "\n";

  const process = (
    json: string,
    controller: TransformStreamDefaultController<JsonControllerOutType>
  ) =>
    json.length
      ? controller.enqueue({
          payload,
          data: JSON.parse(json),
        })
      : null;

  const transform = (
    chunk: string,
    controller: TransformStreamDefaultController<JsonControllerOutType>
  ) => {
    let chunkOffset = 0;
    for (let pos = 0; pos < chunk.length; ++pos) {
      const char = chunk[pos];
      if (char === delimiterChar) {
        process(buffer + chunk.slice(chunkOffset, pos), controller);
        buffer = "";
        chunkOffset = pos + 1;
        if (lastChar === char) {
          payload = true;
        }
      }
      lastChar = char;
    }
    buffer += chunk.slice(chunkOffset);
  };

  return new web.TransformStream<string, JsonControllerOutType>({
    transform,
    flush(controller) {
      process(buffer, controller);
    },
  });
}

export function makeReadableStream<T = unknown>() {
  let controller: ReadableStreamController<T> | undefined;
  const stream = new web.ReadableStream({
    start(v) {
      controller = v;
    },
  });
  if (!controller) throw new Error("Controller is not defined");
  return [stream, controller] as const;
}

export async function readStreamText(stream: ReadableStream) {
  const reader = stream.pipeThrough(new web.TextDecoderStream()).getReader();
  let result = "";
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    } else {
      result += chunk.value;
    }
  }
  return result;
}

export function toReadableStream<T>(stream: Readable) {
  return new web.ReadableStream<T>({
    async start(controller) {
      stream.on("error", (error) => controller.error(error));
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
    },
  });
}
