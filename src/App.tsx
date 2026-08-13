import { useMemo, useState, useTransition, type FormEvent } from 'react'
import { compareFootprints } from 'circuit-json-to-footprinter/compare'
import { DiffHeatmap } from './components/DiffHeatmap'
import { FootprintSvg } from './components/FootprintSvg'
import { formatPercent } from './lib/formatPercent'
import { hasDrilledGeometry } from './lib/hasDrilledGeometry'
import type {
  ApiErrorResponse,
  ApiErrorPayload,
  CompareResponse,
  DiscoverResponse,
  FootprinterDiscoveryCandidate,
  InputField,
} from './lib/types'

const exampleInputs = {
  footprinterString: '0402',
  jlcpcbPartNumber: 'C1093',
}

const sectionLabelClass =
  'text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500'
const surfaceClass = 'rounded-3xl border border-slate-200 bg-white shadow-panel'
const secondarySurfaceClass =
  'rounded-2xl border border-slate-200 bg-white shadow-sm'
const inputBaseClass =
  'rounded-xl border px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2'
const directJlcPartNumberPattern = /^C\d+$/i

const getInputClassName = (hasError: boolean) =>
  hasError
    ? `${inputBaseClass} border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-100`
    : `${inputBaseClass} border-slate-300 bg-white focus:border-blue-500 focus:ring-blue-100`

const isCompareResponse = (
  payload: CompareResponse | ApiErrorResponse | null,
): payload is CompareResponse =>
  Boolean(payload && 'left' in payload && 'right' in payload)

const getApiErrorPayload = (
  payload: CompareResponse | ApiErrorResponse | null,
): ApiErrorPayload | undefined => (payload && 'error' in payload ? payload.error : undefined)

const isDiscoverResponse = (
  payload: DiscoverResponse | ApiErrorResponse | null,
): payload is DiscoverResponse =>
  Boolean(payload && 'best' in payload && 'comparison' in payload)

