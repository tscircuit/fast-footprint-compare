import { z } from 'zod'

const directJlcPartNumberPattern = /^C(\d+)$/i
const compareRequestSchema = z.object({
  footprinterString: z.string().trim().min(1, 'Footprinter string is required.'),
  jlcpcbPartNumber: z
    .string()
    .trim()
    .min(1, 'JLCPCB part number is required.')
    .refine(
      (value) => /^C\d+$/i.test(value),
      'Enter an exact JLCPCB part number with the C prefix, like C2040 or C2149796.',
    ),
})

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
}

let footprinterModulePromise
let easyedaModulePromise

class PreviewBuildError extends Error {
  constructor({
    code,
    field,
    fieldErrors,
    hint,
    message,
    status = 400,
  }) {
    super(message)
    this.code = code
    this.field = field
    this.fieldErrors =
      fieldErrors ??
      (field
        ? {
            [field]: message,
          }
        : undefined)
    this.hint = hint
    this.name = 'PreviewBuildError'
    this.status = status
  }
}

const createJsonResponse = (
  body,
  status,
  extraHeaders = {},
) =>
  new Response(JSON.stringify(body), {
    headers: {
      ...jsonHeaders,
      ...extraHeaders,
    },
    status,
  })

const getErrorMessage = (error) =>
  error instanceof Error ? error.message : 'Unexpected error'

const loadFootprinterModule = async () => {
  try {
    footprinterModulePromise ??= import('@tscircuit/footprinter')
    return await footprinterModulePromise
  } catch (error) {
    footprinterModulePromise = undefined
    throw new PreviewBuildError({
      code: 'FOOTPRINTER_RUNTIME_UNAVAILABLE',
      field: 'footprinterString',
      hint: 'The server could not load the footprinter runtime.',
      message: `The server could not load @tscircuit/footprinter. ${getErrorMessage(error)}`,
      status: 500,
    })
  }
}

const loadEasyedaModule = async () => {
  try {
    easyedaModulePromise ??= import('easyeda/browser')
    return await easyedaModulePromise
  } catch (error) {
    easyedaModulePromise = undefined
    throw new PreviewBuildError({
      code: 'JLCPCB_RUNTIME_UNAVAILABLE',
      field: 'jlcpcbPartNumber',
      hint: 'The server could not load the EasyEDA runtime.',
      message: `The server could not load the EasyEDA runtime. ${getErrorMessage(error)}`,
      status: 500,
    })
  }
}

const normalizePortHint = (hint) => {
  const trimmed = hint.trim()
  const pinMatch = trimmed.match(/^pin(\d+)$/i)
  if (pinMatch) return `pin${pinMatch[1]}`

  const numericMatch = trimmed.match(/^(\d+)$/)
  if (numericMatch) return `pin${numericMatch[1]}`

  return trimmed
}

const normalizeShape = (shape, width, height) => {
  const lowerShape = typeof shape === 'string' ? shape.toLowerCase() : 'rect'

  if (lowerShape === 'circle' || lowerShape === 'ellipse') return 'circle'
  if (lowerShape === 'pill' || lowerShape === 'oval') return 'pill'
  if (Math.abs(width - height) < 0.00001 && lowerShape === 'round') return 'circle'
  return 'rect'
}

