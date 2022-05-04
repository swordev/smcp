import { File } from "./utils/buffer";
import { ConfigsType } from "./utils/ejson";
import { makeConfig, makeErrorConfig } from "./utils/self/config";
import type { Writeable } from "./utils/ts";

export const file = makeConfig<
  File,
  {
    name: string;
    size: number;
    lastModified: number;
    type: string;
  }
>({
  test: (o) => o instanceof (globalThis.File ?? File),
  encode: (o) => ({
    name: o.name,
    size: o.size,
    lastModified: o.lastModified,
    type: o.type,
  }),
  stream: (o) => {
    return globalThis.File
      ? (o as unknown as Blob)
      : (o.stream() as unknown as Blob);
  },
  decode: (o, { stream }) => {
    const file: Writeable<File> = new File([], o.name);
    file.size = o.size;
    file.lastModified = o.lastModified;
    file.type = o.type;
    if (!stream) throw new Error(`Stream is not defined`);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    file.stream = () => {
      return stream();
    };
    return file as File;
  },
});

export const error = makeErrorConfig(Error);
export const configs = [file, error] as ConfigsType;
export default configs;
