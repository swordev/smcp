export const requireNodeModule = (path: string) => eval("require")(path);
export const include = <T = unknown>(
  module: [string, string] | string,
  object?: T
): T => {
  if (typeof object !== "undefined" && object !== null) return object;
  if (typeof module === "string") {
    return requireNodeModule(module);
  } else {
    return requireNodeModule(module[0])[module[1]];
  }
};
