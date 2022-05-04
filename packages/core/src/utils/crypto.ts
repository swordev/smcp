import { include } from "./module";

export const crypto = include(["crypto", "webcrypto"], globalThis.crypto);

export function int2hex(int: number) {
  return ("0" + int.toString(16)).slice(-2);
}

export function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  return crypto.getRandomValues(bytes);
}

export function randomChars(length: number) {
  const bytes = randomBytes(Math.ceil(length / 2));
  return Array.from(bytes).map(int2hex).join("").slice(0, length);
}
