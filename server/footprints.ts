import { fp } from '@tscircuit/footprinter'
import {
  EasyEdaJsonSchema,
  convertEasyEdaJsonToCircuitJson,
  fetchEasyEDAComponent,
} from 'easyeda'

type PreviewPadShape = 'circle' | 'pill' | 'rect'
type PreviewPadKind = 'plated-hole' | 'smt'
export type InputField = 'footprinterString' | 'jlcpcbPartNumber'

const directJlcPartNumberPattern = /^C(\d+)$/i

interface PreviewBuildErrorOptions {
  code: string
  field?: InputField
  fieldErrors?: Partial<Record<InputField, string>>
  hint?: string
  message: string
  status?: number
}

export class PreviewBuildError extends Error {
  code: string
  field?: InputField
  fieldErrors?: Partial<Record<InputField, string>>
  hint?: string
  status: number

  constructor({
    code,
    field,
    fieldErrors,
    hint,
    message,
    status = 400,
  }: PreviewBuildErrorOptions) {
    super(message)
    this.code = code
    this.field = field
    this.fieldErrors =
      fieldErrors ??
      (field
        ? ({
            [field]: message,
          } as Partial<Record<InputField, string>>)
        : undefined)
    this.hint = hint
    this.name = 'PreviewBuildError'
    this.status = status
  }
}

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

type CircuitElement = Record<string, unknown> & {
  type: string
}

const normalizePortHint = (hint: string) => {
  const trimmed = hint.trim()
  const pinMatch = trimmed.match(/^pin(\d+)$/i)
  if (pinMatch) return `pin${pinMatch[1]}`

  const numericMatch = trimmed.match(/^(\d+)$/)
  if (numericMatch) return `pin${numericMatch[1]}`

  return trimmed
}

const normalizeShape = (
  shape: unknown,
  width: number,
  height: number,
): PreviewPadShape => {
  const lowerShape = typeof shape === 'string' ? shape.toLowerCase() : 'rect'

  if (lowerShape === 'circle' || lowerShape === 'ellipse') return 'circle'
  if (lowerShape === 'pill' || lowerShape === 'oval') return 'pill'
  if (Math.abs(width - height) < 0.00001 && lowerShape === 'round') return 'circle'
  return 'rect'
}

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected error'

const createFootprinterBuildError = (
  footprinterString: string,
  error: unknown,
): PreviewBuildError => {
  const message = getErrorMessage(error).trim()

  return new PreviewBuildError({
    code: message.includes('Invalid footprint function')
      ? 'FOOTPRINTER_INVALID'
      : 'FOOTPRINTER_BUILD_FAILED',
    field: 'footprinterString',
    hint: 'Only footprint strings that @tscircuit/footprinter can build are accepted here.',
    message: message || `Footprinter could not build "${footprinterString}".`,
  })
}

const normalizeJlcpcbPartNumber = (jlcpcbPartNumber: string) => {
  const normalizedInput = jlcpcbPartNumber.trim().toUpperCase()
  const directPartMatch = normalizedInput.match(directJlcPartNumberPattern)

  if (!normalizedInput) {
    throw new PreviewBuildError({
      code: 'JLCPCB_REQUIRED',
      field: 'jlcpcbPartNumber',
      hint: 'Enter the JLCPCB part number before comparing.',
      message: 'JLCPCB part number is required.',
    })
  }

  if (!directPartMatch) {
    throw new PreviewBuildError({
      code: 'JLCPCB_FORMAT_INVALID',
      field: 'jlcpcbPartNumber',
      hint: 'Use the exact JLCPCB/LCSC supplier number with the C prefix.',
      message: `"${jlcpcbPartNumber.trim()}" is not a valid exact JLCPCB/LCSC part number.`,
    })
  }

  return `C${directPartMatch[1]}`
}

const getPadCornerRadius = (
  element: CircuitElement,
  width: number,
  height: number,
) => {
  const radius = toNumber(
    element.corner_radius ?? element.cornerRadius ?? element.rect_border_radius,
  )

  if (radius <= 0) return undefined
  return Math.min(radius, width / 2, height / 2)
}

