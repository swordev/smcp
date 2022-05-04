export function encode(object: Record<string, string | number>) {
  return Object.entries(object)
    .map(([key, value]) => `${key}=${encodeURIComponent(value ?? "")}`)
    .join("&");
}
