import { createProxy, parsePath } from "../../src/utils/proxy";

describe("createProxy", () => {
  it("returns path and args", async () => {
    const proxy = createProxy(async (path, args) => ({ path, args })) as {
      a: {
        b: {
          c: (
            ...values: unknown[]
          ) => Promise<{ path: string; args: unknown[] }>;
        };
      };
    };
    expect(await proxy.a.b.c(1, 2, 3)).toMatchObject({
      path: "/a/b/c",
      args: [1, 2, 3],
    });
  });
});

describe("parsePath", () => {
  it("returns parsed path", async () => {
    expect(parsePath("/a/b/c")).toMatchObject([["a", "b"], "c"]);
  });
});
