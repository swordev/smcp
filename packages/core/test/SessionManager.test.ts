import { SessionManager } from "../src/SessionManager";

/* eslint-disable @typescript-eslint/no-empty-function */

function freezeDateNow(cb: (now: number) => void) {
  const now = Date.now;
  const current = Date.now();
  Date.now = () => current;
  try {
    cb(current);
  } finally {
    Date.now = now;
  }
}

describe("SessionManager.options", () => {
  it("have default values", async () => {
    const sm = new SessionManager({
      constructor: Function,
    });
    expect(typeof sm.options.cookieLength).toBe("number");
    expect(typeof sm.options.gargabeCollector?.maxAge).toBe("number");
    expect(typeof sm.options.gargabeCollector?.rutineInterval).toBe("number");
  });
});
describe("SessionManager.init", () => {
  it("creates new session", async () => {
    const sm = new SessionManager({
      constructor: Function,
    });
    const session = sm.init({});
    expect(typeof session === "string").toBeTruthy();
    expect(session.length).toBe(sm.options.cookieLength);
  });
  it("creates new session ignoring input value", async () => {
    const sm = new SessionManager({
      constructor: Function,
    });
    const session = sm.init({
      input: "A".repeat(32),
    });
    expect(session !== "A".repeat(32)).toBeTruthy();
  });
  it("creates new session without ignoring input value", async () => {
    const sm = new SessionManager({
      constructor: Function,
    });
    const session = sm.init({
      input: "A".repeat(32),
      create: true,
    });
    expect(session === "A".repeat(32)).toBeTruthy();
  });
  it("throws error due to invalid session", async () => {
    const sm = new SessionManager({
      constructor: Function,
    });
    expect(() =>
      sm.init({
        create: true,
      })
    ).toThrow();
  });
  it("does not create a new session", async () => {
    const sm = new SessionManager({
      constructor: Function,
    });
    const session = sm.init({});
    const session2 = sm.init({ input: session });
    expect(session).toBe(session2);
  });
  it("calls setHeader", async () => {
    const sm = new SessionManager({
      constructor: Function,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const setHeader = jest.fn((_name: string, _value: string) => {});
    const session = sm.init({
      response: {
        setHeader,
      },
    });
    expect(setHeader).toBeCalledWith(
      "Set-Cookie",
      `session=${session}; Path=/`
    );
  });
});
describe("SessionManager.create", () => {
  it("calls init and returns object", async () => {
    const sm = new SessionManager({
      constructor: Function,
    });
    const _init = sm.init.bind(sm);
    sm.init = jest.fn((...arg: Parameters<typeof sm.init>) => _init(...arg));
    const result = sm.create("A".repeat(32));
    expect(sm.init).toBeCalledWith({
      input: "A".repeat(32),
      create: true,
      maxAge: undefined,
    });
    expect(result).toBeInstanceOf(Function);
  });
  it("calls init with maxAge", async () => {
    const sm = new SessionManager({
      constructor: Function,
    });
    const _init = sm.init.bind(sm);
    sm.init = jest.fn((...arg: Parameters<typeof sm.init>) => _init(...arg));
    sm.create("A".repeat(32), 1);
    expect(sm.init).toBeCalledWith({
      input: "A".repeat(32),
      create: true,
      maxAge: 1,
    });
  });
});
describe("SessionManager.get", () => {
  it("throws not exists error", async () => {
    expect(() =>
      new SessionManager({
        constructor: Function,
      }).get("not-exists")
    ).toThrowError();
  });
  it("returns object session", async () => {
    class Session {}
    const sm = new SessionManager({
      constructor: Session,
    });
    const session = sm.init({});
    expect(sm.get(session)).toBeInstanceOf(Session);
  });
  it("returns same object session", async () => {
    class Session {
      counter = 0;
    }
    const sm = new SessionManager({
      constructor: Session,
    });
    const session = sm.init({});
    sm.get(session).counter++;
    expect(sm.get(session).counter).toBe(1);
  });
});
describe("SessionManager.gc", () => {
  it("deletes sessions", async () => {
    const sm = new SessionManager({
      constructor: Function,
    });
    freezeDateNow((now) => {
      const session = sm.init({});
      sm.options.gargabeCollector.maxAge = 1;
      sm.getData(session).datetime = now - 1;
      expect(sm.gc()).toBe(1);
    });
  });
  it("does not delete sessions", async () => {
    const sm = new SessionManager({
      constructor: Function,
    });
    freezeDateNow((now) => {
      const session = sm.init({});
      sm.options.gargabeCollector.maxAge = 1;
      sm.getData(session).datetime = now;
      expect(sm.gc()).toBe(0);
    });
  });
  it("does not delete sessions due to 'maxAge' infinity value", async () => {
    const sm = new SessionManager({
      constructor: Function,
    });
    freezeDateNow((now) => {
      const session = sm.init({ maxAge: -1 });
      sm.options.gargabeCollector.maxAge = 1;
      sm.getData(session).datetime = now - 1;
      expect(sm.gc()).toBe(0);
    });
  });
});
