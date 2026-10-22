/**
 * The WHERE clause for "the column is any of these values", where null stands for "has none".
 * Null when the list is empty or missing: the filter is not applied.
 */
export function inListCondition(
  column: string,
  values: (string | null)[] | undefined,
  param: string,
): { sql: string; params: Record<string, string[]> } | null {
  if (!values?.length) return null;
  const ids = values.filter((v): v is string => v !== null);
  const parts: string[] = [];
  if (ids.length) parts.push(`${column} IN (:...${param})`);
  if (ids.length !== values.length) parts.push(`${column} IS NULL`);
  return { sql: parts.length > 1 ? `(${parts.join(' OR ')})` : parts[0], params: ids.length ? { [param]: ids } : {} };
}
