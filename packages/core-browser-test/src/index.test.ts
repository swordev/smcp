import type apiType from "./server/api";
import createServer from "./server/createServer";
import { Client as _Client } from "@smcp/core/Client";
import { Server } from "@smcp/core/Server";
import { ResolveType } from "@smcp/core/utils/ts";

declare const Client: {
  new (args: _Client<typeof api>["options"]): _Client<typeof apiType>;
};
declare const api: ResolveType<typeof apiType>;

let server!: {
  [k in "normal" | "token"]: {
    address: string;
    instance: Server<unknown, unknown>;
  };
};

before(async () => {
  server = {
    normal: await createServer(0),
    token: await createServer(0, {
      connectionTokens: ["secret"],
    }),
  };
  await browser.url(server.normal.address);
});

after(() => {
  Object.entries(server).forEach(([, { instance }]) =>
    instance.sessionManager?.stopGcRutine()
  );
});

describe("smcp", () => {
  it("returns Error", async () => {
    expect(
      await browser.executeAsync(async (done) => {
        done((await api.dummy.returnError()) instanceof Error);
      })
    ).toBeTruthy();
  });

  it("returns error message", async () => {
    expect(
      await browser.executeAsync(async (done) => {
        done((await api.dummy.returnError()).message);
      })
    ).toMatch("returnError");
  });

  it("returns async Error", async () => {
    expect(
      await browser.executeAsync(async (done) => {
        done((await api.dummy.returnAsyncError()) instanceof Error);
      })
    ).toBeTruthy();
  });

  it("throws Error", async () => {
    expect(
      await browser.executeAsync(async (done) => {
        try {
          await api.dummy.throwError();
          done(false);
        } catch (error) {
          done(error instanceof Error);
        }
      })
    ).toBeTruthy();
  });

  it("throws async Error", async () => {
    expect(
      await browser.executeAsync(async (done) => {
        try {
          await api.dummy.throwAsyncError();
          done(false);
        } catch (error) {
          done(error instanceof Error);
        }
      })
    ).toBeTruthy();
  });

  it("returns file checksum", async () => {
    expect(
      await browser.executeAsync(async (done) => {
        done(
          await api.dummy.returnChecksum({
            file: new File(["asd"], "x"),
          })
        );
      })
    ).toBe("f10e2821bbbea527ea02200352313bc059445190");
  });

  it("executes callback", async () => {
    expect(
      await browser.executeAsync(async (done) => {
        const values: number[] = [];
        const result = await api.dummy.callback({
          onProgress: (value) => {
            values.push(value);
          },
        });
        done([values, result]);
      })
    ).toMatchObject([[10, 50, 90], 100] as never);
  });

  it("throws undefined token error", async () => {
    expect(
      await browser.executeAsync(async (port, done) => {
        const client = new Client({
          configs: [],
          url: { port },
        });
        try {
          await client.api.dummy.returnString();
          done(false);
        } catch (error) {
          done((error as Error).message);
        }
      }, server.token.instance.port)
    ).toBeTruthy();
  });

  it("throws invalid token error", async () => {
    expect(
      await browser.executeAsync(async (port, done) => {
        const client = new Client({
          configs: [],
          connectionToken: "invalid",
          url: { port },
        });
        try {
          await client.api.dummy.returnString();
          done(false);
        } catch (error) {
          done((error as Error).message);
        }
      }, server.token.instance.port)
    ).toBeTruthy();
  });

  it("connects to server with token", async () => {
    expect(
      await browser.executeAsync(async (port, done) => {
        const client = new Client({
          configs: [],
          connectionToken: "secret",
          url: { port },
        });
        try {
          await client.api.dummy.returnString();
          done(true);
        } catch (error) {
          done(false);
        }
      }, server.token.instance.port)
    ).toBeTruthy();
  });

  it("throws require connection token error", async () => {
    const server = await createServer(0, {
      requireConnectionToken: true,
    });
    expect(
      await browser.executeAsync(async (port, done) => {
        const client = new Client({
          url: { port },
        });
        try {
          await client.api.dummy.returnString();
          done(true);
        } catch (error) {
          done(false);
        }
      }, server.instance.port)
    ).toBeFalsy();

    await server.instance.stop();
  });

  it("returns string using require connection token", async () => {
    const connectionToken = "X";
    const server = await createServer(0, {
      requireConnectionToken: true,
      connectionTokens: [connectionToken],
    });
    expect(
      await browser.executeAsync(
        async ([port, connectionToken], done) => {
          const client = new Client({
            url: { port },
            connectionToken,
          });
          try {
            done(await client.api.dummy.returnString());
          } catch (error) {
            done(false);
          }
        },
        [server.instance.port, connectionToken] as const
      )
    ).toBe("hello world");

    await server.instance.stop();
  });
});
