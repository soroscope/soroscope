/** Maturity of this package. Nothing here is implemented yet. */
export const status = 'scaffold' as const;

export interface DifferentialOptions {
  /** Providers to compare. */
  providers: readonly string[];
}
