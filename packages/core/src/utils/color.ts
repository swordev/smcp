export const colorCodes = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  gray: 90,
} as const;

export type ColorType = keyof typeof colorCodes;

export function getColorCode(name: ColorType) {
  const code = colorCodes[name];
  if (!code) throw new Error(`Color not found: ${name}`);
  return code;
}

export function color(name: ColorType, text: string) {
  const code = getColorCode(name);
  return `\x1b[${code}m${text}\x1b[0m`;
}
