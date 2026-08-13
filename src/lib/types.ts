import type {
  FootprinterDiscoveryCandidate,
} from 'circuit-json-to-footprinter'
import type {
  Bounds,
  CopperComparisonSummary,
  Footprint,
  PinMismatchDetail,
  RasterComparison,
} from 'circuit-json-to-footprinter/compare'

export type {
  Bounds,
  CopperComparisonSummary,
  Footprint,
  FootprinterDiscoveryCandidate,
  PinMismatchDetail,
  RasterComparison,
}

export type InputField = 'footprinterString' | 'jlcpcbPartNumber'

export interface CompareResponse extends CopperComparisonSummary {
  left: Footprint
  right: Footprint
}

export interface DiscoverResponse {
  best: FootprinterDiscoveryCandidate
  candidates: FootprinterDiscoveryCandidate[]
  comparison: CompareResponse
  diagnostics: {
    evaluatedSeeds: number
    optimizedSeeds: number
    targetPadCount: number
    topology: string
  }
}

export interface ApiErrorPayload {
  code: string
  field?: InputField
  fieldErrors?: Partial<Record<InputField, string>>
  hint?: string
  message: string
}

export interface ApiErrorResponse {
  error: ApiErrorPayload
}
