import { useId } from 'react'
import { getFootprintBounds } from '../lib/footprintMath'
import type { FootprintPreview, PreviewPad } from '../lib/types'

interface LayerConfig {
  accent: string
  fillOpacity: number
  footprint: FootprintPreview
  label: string
}

interface FootprintSvgProps {
  layers: LayerConfig[]
  showLabels?: boolean
}

const padElement = (pad: PreviewPad, accent: string, fillOpacity: number) => {
  const commonProps = {
    fill: accent,
    fillOpacity,
    stroke: accent,
    strokeOpacity: Math.min(fillOpacity + 0.16, 1),
    strokeWidth: 0.06,
  }

  if (pad.shape === 'circle') {
    return (
      <ellipse
        {...commonProps}
        cx={pad.x}
        cy={-pad.y}
        rx={pad.width / 2}
        ry={pad.height / 2}
      />
    )
  }

  const cornerRadius =
    pad.shape === 'pill'
      ? Math.min(pad.width, pad.height) / 2
      : Math.max(0, Math.min(pad.cornerRadius ?? 0, pad.width / 2, pad.height / 2))

  return (
    <rect
      {...commonProps}
      x={pad.x - pad.width / 2}
      y={-pad.y - pad.height / 2}
      width={pad.width}
      height={pad.height}
      rx={cornerRadius}
      transform={pad.rotation ? `rotate(${-pad.rotation} ${pad.x} ${-pad.y})` : undefined}
    />
  )
}

export function FootprintSvg({
  layers,
  showLabels = true,
}: FootprintSvgProps) {
  const patternId = useId().replace(/:/g, '')
  const paddedBounds = (() => {
    const merged = layers
      .map((layer) => getFootprintBounds(layer.footprint.pads))
      .reduce((left, right) => ({
        height: Math.max(left.maxY, right.maxY) - Math.min(left.minY, right.minY),
        maxX: Math.max(left.maxX, right.maxX),
        maxY: Math.max(left.maxY, right.maxY),
        minX: Math.min(left.minX, right.minX),
        minY: Math.min(left.minY, right.minY),
        width: Math.max(left.maxX, right.maxX) - Math.min(left.minX, right.minX),
      }))

    const padX = Math.max(merged.width * 0.18, 0.65)
    const padY = Math.max(merged.height * 0.18, 0.65)

    return {
      maxX: merged.maxX + padX,
      maxY: merged.maxY + padY,
      minX: merged.minX - padX,
      minY: merged.minY - padY,
    }
  })()

  const viewWidth = paddedBounds.maxX - paddedBounds.minX
  const viewHeight = paddedBounds.maxY - paddedBounds.minY

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {layers.map((layer) => (
          <span
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
            key={layer.label}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: layer.accent }}
            ></span>
            {layer.label}
          </span>
        ))}
      </div>
      <svg
        className="h-[340px] w-full rounded-2xl border border-slate-800 bg-slate-950 shadow-inner"
        viewBox={`${paddedBounds.minX} ${-paddedBounds.maxY} ${viewWidth} ${viewHeight}`}
        role="img"
        aria-label="Footprint preview"
      >
        <defs>
          <pattern
            id={patternId}
            width="0.5"
            height="0.5"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 0.5 0 L 0 0 0 0.5"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.02"
            />
          </pattern>
        </defs>

        <rect
          x={paddedBounds.minX}
          y={-paddedBounds.maxY}
          width={viewWidth}
          height={viewHeight}
          fill={`url(#${patternId})`}
        />
        <line
          x1={paddedBounds.minX}
          y1={0}
          x2={paddedBounds.maxX}
          y2={0}
          stroke="rgba(255,255,255,0.11)"
          strokeWidth="0.04"
        />
        <line
          x1={0}
          y1={-paddedBounds.maxY}
          x2={0}
          y2={-paddedBounds.minY}
          stroke="rgba(255,255,255,0.11)"
          strokeWidth="0.04"
        />

        {layers.flatMap((layer) =>
          layer.footprint.pads.map((pad) => (
            <g key={`${layer.label}-${pad.id}`}>
              {padElement(pad, layer.accent, layer.fillOpacity)}
              {showLabels ? (
                <text
                  x={pad.x}
                  y={-pad.y}
                  fill="rgba(248,250,252,0.88)"
                  fontSize="0.24"
                  fontFamily="ui-monospace, SFMono-Regular, monospace"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {pad.portHints[0] ?? pad.id}
                </text>
              ) : null}
            </g>
          )),
        )}
      </svg>
    </div>
  )
}
