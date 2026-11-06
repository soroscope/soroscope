/**
 * Maturity of this package. `preview`: a call can be simulated on several
 * providers at once and the fields they disagree on named. The comparison is
 * tested on responses recorded from real providers.
 */
export const status = 'preview' as const;

export { compareProviders, describeDifferential, differentialSimulate } from './differential';
export type {
  DifferentialOptions,
  DifferentialReport,
  FieldDisagreement,
  ProviderAnswer,
  ValueGroup,
} from './differential';
