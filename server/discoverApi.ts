import {
  circuitJsonToFootprinter,
  type FootprinterDiscoveryCandidate,
} from 'circuit-json-to-footprinter'
import {
  summarizeCopperComparison,
  type CopperComparisonSummary,
  type Footprint,
} from 'circuit-json-to-footprinter/compare'
import { z } from 'zod'
import {
  buildFootprinterPreview,
  buildJlcpcbFootprint,
  PreviewBuildError,
} from './footprints.js'
const discoverRequestSchema = z.object({
  jlcpcbPartNumber: z
    .string()
    .trim()
    .min(1, 'JLCPCB part number is required.')
    .regex(
      /^C\d+$/i,
      'Enter an exact JLCPCB part number with the C prefix, like C2040 or C2149796.',
    ),
  maxCandidates: z.number().int().min(1).max(10).optional().default(5),
})

export interface DiscoverResponse {
  best: FootprinterDiscoveryCandidate
  candidates: FootprinterDiscoveryCandidate[]
  comparison: CopperComparisonSummary & {
    left: Footprint
    right: Footprint
  }
  diagnostics: {
    evaluatedSeeds: number
    optimizedSeeds: number
    targetPadCount: number
    topology: string
  }
}

interface DiscoverErrorResponse {
  error: {
    code: string
    field?: 'jlcpcbPartNumber'
    fieldErrors?: { jlcpcbPartNumber?: string }
    hint?: string
    message: string
  }
}

export interface DiscoverApiResult {
  body: DiscoverErrorResponse | DiscoverResponse
  status: number
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected server error'

export const createDiscoverInvalidJsonResponse = (): DiscoverApiResult => ({
  body: {
    error: {
      code: 'DISCOVER_INPUT_INVALID_JSON',
      hint: 'Send a JSON body with jlcpcbPartNumber.',
      message: 'Request body must be valid JSON.',
    },
  },
  status: 400,
})

export const handleDiscoverRequest = async (
  requestBody: unknown,
): Promise<DiscoverApiResult> => {
  const parsed = discoverRequestSchema.safeParse(requestBody)
  if (!parsed.success) {
    const message =
      parsed.error.flatten().fieldErrors.jlcpcbPartNumber?.[0] ??
      parsed.error.flatten().fieldErrors.maxCandidates?.[0] ??
      'Enter a valid JLCPCB part number.'
    return {
      body: {
        error: {
          code: 'DISCOVER_INPUT_INVALID',
          field: 'jlcpcbPartNumber',
          fieldErrors: { jlcpcbPartNumber: message },
          hint: 'Use the exact JLCPCB/LCSC supplier number with the C prefix.',
          message,
        },
      },
      status: 400,
    }
  }

  try {
    const { circuitJson, preview: target } = await buildJlcpcbFootprint(
      parsed.data.jlcpcbPartNumber,
    )
    const discovery = circuitJsonToFootprinter(circuitJson, {
      maxCandidates: parsed.data.maxCandidates,
      sourceHints: target.sourceHints,
      subtitle: target.subtitle,
      title: target.title,
    })
    if (!discovery.best) {
      return {
        body: {
          error: {
            code: 'FOOTPRINTER_DISCOVERY_NO_MATCH',
            hint: 'The footprint may need a new footprinter family or a custom footprint.',
            message: `No supported footprinter family produced ${target.pads.length} compatible pads.`,
          },
        },
        status: 422,
      }
    }

    const left = buildFootprinterPreview(discovery.best.footprinterString)
    const comparison = summarizeCopperComparison(left, target)
    const best = {
      ...discovery.best,
      ...comparison,
    }

    return {
      body: {
        best,
        candidates: discovery.candidates.map((candidate) =>
          candidate.footprinterString === best.footprinterString
            ? best
            : candidate,
        ),
        comparison: {
          ...comparison,
          left,
          right: target,
        },
        diagnostics: discovery.diagnostics,
      },
      status: 200,
    }
  } catch (error) {
    if (error instanceof PreviewBuildError) {
      return {
        body: {
          error: {
            code: error.code,
            field:
              error.field === 'jlcpcbPartNumber'
                ? 'jlcpcbPartNumber'
                : undefined,
            fieldErrors: error.fieldErrors?.jlcpcbPartNumber
              ? {
                  jlcpcbPartNumber:
                    error.fieldErrors.jlcpcbPartNumber,
                }
              : undefined,
            hint: error.hint,
            message: error.message,
          },
        },
        status: error.status,
      }
    }

    return {
      body: {
        error: {
          code: 'FOOTPRINTER_DISCOVERY_FAILED',
          hint: 'Try again. If the problem continues, check the server logs.',
          message: getErrorMessage(error),
        },
      },
      status: 500,
    }
  }
}
