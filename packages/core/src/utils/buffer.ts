import { include } from "./module";
import { makeReadableStream } from "./stream";

export const Blob = include(["buffer", "Blob"], globalThis.Blob);

export function concatUint8Array(a: Uint8Array, b: Uint8Array) {
  const result = new Uint8Array(a.length + b.length);
  result.set(a);
  result.set(b, a.length);
  return result;
}

export abstract class FileAbstract implements globalThis.File {
  lastModified!: number;
  name: string;
  size: number;
  type: string;
  webkitRelativePath: string;
  private fileBits?: BlobPart[];
  constructor(
    fileBits: BlobPart[],
    fileName: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options?: FilePropertyBag
  ) {
    this.fileBits = fileBits;
    let size = 0;
    for (const part of this.fileBits ?? []) {
      if (typeof part === "string") {
        size += part.length;
      } else if (part instanceof ArrayBuffer) {
        size = part.byteLength;
      } else if (part instanceof Uint8Array) {
        size += part.byteLength;
      } else {
        throw new Error(`Invalid file bits`);
      }
    }
    this.name = fileName;
    this.size = size;
    this.type = "";
    this.webkitRelativePath = "";
  }
  stream(): ReadableStream<Uint8Array>;
  stream(): NodeJS.ReadableStream;
  stream(): ReadableStream<Uint8Array> | NodeJS.ReadableStream {
    const [stream, controller] = makeReadableStream<Uint8Array>();
    const textEncoder = new TextEncoder();
    for (const part of this.fileBits ?? []) {
      if (typeof part === "string") {
        controller.enqueue(textEncoder.encode(part));
      } else if (part instanceof ArrayBuffer) {
        controller.enqueue(new Uint8Array(part));
      } else if (part instanceof Uint8Array) {
        controller.enqueue(part);
      } else {
        throw new Error(`Invalid file bits`);
      }
    }
    controller.close();
    return stream;
  }
  async arrayBuffer(): Promise<ArrayBuffer> {
    const reader = this.stream().getReader();
    let array = new Uint8Array([]);
    for (;;) {
      const data = await reader.read();
      if (data.done) {
        break;
      } else {
        array = concatUint8Array(array, data.value as Uint8Array);
      }
    }
    return array.buffer;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  slice(start?: number, end?: number, contentType?: string): Blob {
    throw new Error("Method not implemented.");
  }
  async text(): Promise<string> {
    const buffer = await this.arrayBuffer();
    return new TextDecoder().decode(buffer);
  }
}

const FileBase = (globalThis.File ?? FileAbstract) as typeof FileAbstract;

export class File extends FileBase {}

export function getUint8Bytes(
  value: number,
  constructor: Uint16ArrayConstructor | Uint32ArrayConstructor
) {
  const array = new constructor([value]);
  const view = new DataView(array.buffer);
  const result: number[] = [];
  for (let index = 0; index < constructor.BYTES_PER_ELEMENT; ++index) {
    result.push(view.getUint8(index));
  }
  return result;
}
