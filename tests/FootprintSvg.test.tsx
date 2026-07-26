import { expect, test } from 'bun:test'
import { footprinterStringToFootprint } from 'circuit-json-to-footprinter'
import { renderToStaticMarkup } from 'react-dom/server'
import { FootprintSvg } from '../src/components/FootprintSvg.js'
import type { Footprint } from '../src/lib/types.js'

test('renders polygon pads from their vertices', () => {
  const footprint: Footprint = {
    holes: [],
    pads: [
      {
        layer: 'top',
        pcb_smtpad_id: 'polygon-pad',
        points: [
          { x: 1, y: 1 },
          { x: 3, y: 1 },
          { x: 2, y: 3 },
        ],
        port_hints: ['pin1'],
        shape: 'polygon',
        type: 'pcb_smtpad',
      },
    ],
    subtitle: 'Polygon preview',
    title: 'Polygon',
  }

  const markup = renderToStaticMarkup(
    <FootprintSvg
      layers={[
        {
          accent: '#f59e0b',
          fillOpacity: 0.76,
          footprint,
          label: 'Footprinter',
        },
      ]}
    />,
  )

  expect(markup).toContain('<polygon')
  expect(markup).toContain('points="1,-1 3,-1 2,-3"')
})

test('renders plated-hole pads from the raw Circuit JSON shape', () => {
  const footprint = footprinterStringToFootprint('pinrow2_p2.54')
  const markup = renderToStaticMarkup(
    <FootprintSvg
      layers={[
        {
          accent: '#f59e0b',
          fillOpacity: 0.76,
          footprint,
          label: 'Footprinter',
        },
      ]}
    />,
  )

  expect(footprint.pads[0]?.type).toBe('pcb_plated_hole')
  expect(markup).toContain('fill="#020617"')
  expect(markup).toContain('>1</text>')
})

test('renders rotated plated-hole copper and drill independently', () => {
  const footprint: Footprint = {
    holes: [],
    pads: [
      {
        hole_ccw_rotation: 45,
        hole_height: 1.4,
        hole_offset_x: 0,
        hole_offset_y: 0,
        hole_shape: 'rotated_pill',
        hole_width: 0.8,
        layers: ['top', 'bottom'],
        pcb_plated_hole_id: 'rotated-hole',
        rect_ccw_rotation: 30,
        rect_pad_height: 2,
        rect_pad_width: 1.6,
        shape: 'rotated_pill_hole_with_rect_pad',
        type: 'pcb_plated_hole',
        x: 0,
        y: 0,
      },
    ],
    subtitle: 'Rotated plated hole',
    title: 'Rotated plated hole',
  }
  const markup = renderToStaticMarkup(
    <FootprintSvg
      layers={[
        {
          accent: '#f59e0b',
          fillOpacity: 0.76,
          footprint,
          label: 'Footprinter',
        },
      ]}
    />,
  )

  expect(markup).toContain('rotate(-30 0 0)')
  expect(markup).toContain('rotate(-45 0 0)')
})
