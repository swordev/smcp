import anymatch from "anymatch";
import { normalize } from "path";

export function deleteCache(patterns: string[]) {
  let matches = 0;
  patterns = patterns.map((v) => normalize(v).replace(/\\/g, "/"));
  for (const id in require.cache) {
    if (anymatch(patterns, id)) {
      delete require.cache[id];
      matches++;
    }
  }
  return matches;
}
