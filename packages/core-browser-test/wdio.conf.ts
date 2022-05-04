import { compilerOptions } from "./tsconfig.json";
import type { Options } from "@wdio/types";

const gpu = (process.env["GPU"] ?? "0") !== "0";

export const config: Options.Testrunner = {
  specs: ["./src/**/*.test.ts"],
  autoCompileOpts: {
    tsConfigPathsOpts: {
      baseUrl: compilerOptions.baseUrl,
      paths: compilerOptions.paths,
    },
  },
  capabilities: [
    {
      maxInstances: 5,
      browserName: "chrome",
      acceptInsecureCerts: true,
      ...(!gpu && {
        "goog:chromeOptions": {
          args: ["--headless", "--disable-gpu"],
        },
      }),
    },
  ],
  services: ["chromedriver"],
  framework: "mocha",
  reporters: ["spec"],
};
