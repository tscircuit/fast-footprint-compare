import {
  circuitJsonToFootprint,
  footprinterStringToFootprint,
  type Footprint,
} from 'circuit-json-to-footprinter'
import {
  EasyEdaJsonSchema,
  convertEasyEdaJsonToCircuitJson,
  fetchEasyEDAComponent,
} from 'easyeda'

export type { Footprint } from 'circuit-json-to-footprinter'
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

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected error'

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined

const collectJlcSourceHints = (rawComponent: unknown) => {
  const component = asRecord(rawComponent)
  const dataStr = asRecord(component?.dataStr)
  const head = asRecord(dataStr?.head)
  const componentParameters = asRecord(head?.c_para)
  const packageDetail = asRecord(component?.packageDetail)
  const packageDataStr = asRecord(packageDetail?.dataStr)
  const packageHead = asRecord(packageDataStr?.head)
  const packageParameters = asRecord(packageHead?.c_para)
  const lcsc = asRecord(component?.lcsc)
  const values = [
    component?.title,
    component?.description,
    componentParameters?.package,
    componentParameters?.pre,
    packageDetail?.title,
    packageParameters?.package,
    packageParameters?.pre,
    lcsc?.url,
    ...(Array.isArray(component?.tags) ? component.tags : []),
  ]

  return [
    ...new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ]
}

const createFootprinterBuildError = (
  footprinterString: string,
  error: unknown,
): PreviewBuildError => {
  const message = getErrorMessage(error).trim()
  const hasNoPads =
    message.includes('must contain at least one PCB SMT pad or plated hole') ||
    message.includes('must contain at least one PcbSmtPad or PcbPlatedHole')

  return new PreviewBuildError({
    code: hasNoPads
      ? 'FOOTPRINTER_NO_PADS'
      : message.includes('Invalid footprint function')
        ? 'FOOTPRINTER_INVALID'
        : 'FOOTPRINTER_BUILD_FAILED',
    field: 'footprinterString',
    hint: hasNoPads
      ? 'Use a footprinter string that generates actual PCB pads.'
      : 'Only footprint strings that @tscircuit/footprinter can build are accepted here.',
    message: hasNoPads
      ? `Footprinter built "${footprinterString}" but it did not produce any PCB pads.`
      : message || `Footprinter could not build "${footprinterString}".`,
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

export const buildFootprinterPreview = (
  footprinterString: string,
): Footprint => {
  const normalizedString = footprinterString.trim()
  if (!normalizedString) {
    throw new PreviewBuildError({
      code: 'FOOTPRINTER_REQUIRED',
      field: 'footprinterString',
      hint: 'Enter a footprinter string before comparing.',
      message: 'Footprinter string is required.',
    })
  }

  try {
    return {
      ...footprinterStringToFootprint(normalizedString),
      subtitle: 'Validated directly by @tscircuit/footprinter',
    }
  } catch (error) {
    throw createFootprinterBuildError(normalizedString, error)
  }
}

export interface JlcpcbFootprint {
  circuitJson: ReturnType<typeof convertEasyEdaJsonToCircuitJson>
  preview: Footprint
}

export const buildJlcpcbFootprint = async (
  jlcpcbPartNumber: string,
): Promise<JlcpcbFootprint> => {
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

  const circuitJson = convertEasyEdaJsonToCircuitJson(parsedComponent)
  let preview: Footprint

  try {
    preview = circuitJsonToFootprint(circuitJson, {
      sourceHints: collectJlcSourceHints(rawComponent),
      subtitle: parsedComponent.title ?? 'Validated directly by EasyEDA',
      title: parsedComponent.lcsc.number,
    })
  } catch {
    throw new PreviewBuildError({
      code: 'JLCPCB_NO_PADS',
      field: 'jlcpcbPartNumber',
      hint: 'Try another exact JLCPCB part number or verify its package data.',
      message: `EasyEDA found "${normalizedPartNumber}" but no footprint pads were available.`,
      status: 422,
    })
  }

  return { circuitJson, preview }
}

export const buildJlcpcbPreview = async (
  jlcpcbPartNumber: string,
): Promise<Footprint> =>
  (await buildJlcpcbFootprint(jlcpcbPartNumber)).preview