function App() {
  const [footprinterString, setFootprinterString] = useState('')
  const [jlcpcbPartNumber, setJlcpcbPartNumber] = useState('')
  const [compareResponse, setCompareResponse] = useState<CompareResponse | null>(null)
  const [comparedInputs, setComparedInputs] = useState<{
    footprinterString: string
    jlcpcbPartNumber: string
  } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorHint, setErrorHint] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<InputField, string>>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discoveryCandidates, setDiscoveryCandidates] = useState<
    FootprinterDiscoveryCandidate[]
  >([])
  const [discoveryDiagnostics, setDiscoveryDiagnostics] = useState<
    DiscoverResponse['diagnostics'] | null
  >(null)
  const [isPending, startTransition] = useTransition()

  const comparison = useMemo(() => {
    if (!compareResponse) return null
    return compareFootprints(compareResponse.left, compareResponse.right)
  }, [compareResponse])
  const hasComparedHoles = Boolean(
    compareResponse &&
      (hasDrilledGeometry(compareResponse.left) ||
        hasDrilledGeometry(compareResponse.right)),
  )

  const hasLiveComparison =
    Boolean(compareResponse) &&
    Boolean(comparison) &&
    Boolean(comparedInputs) &&
    comparedInputs?.footprinterString === footprinterString.trim() &&
    comparedInputs?.jlcpcbPartNumber === jlcpcbPartNumber.trim().toUpperCase()

  const clearFieldError = (field: InputField) => {
    setFieldErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors

      const nextErrors = { ...currentErrors }
      delete nextErrors[field]
      return nextErrors
    })
  }

  const validateJlcpcbPartNumber = (value: string) => {
    const trimmedValue = value.trim().toUpperCase()

    if (!trimmedValue) {
      return 'JLCPCB part number is required.'
    }

    if (!directJlcPartNumberPattern.test(trimmedValue)) {
      return `Enter an exact JLCPCB part number with the C prefix, like C2040 or C2149796. "${trimmedValue}" is not valid.`
    }

    return null
  }

  const runComparison = async ({
    footprinterString: nextFootprinterString,
    jlcpcbPartNumber: nextJlcpcbPartNumber,
  }: {
    footprinterString: string
    jlcpcbPartNumber: string
  }) => {
    setErrorMessage(null)
    setErrorHint(null)
    setFieldErrors({})

    const nextFieldErrors: Partial<Record<InputField, string>> = {}

    if (!nextFootprinterString.trim()) {
      nextFieldErrors.footprinterString = 'Footprinter string is required.'
    }

    const jlcpcbPartNumberError = validateJlcpcbPartNumber(nextJlcpcbPartNumber)
    if (jlcpcbPartNumberError) {
      nextFieldErrors.jlcpcbPartNumber = jlcpcbPartNumberError
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setErrorMessage('Please fill in the required fields before comparing.')
      setCompareResponse(null)
      setComparedInputs(null)
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          footprinterString: nextFootprinterString,
          jlcpcbPartNumber: nextJlcpcbPartNumber,
        }),
      })

      const responseText = await response.text()
      const responseContentType = response.headers.get('content-type') ?? ''
      let payload: CompareResponse | ApiErrorResponse | null = null

      if (responseText) {
        try {
          payload = JSON.parse(responseText) as CompareResponse | ApiErrorResponse
        } catch {
          const normalizedText = responseText.replace(/\s+/g, ' ').trim()
          const responsePreview = normalizedText.slice(0, 120)
          const contentTypeLabel = responseContentType || 'unknown content type'
          const statusLabel = [response.status, response.statusText].filter(Boolean).join(' ')
          const previewSuffix = responsePreview ? ` Response preview: ${responsePreview}` : ''

          throw new Error(
            `The comparison server returned ${contentTypeLabel} instead of JSON (${statusLabel}).${previewSuffix}`,
          )
        }
      }

      const payloadError = getApiErrorPayload(payload)

      if (!response.ok || !isCompareResponse(payload)) {
        if (payloadError?.fieldErrors) {
          setFieldErrors(payloadError.fieldErrors)
        } else if (payloadError?.field) {
          setFieldErrors({
            [payloadError.field]: payloadError.message,
          })
        }

        setErrorHint(payloadError?.hint ?? null)
        throw new Error(
          payloadError?.message ?? 'Unable to validate and compare these inputs.',
        )
      }

      startTransition(() => {
        setCompareResponse(payload)
        setComparedInputs({
          footprinterString: nextFootprinterString.trim(),
          jlcpcbPartNumber: nextJlcpcbPartNumber.trim().toUpperCase(),
        })
      })
    } catch (error) {
      const isNetworkError =
        error instanceof TypeError &&
        error.message.toLowerCase().includes('fetch')
      const message = isNetworkError
        ? 'Comparison server is not reachable right now.'
        : error instanceof Error
          ? error.message
          : 'Unknown comparison error'
      setErrorMessage(message)
      if (isNetworkError) {
        setErrorHint('Make sure the API server is running, then try again.')
      }
      startTransition(() => {
        setCompareResponse(null)
        setComparedInputs(null)
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCompare = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    await runComparison({
      footprinterString,
      jlcpcbPartNumber,
    })
  }

  const handleDiscover = async () => {
    setErrorMessage(null)
    setErrorHint(null)
    const jlcpcbPartNumberError = validateJlcpcbPartNumber(jlcpcbPartNumber)
    if (jlcpcbPartNumberError) {
      setFieldErrors({ jlcpcbPartNumber: jlcpcbPartNumberError })
      setErrorMessage('Enter a JLCPCB part number before discovering a footprint.')
      return
    }

    try {
      setIsDiscovering(true)
      setFieldErrors({})
      const response = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jlcpcbPartNumber, maxCandidates: 5 }),
      })
      const payload = (await response.json()) as
        | DiscoverResponse
        | ApiErrorResponse
      const payloadError = 'error' in payload ? payload.error : undefined

      if (!response.ok || !isDiscoverResponse(payload)) {
        if (payloadError?.fieldErrors) setFieldErrors(payloadError.fieldErrors)
        setErrorHint(payloadError?.hint ?? null)
        throw new Error(
          payloadError?.message ?? 'Unable to discover a footprinter string.',
        )
      }

      const normalizedPartNumber = jlcpcbPartNumber.trim().toUpperCase()
      setFootprinterString(payload.best.footprinterString)
      setDiscoveryCandidates(payload.candidates)
      setDiscoveryDiagnostics(payload.diagnostics)
      startTransition(() => {
        setCompareResponse(payload.comparison)
        setComparedInputs({
          footprinterString: payload.best.footprinterString,
          jlcpcbPartNumber: normalizedPartNumber,
        })
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unknown footprint discovery error',
      )
      setCompareResponse(null)
      setComparedInputs(null)
      setDiscoveryCandidates([])
      setDiscoveryDiagnostics(null)
    } finally {
      setIsDiscovering(false)
    }
  }

  const handleLoadExample = () => {
    setFootprinterString(exampleInputs.footprinterString)
    setJlcpcbPartNumber(exampleInputs.jlcpcbPartNumber)
    setCompareResponse(null)
    setComparedInputs(null)
    setErrorMessage(null)
    setErrorHint(null)
    setFieldErrors({})
    setDiscoveryCandidates([])
    setDiscoveryDiagnostics(null)

    void runComparison(exampleInputs)
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-blue-600 px-2 py-1 text-sm font-semibold text-white">
              tscircuit
            </span>
            <div className="hidden sm:block">
              <div className="text-sm font-medium text-slate-900">
                Footprinter / JLCPCB IoU
              </div>
              <div className="text-xs text-slate-500">
                Strict validation before footprint analysis
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="hidden md:inline">
              compare only after footprinter and EasyEDA both accept the inputs
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <article className={`${surfaceClass} p-6 sm:p-7`}>
            <div className={sectionLabelClass}>Exact Validation</div>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Compare exact Footprinter and JLCPCB footprints.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              Analysis is shown only after `@tscircuit/footprinter` accepts the
              left input and EasyEDA resolves the exact same JLCPCB part number on
              the right.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                source: footprinter
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                source: EasyEDA
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                output: analysis after validation
              </span>
            </div>
          </article>

          <aside className={`${surfaceClass} p-6`}>
            <div className={sectionLabelClass}>Validation Steps</div>
            <div className="mt-4 space-y-4">
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                  1
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Enter the exact sources
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Use the same footprinter string you expect upstream to accept,
                    plus the exact JLCPCB supplier part number.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                  2
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Validate upstream
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Footprinter must build the left side directly, and EasyEDA must
                    return the exact same part number on the right side.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                  3
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Review analysis
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Once both validators pass, review overlay, IoU, coverage, and
                    per-pin drift.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className={`${surfaceClass} p-4 sm:p-6`}>
          <form
            className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]"
            onSubmit={handleCompare}
          >
            <label className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <span className={sectionLabelClass}>Footprinter String</span>
              <input
                className={getInputClassName(Boolean(fieldErrors.footprinterString))}
                value={footprinterString}
                onChange={(event) => {
                  setFootprinterString(event.target.value)
                  setDiscoveryCandidates([])
                  setDiscoveryDiagnostics(null)
                  setCompareResponse(null)
                  setComparedInputs(null)
                  clearFieldError('footprinterString')
                  setErrorMessage(null)
                  setErrorHint(null)
                }}
                placeholder="tssop16_p0.65mm"
                spellCheck={false}
              />
              {fieldErrors.footprinterString ? (
                <span className="text-sm text-red-600">
                  {fieldErrors.footprinterString}
                </span>
              ) : (
                <span className="text-sm text-slate-500">
                  Accepted only if `@tscircuit/footprinter` can build it as-is.
                </span>
              )}
            </label>

            <label className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <span className={sectionLabelClass}>JLCPCB Part Number</span>
              <input
                className={getInputClassName(Boolean(fieldErrors.jlcpcbPartNumber))}
                value={jlcpcbPartNumber}
                onChange={(event) => {
                  setJlcpcbPartNumber(event.target.value.toUpperCase())
                  setDiscoveryCandidates([])
                  setDiscoveryDiagnostics(null)
                  setCompareResponse(null)
                  setComparedInputs(null)
                  clearFieldError('jlcpcbPartNumber')
                  setErrorMessage(null)
                  setErrorHint(null)
                }}
                placeholder="C2149796"
                autoCapitalize="characters"
                spellCheck={false}
              />
              {fieldErrors.jlcpcbPartNumber ? (
                <span className="text-sm text-red-600">
                  {fieldErrors.jlcpcbPartNumber}
                </span>
              ) : (
                <span className="text-sm text-slate-500">
                  Exact JLCPCB part number only, with the C prefix. EasyEDA fuzzy
                  matches are rejected here.
                </span>
              )}
            </label>

            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <button
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
                type="button"
                disabled={isLoading || isPending || isDiscovering}
                onClick={handleLoadExample}
              >
                {isLoading ? 'Loading example…' : 'Load working example'}
              </button>
              <button
                className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-wait disabled:opacity-70"
                type="button"
                disabled={isLoading || isPending || isDiscovering}
                onClick={() => void handleDiscover()}
              >
                {isDiscovering ? 'Searching parameter space…' : 'Discover from JLCPCB'}
              </button>
              <button
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70"
                type="submit"
                disabled={isLoading || isPending || isDiscovering}
              >
                {isLoading || isPending ? 'Validating…' : 'Validate and compare'}
              </button>
              <div className="space-y-2 text-sm leading-6 text-slate-500">
                <p>Analysis stays hidden until both upstream validators succeed.</p>
                <p>
                  Example: <code className="text-slate-700">0402</code> with{' '}
                  <code className="text-slate-700">C1093</code>
                </p>
              </div>
            </div>
          </form>

          {errorMessage ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-700">{errorMessage}</p>
              {errorHint ? (
                <p className="mt-1 text-sm text-red-600">{errorHint}</p>
              ) : null}
            </div>
          ) : null}

          {discoveryCandidates.length > 0 && discoveryDiagnostics ? (
            <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className={sectionLabelClass}>Smart Search Results</div>
                  <p className="mt-1 text-sm text-slate-600">
                    Classified as {discoveryDiagnostics.topology}; evaluated{' '}
                    {discoveryDiagnostics.evaluatedSeeds} domain seeds and refined{' '}
                    {discoveryDiagnostics.optimizedSeeds} with numerical gradients.
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  {discoveryDiagnostics.targetPadCount} target pads
                </span>
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {discoveryCandidates.map((candidate, index) => (
                  <button
                    className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white px-3 py-3 text-left transition hover:border-blue-300"
                    key={candidate.footprinterString}
                    type="button"
                    onClick={() => {
                      setFootprinterString(candidate.footprinterString)
                      void runComparison({
                        footprinterString: candidate.footprinterString,
                        jlcpcbPartNumber,
                      })
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-blue-600">
                        {index === 0 ? 'Best match' : candidate.family}
                      </span>
                      <code className="mt-1 block truncate text-xs text-slate-800">
                        {candidate.footprinterString}
                      </code>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-slate-900">
                      {formatPercent(candidate.copperIntersectionOverUnion)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {hasLiveComparison && compareResponse && comparison ? (
            <>
              <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <article className="min-w-0 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                  <div className={sectionLabelClass}>Copper IoU</div>
                  <div className="mt-3 whitespace-nowrap text-4xl font-semibold tracking-tight text-slate-950">
                    {formatPercent(compareResponse.copperIntersectionOverUnion)}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Shared copper area across both aligned footprints.
                  </p>
                </article>

                <article className="min-w-0 rounded-2xl border border-violet-100 bg-violet-50 p-5">
                  <div className={sectionLabelClass}>Hole IoU</div>
                  <div className="mt-3 whitespace-nowrap text-4xl font-semibold tracking-tight text-slate-950">
                    {hasComparedHoles
                      ? formatPercent(compareResponse.holeIntersectionOverUnion)
                      : 'N/A'}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {hasComparedHoles
                      ? 'Shared drilled geometry across both aligned footprints.'
                      : 'Neither footprint contains drilled geometry.'}
                  </p>
                </article>

                <article className={`${secondarySurfaceClass} min-w-0 p-5`}>
                  <div className={sectionLabelClass}>Coverage</div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-600">
                        Footprinter covered
                      </span>
                      <span className="whitespace-nowrap text-2xl font-semibold tracking-tight text-slate-950">
                        {formatPercent(comparison.coverageLeft)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-600">JLCPCB covered</span>
                      <span className="whitespace-nowrap text-2xl font-semibold tracking-tight text-slate-950">
                        {formatPercent(comparison.coverageRight)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Overlap area as a percentage of each source footprint.
                  </p>
                </article>

                <article className={`${secondarySurfaceClass} min-w-0 p-5`}>
                  <div className={sectionLabelClass}>Pad Count</div>
                  <div className="mt-3 whitespace-nowrap text-3xl font-semibold tracking-tight text-slate-950">
                    {compareResponse.left.pads.length} vs{' '}
                    {compareResponse.right.pads.length}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {comparison.padCountMatch
                      ? 'Pad counts match.'
                      : 'Pad counts differ and need review.'}
                  </p>
                </article>

                <article className={`${secondarySurfaceClass} min-w-0 p-5`}>
                  <div className={sectionLabelClass}>Mismatch Split</div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-600">
                        Footprinter only
                      </span>
                      <span className="whitespace-nowrap text-2xl font-semibold tracking-tight text-slate-950">
                        {formatPercent(comparison.leftOnlyRatio)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-600">JLCPCB only</span>
                      <span className="whitespace-nowrap text-2xl font-semibold tracking-tight text-slate-950">
                        {formatPercent(comparison.rightOnlyRatio)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Area that belongs to only one side after alignment.
                  </p>
                </article>
              </section>

              <section className="mt-6 grid min-w-0 gap-4 xl:grid-cols-2">
                <article className={`${secondarySurfaceClass} flex min-w-0 flex-col p-5`}>
                  <header className="min-w-0 flex-1 border-b border-slate-200 pb-4">
                    <div className="min-w-0 flex-1">
                      <div className={sectionLabelClass}>Footprinter Preview</div>
                      <h2 className="mt-1 [overflow-wrap:anywhere] text-xl font-semibold text-slate-950">
                        {compareResponse.left.title}
                      </h2>
                      <p className="mt-1 [overflow-wrap:anywhere] text-sm text-slate-500">
                        {compareResponse.left.subtitle}
                      </p>
                    </div>
                  </header>
                  <div className="mt-4">
                    <FootprintSvg
                      layers={[
                        {
                          accent: '#f59e0b',
                          fillOpacity: 0.76,
                          footprint: compareResponse.left,
                          label: 'Footprinter',
                        },
                      ]}
                    />
                  </div>
                </article>

                <article className={`${secondarySurfaceClass} flex min-w-0 flex-col p-5`}>
                  <header className="min-w-0 flex-1 border-b border-slate-200 pb-4">
                    <div className="min-w-0 flex-1">
                      <div className={sectionLabelClass}>JLCPCB Preview</div>
                      <h2 className="mt-1 [overflow-wrap:anywhere] text-xl font-semibold text-slate-950">
                        {compareResponse.right.title}
                      </h2>
                      <p className="mt-1 [overflow-wrap:anywhere] text-sm text-slate-500">
                        {compareResponse.right.subtitle}
                      </p>
                    </div>
                  </header>
                  <div className="mt-4">
                    <FootprintSvg
                      layers={[
                        {
                          accent: '#06b6d4',
                          fillOpacity: 0.76,
                          footprint: compareResponse.right,
                          label: 'JLCPCB',
                        },
                      ]}
                    />
                  </div>
                </article>
              </section>

              <section className="mt-6 space-y-4">
                <article className={`${secondarySurfaceClass} p-5`}>
                  <header className="border-b border-slate-200 pb-4">
                    <div className={sectionLabelClass}>Overlay Preview</div>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">
                      Aligned pad geometry
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Both footprints are centered using their pad bounds before
                      the IoU pass.
                    </p>
                  </header>
                  <div className="mt-4">
                    <FootprintSvg
                      layers={[
                        {
                          accent: '#f59e0b',
                          fillOpacity: 0.52,
                          footprint: comparison.normalizedLeft,
                          label: 'Footprinter',
                        },
                        {
                          accent: '#06b6d4',
                          fillOpacity: 0.52,
                          footprint: comparison.normalizedRight,
                          label: 'JLCPCB',
                        },
                      ]}
                      showLabels={false}
                    />
                  </div>
                </article>

                <article className={`${secondarySurfaceClass} p-5`}>
                  <header className="border-b border-slate-200 pb-4">
                    <div className={sectionLabelClass}>IoU Difference</div>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">
                      Occupancy heatmap
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Green is overlap, amber is left-only, blue is right-only.
                    </p>
                  </header>
                  <div className="mt-4">
                    <DiffHeatmap comparison={comparison} />
                  </div>
                </article>
              </section>

            </>
          ) : (
            <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
              Analysis will appear here after both the footprinter string and the
              exact JLCPCB part number pass validation.
            </section>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