const toNumber = (value, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

const createFootprinterBuildError = (footprinterString, error) => {
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

const normalizeJlcpcbPartNumber = (jlcpcbPartNumber) => {
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

const getPadCornerRadius = (element, width, height) => {
  const radius = toNumber(
    element.corner_radius ?? element.cornerRadius ?? element.rect_border_radius,
  )

  if (radius <= 0) return undefined
  return Math.min(radius, width / 2, height / 2)
}

const extractPads = (circuitJson) =>
  circuitJson.flatMap((element, index) => {
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

const buildFootprinterPreview = async (footprinterString) => {
  const normalizedString = footprinterString.trim()
  if (!normalizedString) {
    throw new PreviewBuildError({
      code: 'FOOTPRINTER_REQUIRED',
      field: 'footprinterString',
      hint: 'Enter a footprinter string before comparing.',
      message: 'Footprinter string is required.',
    })
  }

  let circuitJson

  try {
    const { fp } = await loadFootprinterModule()
    circuitJson = fp.string(normalizedString).circuitJson()
  } catch (error) {
    if (error instanceof PreviewBuildError) throw error
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

const buildJlcpcbPreview = async (jlcpcbPartNumber) => {
  const normalizedPartNumber = normalizeJlcpcbPartNumber(jlcpcbPartNumber)
  const {
    EasyEdaJsonSchema,
    convertEasyEdaJsonToCircuitJson,
    fetchEasyEDAComponent,
  } = await loadEasyedaModule()

  let rawComponent

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

  let parsedComponent

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

const normalizeValidationMessage = (field, message) => {
  if (!message || message === 'Required') {
    return field === 'footprinterString'
      ? 'Footprinter string is required.'
      : 'JLCPCB part number is required.'
  }

  return message
}

const getFieldErrors = (fieldErrors) => {
  const nextFieldErrors = {}

  if (fieldErrors.footprinterString) {
    nextFieldErrors.footprinterString = normalizeValidationMessage(
      'footprinterString',
      fieldErrors.footprinterString[0],
    )
  }

  if (fieldErrors.jlcpcbPartNumber) {
    nextFieldErrors.jlcpcbPartNumber = normalizeValidationMessage(
      'jlcpcbPartNumber',
      fieldErrors.jlcpcbPartNumber[0],
    )
  }

  return nextFieldErrors
}

const createInvalidJsonResponse = () => ({
  body: {
    error: {
      code: 'COMPARE_INPUT_INVALID_JSON',
      hint: 'Send a JSON body with footprinterString and jlcpcbPartNumber.',
      message: 'Request body must be valid JSON.',
    },
  },
  status: 400,
})

const createMethodNotAllowedResponse = () => ({
  body: {
    error: {
      code: 'METHOD_NOT_ALLOWED',
      hint: 'Use POST /api/compare.',
      message: 'Only POST is supported on this endpoint.',
    },
  },
  status: 405,
})

const createPreviewErrorResponse = (error) => ({
  body: {
    error: {
      code: error.code,
      field: error.field,
      fieldErrors: error.fieldErrors,
      hint: error.hint,
      message: error.message,
    },
  },
  status: error.status,
})

const createUnexpectedErrorResponse = (error) => ({
  body: {
    error: {
      code: 'UNEXPECTED_ERROR',
      hint: 'Try again. If the problem continues, check the server logs.',
      message: getErrorMessage(error),
    },
  },
  status: 500,
})

const handleCompareRequest = async (requestBody) => {
  const parsed = compareRequestSchema.safeParse(requestBody)

  if (!parsed.success) {
    const fieldErrors = getFieldErrors(parsed.error.flatten().fieldErrors)
    const message =
      fieldErrors.footprinterString && fieldErrors.jlcpcbPartNumber
        ? 'Footprinter string and JLCPCB part number are required.'
        : fieldErrors.footprinterString ??
          fieldErrors.jlcpcbPartNumber ??
          'Please complete the required fields.'

    return {
      body: {
        error: {
          code: 'COMPARE_INPUT_INVALID',
          fieldErrors,
          hint: 'Enter both values to validate them before running analysis.',
          message,
        },
      },
      status: 400,
    }
  }

  try {
    const [left, right] = await Promise.all([
      buildFootprinterPreview(parsed.data.footprinterString),
      buildJlcpcbPreview(parsed.data.jlcpcbPartNumber),
    ])

    return {
      body: { left, right },
      status: 200,
    }
  } catch (error) {
    if (error instanceof PreviewBuildError) {
      return createPreviewErrorResponse(error)
    }

    return createUnexpectedErrorResponse(error)
  }
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      const result = createMethodNotAllowedResponse()
      return createJsonResponse(result.body, result.status, {
        allow: 'POST',
      })
    }

    let requestBody

    try {
      requestBody = await request.json()
    } catch {
      const result = createInvalidJsonResponse()
      return createJsonResponse(result.body, result.status)
    }

    const result = await handleCompareRequest(requestBody)
    return createJsonResponse(result.body, result.status)
  },
}
