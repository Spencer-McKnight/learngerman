/**
 * Joins class names, dropping falsy entries. No dependency, no dedupe:
 * callers put their overrides last and keep variant tables conflict-free.
 */
export type ClassValue = string | number | false | null | undefined | ClassValue[];

export function cn(...values: ClassValue[]): string {
  let out = "";
  for (const value of values) {
    if (!value) continue;
    const str = Array.isArray(value) ? cn(...value) : String(value);
    if (str) out = out ? `${out} ${str}` : str;
  }
  return out;
}
