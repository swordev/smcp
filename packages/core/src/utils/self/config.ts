import { ConfigType } from "../ejson";
import type { ConstructorType } from "../ts";

export function makeConfig<TD, TE>(
  config: ConfigType<TD, TE>
): ConfigType<TD, TE>;
export function makeConfig<TD extends { toJSON(): unknown }>(
  config: ConfigType<TD, ReturnType<TD["toJSON"]>>
): ConfigType<TD, ReturnType<TD["toJSON"]>>;
export function makeConfig<TD>(
  config: ConfigType<TD, void>
): ConfigType<TD, void>;
export function makeConfig<TD, TE>(config: ConfigType<TD, TE>) {
  return config;
}

export function makeErrorConfig<TError extends ConstructorType>(
  constructor: TError
) {
  const hasJsonMethod = typeof constructor.prototype.toJSON === "function";
  return makeConfig<Error, Record<string, unknown>>({
    test: (o) => o instanceof constructor,
    ...(!hasJsonMethod && {
      encode: (o) => {
        const result: Record<string, unknown> = {};
        for (const key of Object.getOwnPropertyNames(o))
          result[key] = o[key as keyof typeof o];
        return result;
      },
    }),
    decode: (o) => {
      const error = new constructor(o.message);
      for (const key in o) error[key] = o[key];
      return error as unknown as Error;
    },
  });
}

export function makeErrorConfigs<TError extends ConstructorType>(
  constructors: TError[]
) {
  return [...constructors].map((constructor) => makeErrorConfig(constructor));
}
