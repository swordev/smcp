import configs from "../../configs";
import { getUint8Bytes } from "../buffer";
import { color } from "../color";
import { encode, decode, ConfigsType } from "../ejson";
import { parseJSON } from "../json";
import { web } from "../stream";
import { URL } from "../url";

export enum MessageTypeEnum {
  JsonRequest = 1,
  JsonResponseCallback,
  JsonResponse,
  StreamRequest,
  StreamResponseData,
  StreamResponseChunk,
  StreamResponseEnd,
  SessionRequest,
  SessionResponse,
}

export type MessageType = MessageMapType[keyof MessageMapType];

export type MessageMapType = {
  [MessageTypeEnum.JsonRequest]: {
    id: number;
    type: MessageTypeEnum.JsonRequest;
    data: {
      path: string;
      args: unknown[];
    };
  };
  [MessageTypeEnum.StreamResponseData]: {
    id: number;
    type: MessageTypeEnum.StreamResponseData;
    data: ReadableStream<Uint8Array>;
  };
  [MessageTypeEnum.SessionRequest]: {
    id: number;
    type: MessageTypeEnum.SessionRequest;
    data: string | undefined;
  };
  [MessageTypeEnum.SessionResponse]: {
    id: number;
    type: MessageTypeEnum.SessionResponse;
    data: string | undefined;
  };
  [MessageTypeEnum.StreamResponseChunk]: {
    id: number;
    type: MessageTypeEnum.StreamResponseChunk;
    data: Uint8Array;
  };
  [MessageTypeEnum.StreamResponseEnd]: {
    id: number;
    type: MessageTypeEnum.StreamResponseEnd;
    data?: undefined;
  };
  [MessageTypeEnum.JsonResponse]: {
    id: number;
    type: MessageTypeEnum.JsonResponse;
    data: [unknown, unknown];
  };
  [MessageTypeEnum.JsonResponseCallback]: {
    id: number;
    type: MessageTypeEnum.JsonResponseCallback;
    data: {
      index: number;
      args: unknown[];
    };
  };
  [MessageTypeEnum.StreamRequest]: {
    id: number;
    type: MessageTypeEnum.StreamRequest;
    data: {
      index: number;
    };
  };
};

export type StreamType = [ReadableStream, ReadableStreamController<Uint8Array>];
export type StreamClientMapType = Map<
  number,
  readonly [ReadableStream, ReadableStreamController<Uint8Array>]
>;
export type StreamMapType<T> = Map<T, StreamClientMapType>;

export const typeLabelMap: Record<keyof MessageMapType, string> = {
  [MessageTypeEnum.JsonRequest]: "JsonRequest",
  [MessageTypeEnum.JsonResponse]: "JsonResponse",
  [MessageTypeEnum.JsonResponseCallback]: "JsonResponseCallback",
  [MessageTypeEnum.SessionRequest]: "SessionRequest",
  [MessageTypeEnum.SessionResponse]: "SessionResponse",
  [MessageTypeEnum.StreamRequest]: "StreamRequest",
  [MessageTypeEnum.StreamResponseChunk]: "StreamResponseChunk",
  [MessageTypeEnum.StreamResponseData]: "StreamResponseData",
  [MessageTypeEnum.StreamResponseEnd]: "StreamResponseEnd",
};

export function log(
  type: "client" | "server",
  dir: "sent" | "received",
  message: MessageType | string
) {
  const typeChar = type === "client" ? color("green", "C") : color("blue", "S");
  const dirChar = dir === "sent" ? ">" : "<";
  const prefix = `[${typeChar}] ${dirChar} ${color("gray", "|")}`;
  if (typeof message === "string") {
    console.info(`${prefix} ${"    "} ${message}`);
  } else {
    let data = message.data as unknown;
    if (message.type === MessageTypeEnum.StreamResponseChunk)
      data = { byteLength: message.data.byteLength };
    console.info(
      `${prefix} ${message.id.toString().padStart(4, " ")} ${color(
        "cyan",
        typeLabelMap[message.type]
      )} ${color("gray", JSON.stringify(data ?? null))}`
    );
  }
}

export function encodeData(data: unknown, _configs?: ConfigsType) {
  return encode(data, [...(_configs ?? []), ...configs]);
}

export function decodeData(
  input: Omit<Parameters<typeof decode>[0], "configs"> & {
    configs?: ConfigsType;
  }
) {
  return decode({
    ...input,
    configs: [...(input.configs ?? []), ...configs],
  });
}

