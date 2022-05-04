import { getUint8Bytes, concatUint8Array } from "../../src/utils/buffer";

describe("getUint8Bytes", () => {
  it("returns 2 bytes", async () => {
    expect(getUint8Bytes(1, Uint16Array)).toMatchObject([1, 0]);
  });
  it("returns 4 bytes", async () => {
    expect(getUint8Bytes(1, Uint32Array)).toMatchObject([1, 0, 0, 0]);
  });
});

describe("concatUint8Array", () => {
  it("concats 2 arrays", async () => {
    const array = concatUint8Array(
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6])
    );
    expect(array).toBeInstanceOf(Uint8Array);
    expect(array.byteLength).toBe(6);
    expect(Object.values(array)).toMatchObject([1, 2, 3, 4, 5, 6]);
  });
});
