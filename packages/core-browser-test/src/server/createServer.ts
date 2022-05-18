import api from "./api";
import configs from "./configs";
import { Server, OptionsType } from "@smcp/core/Server";

export default async function createServer(
  port = 0,
  options: Omit<OptionsType<any, any, any>, "api"> = {}
) {
  const instance = new Server({
    configs,
    api,
    publicPath: __dirname + "/../../dist",
    ...options,
  });
  await instance.start(port);
  const address = `http://127.0.0.1:${instance.port}`;
  console.info(`Listening on ${address}`);
  return { instance, address } as const;
}
