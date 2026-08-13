import { expect, test } from 'bun:test'
import type { Footprint } from 'circuit-json-to-footprinter/compare'
import { summarizeCopperComparison } from 'circuit-json-to-footprinter/compare'

const footprint = (leftPin: number, rightPin: number): Footprint => ({
  holes: [],
  pads: [
    {
      height: 1,
      layer: 'top',
      pcb_smtpad_id: `pad_${leftPin}`,
      port_hints: [`pin${leftPin}`],
      shape: 'rect',
      type: 'pcb_smtpad',
      width: 1,
      x: -1,
      y: 0,
    },
    {
      height: 1,
      layer: 'top',
      pcb_smtpad_id: `pad_${rightPin}`,
      port_hints: [`pin${rightPin}`],
      shape: 'rect',
      type: 'pcb_smtpad',
      width: 1,
      x: 1,
      y: 0,
    },
  ],
  subtitle: '',
  title: '',
  vias: [],
})

test('shared comparison reports position-matched numeric pin swaps', () => {
  const comparison = summarizeCopperComparison(
    footprint(1, 2),
    footprint(2, 1),
  )

  expect(comparison.copperIntersectionOverUnion).toBe(1)
  expect(comparison.pinMatchRate).toBe(0)
  expect(comparison.pinsMatch).toBe(false)
  expect(comparison.pinMismatches).toEqual([
    {
      leftPadIndex: 0,
      leftPinNumbers: [1],
      leftPortHints: ['pin1'],
      rightPadIndex: 0,
      rightPinNumbers: [2],
      rightPortHints: ['pin2'],
    },
    {
      leftPadIndex: 1,
      leftPinNumbers: [2],
      leftPortHints: ['pin2'],
      rightPadIndex: 1,
      rightPinNumbers: [1],
      rightPortHints: ['pin1'],
    },
  ])
})

test('shared comparison reports non-numeric thermal pad against numeric pin 17', () => {
  const left = footprint(1, 2)
  const right = footprint(1, 2)
  left.pads.push({
    height: 2,
    layer: 'top',
    pcb_smtpad_id: 'thermalpad',
    port_hints: ['thermalpad'],
    shape: 'rect',
    type: 'pcb_smtpad',
    width: 2,
    x: 0,
    y: 0,
  })
  right.pads.push({
    height: 2,
    layer: 'top',
    pcb_smtpad_id: 'pin17',
    port_hints: ['pin17'],
    shape: 'rect',
    type: 'pcb_smtpad',
    width: 2,
    x: 0,
    y: 0,
  })

  expect(summarizeCopperComparison(left, right)).toMatchObject({
    pinMatchRate: 2 / 3,
    pinsMatch: false,
    pinMismatches: [
      {
        leftPortHints: ['thermalpad'],
        rightPortHints: ['pin17'],
      },
    ],
  })
})