export function serialize(message: MessageType) {
  if (message.type === MessageTypeEnum.StreamResponseChunk) {
    const header = new Uint8Array([
      ...getUint8Bytes(message.id, Uint32Array),
      MessageTypeEnum.StreamResponseChunk,
    ]);
    const data = new Uint8Array(header.byteLength + message.data.byteLength);
    data.set(header, 0);
    data.set(message.data, header.byteLength);
    return data;
  } else if (message.type === MessageTypeEnum.StreamResponseEnd) {
    return new Uint8Array([
      ...getUint8Bytes(message.id, Uint32Array),
      MessageTypeEnum.StreamResponseEnd,
    ]);
  } else {
    return JSON.stringify(message);
  }
}

export function parseType(value: unknown): MessageTypeEnum {
  if (
    !/^\d+$/.test(String(value).toString()) ||
    !((value as number) in MessageTypeEnum)
  )
    throw new Error(`Invalid message type: ${value}`);
  return Number(value) as MessageTypeEnum;
}

export function parse(
  value: string | Uint8Array,
  extra?: {
    url: URL;
    stream?: ReadableStream;
  }
): MessageType {
  if (typeof value === "string") {
    const result = parseJSON(value.toString()) as MessageType;
    if (extra?.url) {
      if (!result.id) {
        const id = extra.url.searchParams.get("id");
        if (id) result.id = Number(id);
      }
      if (!result.type as never) {
        const type = extra.url.searchParams.get("type");
        if (type) result.type = Number(type);
      }
    }
    if (typeof result.id !== "number")
      throw new Error(`Invalid JSON response id: ${result.id}`);
    if (!(result.type in MessageTypeEnum))
      throw new Error(`Invalid JSON response type: ${result.type}`);
    if (result.type === MessageTypeEnum.JsonResponseCallback) {
      const data = result.data;
      if (typeof data?.index !== "number")
        throw new Error(`Invalid JSON response callback index: ${data?.index}`);
      if (!Array.isArray(data?.args))
        throw new Error(`Invalid JSON response callback args: ${data?.args}`);
    } else if (result.type === MessageTypeEnum.StreamRequest) {
      const data = result.data;
      if (typeof data?.index !== "number")
        throw new Error(`Invalid JSON response stream index: ${data?.index}`);
    } else if (result.type === MessageTypeEnum.JsonRequest) {
      if (typeof result.id !== "number")
        throw new Error(`Invalid JSON request id: ${result.id}`);
      if (extra?.url) {
        if (!(result.data as never)) result.data = {} as never;
        if (!result.data.path) result.data.path = extra.url.pathname;
        if (!result.data.args) {
          const args = extra.url.searchParams.get("args");
          if (args) result.data.args = parseJSON(args);
        }
      }
      if (typeof result.data.path !== "string")
        throw new Error(`Invalid JSON request path: ${result.data.args}`);
    } else if (result.type === MessageTypeEnum.StreamResponseData) {
      if (typeof result.id !== "number")
        throw new Error(`Invalid JSON request id: ${result.id}`);
      if (!result.data && extra?.stream)
        (result as { data: ReadableStream }).data = extra?.stream;
      if (!(result.data instanceof web.ReadableStream))
        throw new Error(`Invalid strem object`);
    } else if (result.type === MessageTypeEnum.SessionRequest) {
      if (typeof result.data !== "string" && (result.data ?? null) !== null)
        throw new Error(`Invalid session: ${result.data}`);
    }
    return result;
  } else if (value instanceof Uint8Array) {
    const headerIdByteLength = Uint32Array.BYTES_PER_ELEMENT;
    const headerTypeByteLength = Uint8Array.BYTES_PER_ELEMENT;
    const headerByteLength = headerIdByteLength + headerTypeByteLength;

    const headerId = new Uint32Array(value.slice(0, headerIdByteLength));
    const id = headerId[0];

    const type: MessageTypeEnum = value.slice(
      headerIdByteLength,
      headerIdByteLength + 1
    )[0];
    const data = value.slice(headerByteLength);

    if (type === MessageTypeEnum.StreamResponseChunk) {
      return {
        id,
        type,
        data,
      };
    } else if (type === MessageTypeEnum.StreamResponseEnd) {
      return {
        id,
        type,
      };
    } else {
      throw new Error(`Invalid binary message type: ${type}`);
    }
  } else {
    throw new Error(`Invalid message value: ${value}`);
  }
}
