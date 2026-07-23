import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { FootprintSvg } from '../src/components/FootprintSvg.js'
import type { FootprintPreview } from '../src/lib/types.js'

test('renders polygon pads from their vertices', () => {
  const footprint: FootprintPreview = {
    pads: [
      {
        height: 2,
        id: 'polygon-pad',
        kind: 'smt',
        layer: 'top',
        points: [
          { x: -1, y: -1 },
          { x: 1, y: -1 },
          { x: 0, y: 1 },
        ],
        portHints: ['pin1'],
        rotation: 0,
        shape: 'polygon',
        width: 2,
        x: 2,
        y: 2,
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
