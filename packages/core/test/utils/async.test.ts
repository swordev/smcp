import { makePromise } from "../../src/utils/async";

describe("makePromise", () => {
  it("resolves", async () => {
    const p = makePromise<number>();
    p.resolve(1);
    expect(await p).toBe(1);
  });
  it("rejects", () => {
    const p = makePromise();
    p.reject(new Error("error"));
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    expect(p).rejects.toThrow("error");
  });
});