const extractPads = (circuitJson: CircuitElement[]) =>
  circuitJson.flatMap((element, index): PreviewPad[] => {
    if (element.type === 'pcb_smtpad') {
      const width = toNumber(element.width)
      const height = toNumber(element.height)

      return [
        {
          cornerRadius: getPadCornerRadius(element, width, height),
          height,
          id: String(element.pcb_smtpad_id ?? `pcb_smtpad_${index + 1}`),
          kind: 'smt',
          layer: String(element.layer ?? 'top'),
          portHints: Array.isArray(element.port_hints)
            ? element.port_hints.map((hint) => normalizePortHint(String(hint)))
            : [],
          rotation: toNumber(element.rotation),
          shape: normalizeShape(element.shape, width, height),
          width,
          x: toNumber(element.x),
          y: toNumber(element.y),
        },
      ]
    }

    if (element.type === 'pcb_plated_hole') {
      const width = toNumber(
        element.width ?? element.outer_diameter ?? element.outerDiameter,
        0.6,
      )
      const height = toNumber(element.height, width)

      return [
        {
          cornerRadius: getPadCornerRadius(element, width, height),
          height,
          id: String(element.pcb_plated_hole_id ?? `pcb_plated_hole_${index + 1}`),
          kind: 'plated-hole',
          layer: Array.isArray(element.layers)
            ? String(element.layers[0] ?? 'top')
            : 'top',
          portHints: Array.isArray(element.port_hints)
            ? element.port_hints.map((hint) => normalizePortHint(String(hint)))
            : [],
          rotation: toNumber(element.rotation),
          shape: normalizeShape(element.shape ?? 'circle', width, height),
          width,
          x: toNumber(element.x),
          y: toNumber(element.y),
        },
      ]
    }

    return []
  })

export const buildFootprinterPreview = (
  footprinterString: string,
): FootprintPreview => {
  const normalizedString = footprinterString.trim()
  if (!normalizedString) {
    throw new PreviewBuildError({
      code: 'FOOTPRINTER_REQUIRED',
      field: 'footprinterString',
      hint: 'Enter a footprinter string before comparing.',
      message: 'Footprinter string is required.',
    })
  }

  let circuitJson: CircuitElement[]

  try {
    circuitJson = fp.string(normalizedString).circuitJson() as CircuitElement[]
  } catch (error) {
    throw createFootprinterBuildError(normalizedString, error)
  }

  const pads = extractPads(circuitJson)

  if (!pads.length) {
    throw new PreviewBuildError({
      code: 'FOOTPRINTER_NO_PADS',
      field: 'footprinterString',
      hint: 'Use a footprinter string that generates actual PCB pads.',
      message: `Footprinter built "${normalizedString}" but it did not produce any PCB pads.`,
    })
  }

  return {
    pads,
    subtitle: 'Validated directly by @tscircuit/footprinter',
    title: normalizedString,
  }
}

export const buildJlcpcbPreview = async (
  jlcpcbPartNumber: string,
): Promise<FootprintPreview> => {
  const normalizedPartNumber = normalizeJlcpcbPartNumber(jlcpcbPartNumber)

  let rawComponent: unknown

  try {
    rawComponent = await fetchEasyEDAComponent(normalizedPartNumber, {
      includeModelMetadata: false,
    })
  } catch (error) {
    const message = getErrorMessage(error)

    if (message.includes('Component not found')) {
      throw new PreviewBuildError({
        code: 'JLCPCB_NOT_FOUND',
        field: 'jlcpcbPartNumber',
        hint: 'Check the exact JLCPCB/LCSC part number and try again.',
        message: `JLCPCB component not found for part number "${normalizedPartNumber}".`,
        status: 404,
      })
    }

    throw new PreviewBuildError({
      code: 'JLCPCB_LOAD_FAILED',
      field: 'jlcpcbPartNumber',
      hint: 'Try again in a moment or verify the part number is valid.',
      message: `Could not load EasyEDA data for "${normalizedPartNumber}".`,
      status: 502,
    })
  }

  let parsedComponent: ReturnType<typeof EasyEdaJsonSchema.parse>

  try {
    parsedComponent = EasyEdaJsonSchema.parse(rawComponent)
  } catch {
    throw new PreviewBuildError({
      code: 'JLCPCB_INVALID',
      field: 'jlcpcbPartNumber',
      hint: 'Verify the JLCPCB part exists and exposes footprint data in EasyEDA.',
      message: `EasyEDA returned invalid footprint data for "${normalizedPartNumber}".`,
      status: 502,
    })
  }

  const resolvedPartNumber = parsedComponent.lcsc.number.trim().toUpperCase()

  if (resolvedPartNumber !== normalizedPartNumber) {
    throw new PreviewBuildError({
      code: 'JLCPCB_EXACT_MATCH_REQUIRED',
      field: 'jlcpcbPartNumber',
      hint: 'Only exact JLCPCB/LCSC supplier numbers are accepted here.',
      message: `EasyEDA resolved "${resolvedPartNumber}" for "${normalizedPartNumber}". This tool only accepts exact part-number matches.`,
      status: 404,
    })
  }

  const circuitJson = convertEasyEdaJsonToCircuitJson(parsedComponent) as CircuitElement[]
  const pads = extractPads(circuitJson)
  if (!pads.length) {
    throw new PreviewBuildError({
      code: 'JLCPCB_NO_PADS',
      field: 'jlcpcbPartNumber',
      hint: 'Try another exact JLCPCB part number or verify its package data.',
      message: `EasyEDA found "${normalizedPartNumber}" but no footprint pads were available.`,
      status: 422,
    })
  }

  return {
    pads,
    subtitle: parsedComponent.title ?? 'Validated directly by EasyEDA',
    title: parsedComponent.lcsc.number,
  }
}
