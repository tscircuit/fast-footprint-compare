import { expect, test } from 'bun:test'
import { footprinterStringToFootprint } from 'circuit-json-to-footprinter'
import { hasDrilledGeometry } from '../src/lib/hasDrilledGeometry.js'

test('treats PCB vias as drilled footprint geometry', () => {
  const smd = footprinterStringToFootprint('0402')

  expect(hasDrilledGeometry(smd)).toBe(false)
  expect(
    hasDrilledGeometry({
      ...smd,
      vias: [
        {
          hole_diameter: 0.3,
          layers: ['top', 'bottom'],
          outer_diameter: 0.8,
          pcb_via_id: 'thermal-via-1',
          type: 'pcb_via',
          x: 0,
          y: 0,
        },
      ],
    }),
  ).toBe(true)
})
