/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  web,
  makeJsonDecoder,
  makeReadableStream,
  toReadableStream,
} from "../../src/utils/stream";
import { randomBytes } from "crypto";
import { createReadStream } from "fs";
import { writeFile, rm } from "fs/promises";
import { tmpdir } from "os";

function init() {
  const decoder = makeJsonDecoder();
  const writer = decoder.writable.getWriter();
  const reader = decoder.readable.getReader();
  return { decoder, writer, reader };
}

describe("ReadableStream", () => {
  it("is function", () => {
    expect(typeof web.ReadableStream).toBe("function");
  });
});

describe("ReadableStreamDefaultController", () => {
  it("is function", () => {
    expect(typeof web.ReadableStreamDefaultController).toBe("function");
  });
});

describe("TextDecoderStream", () => {
  it("is function", () => {
    expect(typeof web.TextDecoderStream).toBe("function");
  });
});

describe("TransformStream", () => {
  it("is function", () => {
    expect(typeof web.TransformStream).toBe("function");
  });
});

describe("WritableStream", () => {
  it("is function", () => {
    expect(typeof web.WritableStream).toBe("function");
  });
});

describe("makeJsonDecoder", () => {
  it("writes 1 object", async () => {
    const { writer, reader } = init();
    writer.write(`${JSON.stringify({ a: 1 })}`);
    writer.close();
    expect(await reader.read()).toMatchObject({
      value: { payload: false, data: { a: 1 } },
      done: false,
    });
    expect(await reader.read()).toMatchObject({ value: undefined, done: true });
  });

  it("writes 2 objects", async () => {
    const { writer, reader } = init();
    writer.write(`${JSON.stringify({ a: 1 })}\n`);
    writer.write(`${JSON.stringify({ a: 2 })}`);
    writer.close();
    expect(await reader.read()).toMatchObject({
      value: { payload: false, data: { a: 1 } },
      done: false,
    });
    expect(await reader.read()).toMatchObject({
      value: { payload: false, data: { a: 2 } },
      done: false,
    });
    expect(await reader.read()).toMatchObject({ value: undefined, done: true });
  });

  it("writes 3 objects + payload", async () => {
    const { writer, reader } = init();
    writer.write(`${JSON.stringify({ a: 1 })}\n`);
    writer.write(`${JSON.stringify({ a: 2 })}\n\n`);
    writer.write(`${JSON.stringify({ a: 3 })}`);
    writer.close();
    expect(await reader.read()).toMatchObject({
      value: { payload: false, data: { a: 1 } },
      done: false,
    });
    expect(await reader.read()).toMatchObject({
      value: { payload: false, data: { a: 2 } },
      done: false,
    });
    expect(await reader.read()).toMatchObject({
      value: { payload: true, data: { a: 3 } },
      done: false,
    });
    expect(await reader.read()).toMatchObject({ value: undefined, done: true });
  });
});

describe("makeReadableStream", () => {
  it("returns stream and controller", () => {
    const result = makeReadableStream();
    const [stream, controller] = result;
    expect(Array.isArray(result)).toBeTruthy();
    expect(result.length).toBe(2);
    expect(stream).toBeInstanceOf(web.ReadableStream);
    expect(controller).toBeInstanceOf(web.ReadableStreamDefaultController);
  });
});

describe("toReadableStream", () => {
  it("returns ReadableStream instance", () => {
    const nodeStream = createReadStream(__filename);
    const stream = toReadableStream(nodeStream);
    expect(stream).toBeInstanceOf(web.ReadableStream);
    nodeStream.close();
  });
  it("returns a valid stream", async () => {
    const tempFile = tmpdir() + "/" + randomBytes(32).toString("hex");
    await writeFile(tempFile, "hello world");
    const nodeStream = createReadStream(tempFile);
    const stream = toReadableStream(nodeStream);
    const data = await stream
      .pipeThrough(new web.TextDecoderStream())
      .getReader()
      .read();
    expect(data.value).toBe("hello world");
    try {
      await rm(tempFile);
      // eslint-disable-next-line no-empty
    } catch (error) {}
  });
});
