export function text(value: unknown): string {
  return value == null ? "" : String(value);
}

export function optionalText(value: unknown): string | null {
  const valueText = text(value);
  return valueText || null;
}

export function parsedJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parsedTags(value: unknown): string[] {
  const parsed = parsedJson<unknown>(value, []);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}
