import type apiType from "../server/api";
import configs from "../server/configs";
import { Client } from "@smcp/core/Client";

const client = new Client<typeof apiType>({
  configs,
});

const expose = { Client, client, api: client.api };

Object.entries(expose).forEach(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ([name, value]) => ((globalThis as any)[name] = value)
);
