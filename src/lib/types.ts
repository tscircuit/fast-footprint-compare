export type PreviewPadShape = 'circle' | 'pill' | 'rect'
export type PreviewPadKind = 'plated-hole' | 'smt'
export type InputField = 'footprinterString' | 'jlcpcbPartNumber'

export interface PreviewPad {
  cornerRadius?: number
  height: number
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
  subtitle: string
  title: string
}

export interface CompareResponse {
  left: FootprintPreview
  right: FootprintPreview
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
