import { expect, test } from 'bun:test'
import { summarizeCopperComparison } from '../server/copperComparison.js'
import { buildFootprinterPreview } from '../server/footprints.js'

test('compares drill geometry independently from outer copper', () => {
  const smallerHole = buildFootprinterPreview(
    'pinrow2_p2.54mm_id0.7mm_od1.6mm',
  )
  const largerHole = buildFootprinterPreview(
    'pinrow2_p2.54mm_id1.1mm_od1.6mm',
  )

  expect(smallerHole.pads[0]).toMatchObject({
    height: 1.6,
    width: 1.6,
    hole: {
      height: 0.7,
      shape: 'circle',
      width: 0.7,
    },
  })

  const comparison = summarizeCopperComparison(smallerHole, largerHole)
  expect(comparison.copperIntersectionOverUnion).toBe(1)
  expect(comparison.holeIntersectionOverUnion).toBeLessThan(0.5)
})

test('reports perfect hole IoU when neither footprint has holes', () => {
  const smd = buildFootprinterPreview('0402')

  expect(summarizeCopperComparison(smd, smd)).toEqual({
    copperIntersectionOverUnion: 1,
    holeIntersectionOverUnion: 1,
  })
})
