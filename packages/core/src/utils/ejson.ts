import { iterate, IterationTypeEnum } from "./object";
import { FunctionType } from "./ts";
import { DeepReadonly } from "ts-essentials";

export type ConfigsType = DeepReadonly<ConfigType[]>;
export type BufferType = ArrayBuffer | Blob | string;

export type ConfigType<TDecoded = unknown, TEncoded = unknown> = DeepReadonly<{
  test: (object: unknown) => boolean;
  encode?: (object: TDecoded) => TEncoded;
  encodeBuffer?: (object: TDecoded) => BufferType;
  stream?: (object: TDecoded) => ReadableStream<Uint8Array> | Blob;
  decode: (
    object: TEncoded,
    extra: {
      buffer?: BufferType;
      stream?: () => ReadableStream<Uint8Array>;
    }
  ) => TDecoded;
}>;

export type DataType<TObject = unknown> = {
  object: TObject;
  buffers: BufferType[];
  bufferTypes: string[];
  callbacks: FunctionType[];
  streams: (ReadableStream<Uint8Array> | Blob)[];
};

export type CallbackType = (index: number, args: unknown[]) => void;

const objectKey = "$object";
const callbackKey = "$callback";

export function isEncoded(object: unknown, key: string) {
  return !!(
    object &&
    typeof object === "object" &&
    key in object &&
    Object.keys(object).length === 1
  );
}

export function isEncodedObject(object: unknown): object is {
  [objectKey]: [number, unknown, number | undefined];
} {
  return isEncoded(object, objectKey);
}

export function isEncodedCallback(object: unknown): object is {
  [callbackKey]: number;
} {
  return isEncoded(object, callbackKey);
}

export function findConfig(value: unknown, configs: ConfigsType) {
  for (const type in configs) {
    const config = configs[type];
    const test = config.test;
    if (typeof test === "function") if (test(value)) return { ...config, type };
  }
  throw new Error(`Config not found for value: ${value}`);
}

export function decode<T = unknown>(input: {
  data: DataType;
  configs?: ConfigsType;
  onCallback?: CallbackType;
  onStream?: (index: number) => ReadableStream;
}) {
  const data = input.data;
  const configs = input.configs || [];

  return iterate(data.object, (item) => {
    if (isEncodedCallback(item.value)) {
      const callbackIndex = item.value[callbackKey];
      if (typeof callbackIndex !== "number")
        throw new Error(`Value is not a number`);
      if (!item.parent) throw new Error("Parent object is not defined");
      item.parent.value[item.key] = (...args: unknown[]) => {
        if (!input.onCallback) throw new Error(`'onCallback' is not defined`);
        return input.onCallback(callbackIndex, args);
      };
    } else if (isEncodedObject(item.value)) {
      const value = item.value[objectKey];
      if (!Array.isArray(value)) throw new Error(`Value is not a array`);
      const [type, encodedValue, bufferIndex] = value;
      const config = configs[type];
      if (!item.parent) throw new Error("Parent not found");
      item.parent.value[item.key] = config.decode(encodedValue, {
        buffer:
          typeof bufferIndex === "number"
            ? data.buffers[bufferIndex]
            : undefined,
        stream: () => {
          if (!input.onStream) throw new Error(`'onStream' is not defined`);
          if (typeof bufferIndex !== "number")
            throw new Error(`'bufferIndex' is not defined`);
          return input.onStream(bufferIndex);
        },
      });
      return false;
    }
  }) as T;
}

export function encode(data: unknown, configs: ConfigsType = []): DataType {
  const buffers: BufferType[] = [];
  const bufferTypes: string[] = [];
  const callbacks: FunctionType[] = [];
  const streams: (ReadableStream | Blob)[] = [];
  let cbIndex = 0;

  const object = iterate(data, ({ value, key, parent }, iterationType) => {
    const instanceObject =
      value &&
      iterationType === IterationTypeEnum.None &&
      typeof value === "object";

    if (instanceObject) {
      const config = findConfig(value, configs);
      const encodedValue = config.encode?.(value);
      if (!parent) throw new Error("Parent object is not defined");
      parent.value[key] = { [objectKey]: [config.type, encodedValue] };
      if (config.stream) {
        streams.push(config.stream(value));
        parent.value[key][objectKey].push(buffers.length);
      } else if (config.encodeBuffer) {
        parent.value[key][objectKey].push(buffers.length);
        buffers.push(config.encodeBuffer(value));
        bufferTypes.push(config.type);
      }
    } else if (typeof value === "function") {
      if (!parent) throw new Error("Parent object is not defined");
      parent.value[key] = { [callbackKey]: cbIndex++ };
      callbacks.push(value);
    }

    if (instanceObject) return false;
  });

  return { object, buffers, bufferTypes, callbacks, streams };
}
