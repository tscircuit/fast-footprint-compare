import { z } from 'zod'
import {
  buildFootprinterPreview,
  buildJlcpcbPreview,
  PreviewBuildError,
  type FootprintPreview,
  type InputField,
} from './footprints.js'

const directJlcPartNumberPattern = /^C\d+$/i

export interface CompareResponse {
  left: FootprintPreview
  right: FootprintPreview
}

export interface CompareErrorPayload {
  code: string
  field?: InputField
  fieldErrors?: Partial<Record<InputField, string>>
  hint?: string
  message: string
}

export interface CompareErrorResponse {
  error: CompareErrorPayload
}

export interface CompareApiResult {
  body: CompareResponse | CompareErrorResponse
  status: number
}

export const compareRequestSchema = z.object({
  footprinterString: z.string().trim().min(1, 'Footprinter string is required.'),
  jlcpcbPartNumber: z
    .string()
    .trim()
    .min(1, 'JLCPCB part number is required.')
    .refine(
      (value) => directJlcPartNumberPattern.test(value),
      'Enter an exact JLCPCB part number with the C prefix, like C2040 or C2149796.',
    ),
})

type FieldErrorMap = Partial<Record<InputField, string>>

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected server error'

const normalizeValidationMessage = (
  field: InputField,
  message: string | undefined,
) => {
  if (!message || message === 'Required') {
    return field === 'footprinterString'
      ? 'Footprinter string is required.'
      : 'JLCPCB part number is required.'
  }

  return message
}

const getFieldErrors = (
  fieldErrors: Record<string, string[] | undefined>,
): FieldErrorMap => {
  const nextFieldErrors: FieldErrorMap = {}

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

export const createInvalidJsonResponse = (): CompareApiResult => ({
  body: {
    error: {
      code: 'COMPARE_INPUT_INVALID_JSON',
      hint: 'Send a JSON body with footprinterString and jlcpcbPartNumber.',
      message: 'Request body must be valid JSON.',
    },
  },
  status: 400,
})

export const createMethodNotAllowedResponse = (): CompareApiResult => ({
  body: {
    error: {
      code: 'METHOD_NOT_ALLOWED',
      hint: 'Use POST /api/compare.',
      message: 'Only POST is supported on this endpoint.',
    },
  },
  status: 405,
})

const createPreviewErrorResponse = (error: PreviewBuildError): CompareApiResult => ({
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

const createUnexpectedErrorResponse = (error: unknown): CompareApiResult => ({
  body: {
    error: {
      code: 'UNEXPECTED_ERROR',
      hint: 'Try again. If the problem continues, check the server logs.',
      message: getErrorMessage(error),
    },
  },
  status: 500,
})

export const handleCompareRequest = async (
  requestBody: unknown,
): Promise<CompareApiResult> => {
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
      Promise.resolve(buildFootprinterPreview(parsed.data.footprinterString)),
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
