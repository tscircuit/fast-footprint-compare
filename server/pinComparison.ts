import type { Footprint } from 'circuit-json-to-footprinter/compare'

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

interface IndexedPad {
  padIndex: number
  portHints: string[]
  x: number
  y: number
}

const getNumericPinNumbers = (pad: IndexedPad | null) => [
  ...new Set(
    (pad?.portHints ?? []).flatMap((hint) => {
      const match = hint.trim().match(/^(?:pin)?(\d+)$/i)
      return match?.[1] ? [Number.parseInt(match[1], 10)] : []
    }),
  ),
]

const getPadCenter = (pad: Footprint['pads'][number]) => {
  if ('x' in pad && 'y' in pad) return { x: pad.x, y: pad.y }

  const minX = Math.min(...pad.points.map((point) => point.x))
  const maxX = Math.max(...pad.points.map((point) => point.x))
  const minY = Math.min(...pad.points.map((point) => point.y))
  const maxY = Math.max(...pad.points.map((point) => point.y))
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}

const getNormalizedPads = (footprint: Footprint): IndexedPad[] => {
  const rotation = ((footprint.rotation ?? 0) * Math.PI) / 180
  const pads = footprint.pads.map((pad, padIndex) => {
    const center = getPadCenter(pad)
    return {
      padIndex,
      portHints: pad.port_hints ?? [],
      x:
        center.x * Math.cos(rotation) -
        center.y * Math.sin(rotation) +
        (footprint.x ?? 0),
      y:
        center.x * Math.sin(rotation) +
        center.y * Math.cos(rotation) +
        (footprint.y ?? 0),
    }
  })
  const minX = Math.min(...pads.map((pad) => pad.x))
  const maxX = Math.max(...pads.map((pad) => pad.x))
  const minY = Math.min(...pads.map((pad) => pad.y))
  const maxY = Math.max(...pads.map((pad) => pad.y))
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  return pads.map((pad) => ({
    ...pad,
    x: pad.x - centerX,
    y: pad.y - centerY,
  }))
}

const matchPadsByPosition = (leftPads: IndexedPad[], rightPads: IndexedPad[]) => {
  const availableRight = new Set(rightPads.map((_, index) => index))
  const pairs: Array<readonly [IndexedPad | null, IndexedPad | null]> = []

  for (const leftPad of leftPads) {
    let bestIndex = -1
    let bestDistance = Number.POSITIVE_INFINITY
    for (const rightIndex of availableRight) {
      const rightPad = rightPads[rightIndex]
      const distance = Math.hypot(leftPad.x - rightPad.x, leftPad.y - rightPad.y)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = rightIndex
      }
    }

    if (bestIndex === -1) {
      pairs.push([leftPad, null])
      continue
    }
    availableRight.delete(bestIndex)
    pairs.push([leftPad, rightPads[bestIndex]])
  }

  for (const rightIndex of availableRight) {
    pairs.push([null, rightPads[rightIndex]])
  }
  return pairs
}

export const comparePinHints = (
  left: Footprint,
  right: Footprint,
): PinComparisonSummary => {
  const pairs = matchPadsByPosition(
    getNormalizedPads(left),
    getNormalizedPads(right),
  )
  const pinMismatches: PinMismatchDetail[] = []
  let comparedPinCount = 0
  let matchedPinCount = 0

  for (const [leftPad, rightPad] of pairs) {
    const leftPinNumbers = getNumericPinNumbers(leftPad)
    const rightPinNumbers = getNumericPinNumbers(rightPad)
    if (leftPinNumbers.length === 0 && rightPinNumbers.length === 0) continue

    comparedPinCount += 1
    if (
      leftPinNumbers.some((pinNumber) => rightPinNumbers.includes(pinNumber))
    ) {
      matchedPinCount += 1
      continue
    }

    pinMismatches.push({
      leftPadIndex: leftPad?.padIndex ?? null,
      leftPinNumbers,
      leftPortHints: leftPad?.portHints ?? [],
      rightPadIndex: rightPad?.padIndex ?? null,
      rightPinNumbers,
      rightPortHints: rightPad?.portHints ?? [],
    })
  }

  return {
    pinMatchRate:
      comparedPinCount === 0 ? 1 : matchedPinCount / comparedPinCount,
    pinMismatches,
    pinsMatch: pinMismatches.length === 0,
  }
}

export const getPinComparison = (
  comparison: object,
  left: Footprint,
  right: Footprint,
): PinComparisonSummary => {
  if (
    'pinMatchRate' in comparison &&
    typeof comparison.pinMatchRate === 'number' &&
    'pinsMatch' in comparison &&
    typeof comparison.pinsMatch === 'boolean' &&
    'pinMismatches' in comparison &&
    Array.isArray(comparison.pinMismatches)
  ) {
    return {
      pinMatchRate: comparison.pinMatchRate,
      pinMismatches: comparison.pinMismatches as PinMismatchDetail[],
      pinsMatch: comparison.pinsMatch,
    }
  }

  return comparePinHints(left, right)
}
