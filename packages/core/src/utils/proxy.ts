export function createProxy(
  onCall: (path: string, args: unknown[]) => Promise<unknown>
) {
  const get = (path: string[]): unknown =>
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    new Proxy(() => {}, {
      get: (_, name) => get([...path, name.toString()]),
      apply: async (_, __, args) => await onCall(`/${path.join("/")}`, args),
    });
  return get([]);
}

export function parsePath(path: string) {
  const pathLevels = path.split("/").slice(1);
  const classLevels = pathLevels.slice(0, -1);
  const methodLevel = pathLevels.slice(-1)[0];
  return [classLevels, methodLevel] as [string[], string];
}
