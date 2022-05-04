import { makePromise } from "./async";
import { File } from "./buffer";
import { toReadableStream, web } from "./stream";
import { randomBytes } from "crypto";
import { createReadStream, createWriteStream } from "fs";
import { open, stat } from "fs/promises";
import { tmpdir } from "os";
import { basename, join } from "path";
import { Readable } from "stream";

export function tempPath(prefix?: string) {
  return join(tmpdir(), (prefix ?? "") + randomBytes(16).toString("hex"));
}

export async function createFileFromPath(path: string, name?: string) {
  const file = new File([], name ?? basename(path));
  const stream = createReadStream(path);
  const fileInfo = await stat(path);
  const webStream = toReadableStream<Uint8Array>(stream);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  file.stream = () => webStream;
  file.size = fileInfo.size;
  file.lastModified = fileInfo.mtimeMs;
  return file;
}

export function writeStreamFile(
  input: Readable | ReadableStream<Uint8Array>,
  outPath: string,
  options?: {
    onProgress?: (data: { bytes: number }) => void;
  }
): Promise<void>;
export function writeStreamFile(
  input: File,
  outPath: string,
  options?: {
    onProgress?: (data: {
      bytes: number;
      totalBytes: number;
      progress: number;
    }) => void;
  }
): Promise<void>;
export async function writeStreamFile(
  input: Readable | ReadableStream<Uint8Array> | File,
  outPath: string,
  options?: {
    onProgress?: (data: {
      bytes: number;
      totalBytes: number | never;
      progress: number | never;
    }) => void;
  }
): Promise<void> {
  let stream: ReadableStream | undefined;
  let totalBytes: number | undefined;
  let bytes = 0;
  const onProgress = options?.onProgress;
  if (input instanceof File) {
    stream = input.stream();
    totalBytes = input.size;
  } else if (input instanceof web.ReadableStream) {
    stream = input;
  }
  if (input instanceof Readable) {
    return new Promise<void>((resolve, reject) => {
      const outStream = createWriteStream(outPath);
      input.pipe(outStream);
      if (onProgress)
        input.on("data", (chunk: Buffer) => {
          bytes += chunk.byteLength;
          onProgress({ bytes } as {
            bytes: number;
            totalBytes: never;
            progress: never;
          });
        });
      outStream.on("error", reject);
      outStream.on("close", resolve);
    });
  } else if (stream) {
    const file = await open(outPath, "w");
    const promise = makePromise<void>();
    const outStream = new web.WritableStream<Uint8Array>({
      abort(error) {
        promise.reject(error);
      },
      async close() {
        await file.close();
        promise.resolve();
      },
      async write(chunk, controller) {
        try {
          if (onProgress) {
            bytes += chunk.byteLength;
            if (totalBytes !== undefined) {
              const progress = Number(((bytes * 100) / totalBytes).toFixed(2));
              onProgress({ progress, totalBytes, bytes });
            } else {
              onProgress({ bytes } as {
                bytes: number;
                totalBytes: never;
                progress: never;
              });
            }
          }
          await file.write(chunk);
        } catch (error) {
          controller.error(error);
          await file.close();
        }
      },
    });
    await Promise.all([promise, stream.pipeTo(outStream)]);
  } else {
    throw new Error(`Invalid input: ${input}`);
  }
}
