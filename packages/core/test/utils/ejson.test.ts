/* eslint-disable @typescript-eslint/no-empty-function */
import configs from "../../src/configs";
import { encode, decode, CallbackType, DataType } from "../../src/utils/ejson";

describe("encode", () => {
  it("returns plain object", () => {
    expect(encode({ a: 1 })).toMatchObject({
      object: {
        a: 1,
      },
      buffers: [],
    });
  });
  it("returns error object", () => {
    const encoded = encode({ a: new Error("Test") }, configs);

    expect(encoded).toMatchObject({
      object: {
        a: {
          $object: ["1", { message: "Test" }],
        },
      },
      buffers: [],
      callbacks: [],
    });
  });

  it("returns empty array", () => {
    expect(encode([])).toMatchObject({
      object: [],
      buffers: [],
      callbacks: [],
    });
  });

  it("returns one callback", () => {
    const callback = () => {};
    expect(
      encode({
        callback,
      })
    ).toMatchObject({
      object: {
        callback: {
          $callback: 0,
        },
      },
      buffers: [],
      callbacks: [callback],
    });
  });
});

describe("decode", () => {
  it("parses error object", () => {
    const encoded = {
      object: {
        a: {
          $object: ["1", { message: "Test" }],
        },
      },
      buffers: [],
      callbacks: [],
      bufferTypes: [],
      streams: [],
    } as DataType;

    expect(
      decode<{ a: Error }>({
        data: encoded,
        configs,
      }).a
    ).toBeInstanceOf(Error);
  });

  it("calls one function", () => {
    const onCallback = jest.fn((() => {}) as CallbackType);
    const data = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      callback: (_value: string) => {},
    };
    const encoded = encode(data, []);
    const input: typeof data = decode({
      data: encoded,
      onCallback,
    });

    input.callback("test");
    expect(onCallback).toBeCalledWith(0, ["test"]);
  });

  it("calls two functions", () => {
    const onCallback = jest.fn((() => {}) as CallbackType);
    const data = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      callback1: (_value: string) => {},
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      callback2: (_value: string) => {},
    };
    const encoded = encode(data);
    const input: typeof data = decode({ data: encoded, onCallback });

    input.callback1("test1");
    expect(onCallback).toBeCalledWith(0, ["test1"]);
    input.callback2("test2");
    expect(onCallback).toBeCalledWith(1, ["test2"]);
  });
});
