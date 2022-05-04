export class JSONParseError extends Error {}

export function parseJSON(value: string) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new JSONParseError((error as Error).message);
  }
}
