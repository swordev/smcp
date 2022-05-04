import { merge, StrictMap } from "./utils/object";
import { PartialPicker } from "./utils/ts";
import { parse, serialize } from "cookie";
import { randomBytes } from "crypto";
import { DeepPartial, DeepReadonly } from "ts-essentials";

export type OptionsType<T> = {
  cookieLength: number;
  constructor: { new (): T };
  gargabeCollector: {
    maxAge?: number;
    rutineInterval?: number | false;
  };
};

export type ConstructorOptionsType<T> = PartialPicker<
  OptionsType<T>,
  "cookieLength" | "gargabeCollector"
>;

type SessionDataType<TObject> = {
  datetime: number;
  maxAge?: number;
  object: TObject;
};

export class SessionManager<TObject> {
  readonly options: OptionsType<TObject>;
  protected data: StrictMap<string, SessionDataType<TObject>> = new Map();
  protected interval: NodeJS.Timeout | undefined;
  constructor(options: DeepReadonly<ConstructorOptionsType<TObject>>) {
    this.options = {
      cookieLength: 32,
      gargabeCollector: {
        maxAge: 60_000 * 60 * 2,
        rutineInterval: 60_000 * 5,
        ...(options.gargabeCollector ?? {}),
      },
      ...options,
    };
  }
  updateOptions(options: DeepPartial<OptionsType<TObject>>) {
    merge(this.options, options);
  }
  getData(session: string) {
    return this.data.get(session);
  }
  get(session: string) {
    return this.getData(session).object;
  }
  create(session: string, maxAge?: number) {
    this.init({ input: session, create: true, maxAge });
    return this.get(session);
  }
  init(options: {
    input?: string | { headers: { cookie?: string | undefined } };
    response?: { setHeader: (name: string, value: string) => void };
    maxAge?: number;
    create?: boolean;
  }) {
    const length = this.options.cookieLength;
    let session = options.input;
    if (session && typeof session !== "string") {
      const cookies = parse(session.headers["cookie"] ?? "");
      session = cookies["session"];
    }
    if (!session || session.length !== length || !this.data.has(session)) {
      if (options.create) {
        if (!session) throw new Error(`Session key is required`);
      } else {
        session = randomBytes(length / 2 + 1)
          .toString("hex")
          .slice(0, length);
      }
      const sessionData: SessionDataType<TObject> = {
        datetime: Date.now(),
        object: new this.options.constructor(),
        maxAge: options.maxAge,
      };
      this.data.set(session, sessionData);
      if (options.response) {
        const cookie = serialize("session", session, {
          path: "/",
        });
        options.response.setHeader("Set-Cookie", cookie);
      }
    } else {
      const data = this.data.get(session);
      data.datetime = Date.now();
      if (typeof options.maxAge !== "undefined") data.maxAge = options.maxAge;
    }
    return session as string;
  }
  startGcRutine() {
    this.stopGcRutine();
    const ms = this.options.gargabeCollector?.rutineInterval;
    if (!ms) throw new Error(`'rutineInterval' is not defined`);
    this.interval = setInterval(() => this.gc(), ms);
  }
  stopGcRutine() {
    if (this.interval) clearInterval(this.interval);
    this.interval = undefined;
  }
  gc() {
    const now = Date.now();
    const globalMaxAge = this.options.gargabeCollector?.maxAge;
    if (!globalMaxAge) throw new Error(`'maxAge' is not defined`);
    let deleted = 0;
    for (const entry of this.data) {
      const [session, { datetime, maxAge }] = entry;
      const ms = maxAge ?? globalMaxAge;
      if (ms > -1 && now - datetime >= ms) {
        this.data.delete(session);
        deleted++;
      }
    }
    return deleted;
  }
}
