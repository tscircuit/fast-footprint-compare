import type {
  Bounds,
  FootprintPreview,
  FootprinterDiscoveryCandidate,
  PreviewHole,
  PreviewPad,
  PreviewPadKind,
  PreviewPadShape,
  RasterComparison,
} from 'circuit-json-to-footprinter'

export type {
  Bounds,
  FootprintPreview,
  FootprinterDiscoveryCandidate,
  PreviewHole,
  PreviewPad,
  PreviewPadKind,
  PreviewPadShape,
  RasterComparison,
}

export type InputField = 'footprinterString' | 'jlcpcbPartNumber'

export interface CompareResponse {
  copperIntersectionOverUnion: number
  holeIntersectionOverUnion: number
  left: FootprintPreview
  right: FootprintPreview
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
