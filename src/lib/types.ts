export type PreviewPadShape = 'circle' | 'pill' | 'rect'
export type PreviewPadKind = 'plated-hole' | 'smt'
export type InputField = 'footprinterString' | 'jlcpcbPartNumber'

export interface PreviewHole {
  height: number
  offsetX: number
  offsetY: number
  rotation: number
  shape: PreviewPadShape
  width: number
}

export interface PreviewPad {
  cornerRadius?: number
  height: number
  hole?: PreviewHole
  id: string
  kind: PreviewPadKind
  layer: string
  portHints: string[]
  rotation: number
  shape: PreviewPadShape
  width: number
  x: number
  y: number
}

export interface FootprintPreview {
  pads: PreviewPad[]
  sourceHints?: string[]
  subtitle: string
  title: string
}

export interface CompareResponse {
  copperIntersectionOverUnion: number
  holeIntersectionOverUnion: number
  left: FootprintPreview
  right: FootprintPreview
}

export interface FootprinterDiscoveryCandidate {
  copperIntersectionOverUnion: number
  domainScore: number
  family: string
  footprinterString: string
  geometryScore: number
  optimizedParameters: Partial<
    Record<
      'p' | 'w' | 'h' | 'pw' | 'ph' | 'pl' | 'pad' | 'ball' | 'od' | 'id',
      number
    >
  >
  rankingScore: number
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

export interface Bounds {
  height: number
  maxX: number
  maxY: number
  minX: number
  minY: number
  width: number
}

export interface RasterComparison {
  coverageLeft: number
  coverageRight: number
  gridSize: number
  iou: number
  leftOnlyRatio: number
  normalizedLeft: FootprintPreview
  normalizedRight: FootprintPreview
  occupancy: Uint8Array
  padCountMatch: boolean
  rightOnlyRatio: number
}
