const FORBIDDEN = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE',
  'TRUNCATE', 'GRANT', 'REVOKE', 'EXECUTE', 'CALL', 'COPY',
  'VACUUM', 'MERGE', 'REPLACE',
];

export function validateQuery(sql: string): void {
  const trimmed = sql.trim();

  if (!trimmed) throw new Error('Query cannot be empty');

  if (!/^(SELECT|WITH)\b/i.test(trimmed)) {
    throw new Error('Only SELECT queries are allowed. Query must start with SELECT or WITH.');
  }

  // Strip string literals before keyword scanning to avoid false positives on data values
  const stripped = trimmed
    .replace(/'([^'\\]|\\.)*'/g, "''")
    .replace(/\$\$[\s\S]*?\$\$/g, '$$$$');

  for (const kw of FORBIDDEN) {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(stripped)) {
      throw new Error(`Query contains forbidden keyword: ${kw}`);
    }
  }

  // Reject multiple statements (semicolon not at the very end)
  if (/;/.test(stripped.replace(/;\s*$/, ''))) {
    throw new Error('Multiple statements are not allowed');
  }
}

export function enforceLimit(sql: string, maxRows = 200): string {
  const trimmed = sql.trim().replace(/;\s*$/, '');
  if (/\bLIMIT\s+\d+/i.test(trimmed)) return trimmed;
  return `${trimmed} LIMIT ${maxRows}`;
}
