import { createHash } from "node:crypto";
import { RuntimeIntegrationError } from "./runtime-integration-contract.js";

export function extractTomlFamily(contents: string, familyName: string): { text: string; ranges: Array<[number, number]> } | null {
  const header = /^\s*\[([^\]\r\n]+)\]\s*(?:#.*)?$/gm;
  const matches = [...contents.matchAll(header)];
  const ranges: Array<[number, number]> = [];
  for (let index = 0; index < matches.length; index += 1) {
    const name = matches[index][1].trim();
    if (name !== familyName && !name.startsWith(`${familyName}.`)) continue;
    ranges.push([matches[index].index!, matches[index + 1]?.index ?? contents.length]);
  }
  if (ranges.length === 0) return null;
  return { text: ranges.map(([start, end]) => contents.slice(start, end)).join("\n"), ranges };
}

export function replaceTomlFamily(contents: string, familyName: string, replacement: string | null): string {
  const family = extractTomlFamily(contents, familyName);
  let next = contents;
  let insertionIndex = contents.length;
  if (family) {
    insertionIndex = family.ranges[0][0];
    for (const [start, end] of [...family.ranges].reverse()) next = next.slice(0, start) + next.slice(end);
  }
  if (replacement == null) return normalizeTrailingNewline(next);
  const before = next.slice(0, insertionIndex).replace(/[ \t]+$/gm, "").replace(/\s*$/, "");
  const after = next.slice(insertionIndex).replace(/^\s*/, "");
  return `${before}${before ? "\n\n" : ""}${replacement.trim()}${after ? `\n\n${after}` : "\n"}`;
}

export function replaceTopLevelJsonProperty(
  original: string | null,
  root: Record<string, unknown>,
  key: string,
  value: unknown,
): string {
  if (original == null) return `${JSON.stringify({ ...root, [key]: value }, null, 2)}\n`;
  const span = findTopLevelJsonValueSpan(original, key);
  if (span) return original.slice(0, span[0]) + JSON.stringify(value) + original.slice(span[1]);
  return `${JSON.stringify({ ...root, [key]: value }, null, detectJsonIndent(original))}${original.endsWith("\n") ? "\n" : ""}`;
}

export function findTopLevelJsonValueSpan(contents: string, requestedKey: string): [number, number] | null {
  let index = skipWhitespace(contents, 0);
  if (contents[index] !== "{") return null;
  index += 1;
  while (index < contents.length) {
    index = skipWhitespace(contents, index);
    if (contents[index] === "}") return null;
    if (contents[index] !== '"') return null;
    const keyEnd = scanJsonString(contents, index);
    const key = JSON.parse(contents.slice(index, keyEnd)) as string;
    index = skipWhitespace(contents, keyEnd);
    if (contents[index] !== ":") return null;
    const valueStart = skipWhitespace(contents, index + 1);
    const valueEnd = scanJsonValue(contents, valueStart);
    if (key === requestedKey) return [valueStart, valueEnd];
    index = skipWhitespace(contents, valueEnd);
    if (contents[index] === ",") {
      index += 1;
      continue;
    }
    if (contents[index] === "}") return null;
    return null;
  }
  return null;
}

export function scanJsonString(contents: string, start: number): number {
  let escaped = false;
  for (let index = start + 1; index < contents.length; index += 1) {
    const character = contents[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') return index + 1;
  }
  throw new RuntimeIntegrationError("runtime.config_invalid", "JSON 字符串没有结束");
}

export function scanJsonValue(contents: string, start: number): number {
  const first = contents[start];
  if (first === '"') return scanJsonString(contents, start);
  if (first === "{" || first === "[") {
    const stack = [first];
    let inString = false;
    let escaped = false;
    for (let index = start + 1; index < contents.length; index += 1) {
      const character = contents[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === "{" || character === "[") stack.push(character);
      else if (character === "}" || character === "]") {
        stack.pop();
        if (stack.length === 0) return index + 1;
      }
    }
    throw new RuntimeIntegrationError("runtime.config_invalid", "JSON 值没有结束");
  }
  let index = start;
  while (index < contents.length && !/[\s,}]/.test(contents[index])) index += 1;
  return index;
}

export function parseJsonObject(contents: string, label: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(contents) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new RuntimeIntegrationError("runtime.config_invalid", `${label}不是有效 JSON，不会修改`);
  }
}

export function parseJsoncObject(contents: string, label: string): Record<string, unknown> {
  try {
    return parseJsonObject(contents, label);
  } catch (error) {
    if (!(error instanceof RuntimeIntegrationError)) throw error;
    return parseJsonObject(stripJsonc(contents), label);
  }
}

export function stripJsonc(contents: string): string {
  let result = "";
  let index = 0;
  let inString = false;
  let escaped = false;
  while (index < contents.length) {
    const character = contents[index];
    if (inString) {
      result += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      index += 1;
      continue;
    }
    if (character === '"') {
      inString = true;
      result += character;
      index += 1;
      continue;
    }
    if (character === "/" && contents[index + 1] === "/") {
      index += 2;
      while (index < contents.length && contents[index] !== "\n") index += 1;
      continue;
    }
    if (character === "/" && contents[index + 1] === "*") {
      index += 2;
      while (index < contents.length && !(contents[index] === "*" && contents[index + 1] === "/")) index += 1;
      index = Math.min(index + 2, contents.length);
      continue;
    }
    result += character;
    index += 1;
  }
  return result;
}

export function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function detectJsonIndent(contents: string): number {
  const match = contents.match(/\n( +)"/);
  return match ? Math.min(match[1].length, 8) : 2;
}

export function skipWhitespace(contents: string, start: number): number {
  let index = start;
  while (index < contents.length && /\s/.test(contents[index])) index += 1;
  return index;
}

export function tomlString(value: string): string {
  return JSON.stringify(value);
}

export function normalizeBlock(value: string): string {
  return value.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

export function normalizeTrailingNewline(value: string): string {
  const trimmed = value.replace(/[ \t]+$/gm, "").replace(/\s+$/, "");
  return trimmed ? `${trimmed}\n` : "";
}

export function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

