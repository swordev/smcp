import {
  crypto,
  int2hex,
  randomBytes,
  randomChars,
} from "../../src/utils/crypto";

describe("crypto", () => {
  it("has getRandomValues function", async () => {
    expect(!!crypto).toBeTruthy();
    expect(typeof crypto.getRandomValues).toBe("function");
  });
});

describe("int2hex", () => {
  it("returns hex values", async () => {
    expect(int2hex(0)).toBe("00");
    expect(int2hex(9)).toBe("09");
    expect(int2hex(10)).toBe("0a");
    expect(int2hex(255)).toBe("ff");
  });
});

describe("randomBytes", () => {
  it("returns Uint8Array instance", async () => {
    expect(randomBytes(0)).toBeInstanceOf(Uint8Array);
  });
  it("returns 8 random bytes", async () => {
    expect(randomBytes(8).byteLength).toBe(8);
  });
});

describe("randomChars", () => {
  it("returns String instance", async () => {
    expect(typeof randomChars(0)).toBe("string");
  });
  it("returns 8 random bytes", async () => {
    expect(randomChars(8).length).toBe(8);
  });
});
