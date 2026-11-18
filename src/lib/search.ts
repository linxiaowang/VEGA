/** 统一成可比较的搜索键：去空白、小写 */
export function normalizeQuery(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, "");
}

/** 大小写不敏感的模糊包含 */
export function fuzzyIncludes(haystack: string, needle: string) {
  if (!needle) return true;
  return normalizeQuery(haystack).includes(normalizeQuery(needle));
}

/** 任一字段命中即可 */
export function fuzzyMatchAny(fields: Array<string | undefined | null>, query: string) {
  const q = normalizeQuery(query);
  if (!q) return false;
  return fields.some((field) => field != null && fuzzyIncludes(field, q));
}

/** 前缀匹配优先，便于排序 */
export function matchScore(fields: Array<string | undefined | null>, query: string) {
  const q = normalizeQuery(query);
  if (!q) return 0;
  let best = 0;
  for (const field of fields) {
    if (field == null) continue;
    const value = normalizeQuery(field);
    if (value === q) best = Math.max(best, 100);
    else if (value.startsWith(q)) best = Math.max(best, 80);
    else if (value.includes(q)) best = Math.max(best, 40);
  }
  return best;
}
