import { include } from "./module";

export type URL = globalThis.URL;
export const URL = include(["url", "URL"], globalThis.URL);
