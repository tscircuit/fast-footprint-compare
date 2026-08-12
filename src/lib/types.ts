import type {
  FootprinterDiscoveryCandidate,
} from 'circuit-json-to-footprinter'
import type {
  Bounds,
  Footprint,
  RasterComparison,
} from 'circuit-json-to-footprinter/compare'

export type {
  Bounds,
  Footprint,
  FootprinterDiscoveryCandidate,
  RasterComparison,
}

export type InputField = 'footprinterString' | 'jlcpcbPartNumber'

export interface PinMismatchDetail {
  leftPadIndex: number | null
  leftPinNumbers: number[]
  leftPortHints: string[]
  rightPadIndex: number | null
  rightPinNumbers: number[]
  rightPortHints: string[]
}

export interface PinComparisonSummary {
  pinMatchRate: number
  pinMismatches: PinMismatchDetail[]
  pinsMatch: boolean
}

export type PinAwareFootprinterDiscoveryCandidate =
  FootprinterDiscoveryCandidate & PinComparisonSummary

export interface CompareResponse extends PinComparisonSummary {
  copperIntersectionOverUnion: number
  holeIntersectionOverUnion: number
  left: Footprint
  right: Footprint
}

export interface DiscoverResponse {
  best: PinAwareFootprinterDiscoveryCandidate
  candidates: PinAwareFootprinterDiscoveryCandidate[]
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
