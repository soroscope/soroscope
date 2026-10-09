/** Maturity of this package. Nothing here is implemented yet. */
export const status = 'scaffold' as const;

export interface TomlIssue {
  /** Dotted path of the offending field. */
  path: string;
  severity: 'error' | 'warning';
  message: string;
}
