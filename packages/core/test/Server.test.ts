import { Client } from "../src/Client";
import { Server } from "../src/Server";
import "reflect-metadata";
import { container, injectable } from "tsyringe";

describe("Server.prototype.start", () => {
  it("shoulds start two server", async () => {
    const server1 = new Server({
      api: {},
    });
    const server2 = new Server({
      api: {},
    });
    await server1.start(0);
    await server2.start(0);
    await server1.stop();
    await server2.stop();
  });
  it("throws listen error", async () => {
    const server1 = new Server({
      api: {},
    });
    await server1.start(0);
    const server2 = new Server({
      api: {},
    });
    await expect(server2.start(server1.port)).rejects.toThrowError();
    await server1.stop();
  });
});

describe("Server.options.container", () => {
  it("works with container", async () => {
    class CounterData {
      value = 0;
    }
    @injectable()
    class CounterApi {
      constructor(protected readonly data: CounterData) {}
      increment() {
        this.data.value++;
      }
      get() {
        return this.data.value;
      }
    }
    const counterData = new CounterData();
    const server = new Server({
      container,
      api: {
        CounterApi,
      },
      onJsonRequest: ({ container }) =>
        container.register(CounterData, {
          useValue: counterData,
        }),
    });
    await server.start(0);

    const client = new Client<typeof server.options.api>({
      url: { port: server.port },
    });

    expect(await client.api.CounterApi.get()).toBe(0);
    await client.api.CounterApi.increment();
    expect(await client.api.CounterApi.get()).toBe(1);
    await server.stop();
  });

  it("works without ioc container", async () => {
    const counterData = {
      value: 0,
    };
    class CounterApi {
      increment() {
        counterData.value++;
      }
      get() {
        return counterData.value;
      }
    }
    const server = new Server({
      api: {
        counter: CounterApi,
      },
    });
    await server.start(0);

    const client = new Client<typeof server.options.api>({
      url: { port: server.port },
    });

    expect(await client.api.counter.get()).toBe(0);
    await client.api.counter.increment();
    expect(await client.api.counter.get()).toBe(1);
    await server.stop();
  });
});

describe("Server.options.api", () => {
  it("resolves constructor", async () => {
    class Api {
      get() {
        return true;
      }
    }
    const server = new Server({
      container,
      api: Api,
    });

    await server.start(0);

    const client = new Client<Api>({
      url: { port: server.port },
    });

    expect(await client.api.get()).toBe(true);
    await server.stop();
  });
});
