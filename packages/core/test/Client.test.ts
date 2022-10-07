import { Client } from "../src/Client";

describe("Client", () => {
  class X {
    method() {
      return 1;
    }
  }

  it("infers api type", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async function types() {
      await new Client<X>({}).api.method();
      await new Client<{ a: X }>({}).api.a.method();
      await new Client<{ a: { b: X } }>({}).api.a.b.method();
      await new Client<() => { a: X }>({}).api.a.method();
      await new Client<() => Promise<{ a: X }>>({}).api.a.method();
    }
    expect(true).toBeTruthy();
  });
});
