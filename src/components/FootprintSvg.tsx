import { useId } from 'react'
import { getFootprintBounds } from 'circuit-json-to-footprinter/compare'
import {
  getBoundFromCenteredRect,
  getBoundsCenter,
  getBoundsFromPoints,
  type Bounds,
} from '@tscircuit/math-utils'
import type {
  PcbHole,
  PcbPlatedHole,
  PcbSmtPad,
  Point,
} from 'circuit-json'
import type { Footprint } from '../lib/types'

interface LayerConfig {
  accent: string
  fillOpacity: number
  footprint: Footprint
  label: string
}

interface FootprintSvgProps {
  layers: LayerConfig[]
  showLabels?: boolean
}

interface ShapeStyle {
  accent: string
  fillOpacity: number
  hole?: boolean
}

const getShapeProps = ({ accent, fillOpacity, hole = false }: ShapeStyle) => ({
  fill: hole ? '#020617' : accent,
  fillOpacity: hole ? 0.96 : fillOpacity,
  stroke: accent,
  strokeOpacity: hole ? 0.92 : Math.min(fillOpacity + 0.16, 1),
  strokeWidth: hole ? 0.07 : 0.06,
})

const getRotationTransform = (
  rotation: number | undefined,
  x: number,
  y: number,
) => (rotation ? `rotate(${-rotation} ${x} ${-y})` : undefined)

const ellipseElement = ({
  height,
  rotation,
  style,
  width,
  x,
  y,
}: {
  height: number
  rotation?: number
  style: ShapeStyle
  width: number
  x: number
  y: number
}) => (
  <ellipse
    {...getShapeProps(style)}
    cx={x}
    cy={-y}
    rx={width / 2}
    ry={height / 2}
    transform={getRotationTransform(rotation, x, y)}
  />
)

const rectElement = ({
  cornerRadius = 0,
  height,
  pill = false,
  rotation,
  style,
  width,
  x,
  y,
}: {
  cornerRadius?: number
  height: number
  pill?: boolean
  rotation?: number
  style: ShapeStyle
  width: number
  x: number
  y: number
}) => (
  <rect
    {...getShapeProps(style)}
    x={x - width / 2}
    y={-y - height / 2}
    width={width}
    height={height}
    rx={
      pill
        ? Math.min(width, height) / 2
        : Math.max(0, Math.min(cornerRadius, width / 2, height / 2))
    }
    transform={getRotationTransform(rotation, x, y)}
  />
)

const polygonElement = (points: readonly Point[], style: ShapeStyle) => (
  <polygon
    {...getShapeProps(style)}
    points={points.map((point) => `${point.x},${-point.y}`).join(' ')}
  />
)

const smtPadElement = (pad: PcbSmtPad, style: ShapeStyle) => {
  switch (pad.shape) {
    case 'circle':
      return ellipseElement({
        height: pad.radius * 2,
        style,
        width: pad.radius * 2,
        x: pad.x,
        y: pad.y,
      })
    case 'rect':
      return rectElement({
        cornerRadius: pad.corner_radius ?? pad.rect_border_radius,
        height: pad.height,
        style,
        width: pad.width,
        x: pad.x,
        y: pad.y,
      })
    case 'rotated_rect':
      return rectElement({
        cornerRadius: pad.corner_radius ?? pad.rect_border_radius,
        height: pad.height,
        rotation: pad.ccw_rotation,
        style,
        width: pad.width,
        x: pad.x,
        y: pad.y,
      })
    case 'pill':
      return rectElement({
        height: pad.height,
        pill: true,
        style,
        width: pad.width,
        x: pad.x,
        y: pad.y,
      })
    case 'rotated_pill':
      return rectElement({
        height: pad.height,
        pill: true,
        rotation: pad.ccw_rotation,
        style,
        width: pad.width,
        x: pad.x,
        y: pad.y,
      })
    case 'polygon':
      return polygonElement(pad.points, style)
  }
}

const platedHoleCopperElement = (
  pad: PcbPlatedHole,
  style: ShapeStyle,
) => {
  switch (pad.shape) {
    case 'circle':
      return ellipseElement({
        height: pad.outer_diameter,
        style,
        width: pad.outer_diameter,
        x: pad.x,
        y: pad.y,
      })
    case 'oval':
      return ellipseElement({
        height: pad.outer_height,
        rotation: pad.ccw_rotation,
        style,
        width: pad.outer_width,
        x: pad.x,
        y: pad.y,
      })
    case 'pill':
      return rectElement({
        height: pad.outer_height,
        pill: true,
        rotation: pad.ccw_rotation,
        style,
        width: pad.outer_width,
        x: pad.x,
        y: pad.y,
      })
    case 'circular_hole_with_rect_pad':
      return rectElement({
        cornerRadius: pad.rect_border_radius,
        height: pad.rect_pad_height,
        rotation: pad.rect_ccw_rotation,
        style,
        width: pad.rect_pad_width,
        x: pad.x,
        y: pad.y,
      })
    case 'pill_hole_with_rect_pad':
      return rectElement({
        cornerRadius: pad.rect_border_radius,
        height: pad.rect_pad_height,
        style,
        width: pad.rect_pad_width,
        x: pad.x,
        y: pad.y,
      })
    case 'rotated_pill_hole_with_rect_pad':
      return rectElement({
        cornerRadius: pad.rect_border_radius,
        height: pad.rect_pad_height,
        rotation: pad.rect_ccw_rotation,
        style,
        width: pad.rect_pad_width,
        x: pad.x,
        y: pad.y,
      })
    case 'hole_with_polygon_pad':
      return polygonElement(
        pad.pad_outline.map((point) => ({
          x: point.x + pad.x,
          y: point.y + pad.y,
        })),
        style,
      )
  }
}

const platedHoleDrillElement = (
  pad: PcbPlatedHole,
  style: ShapeStyle,
) => {
  const holeStyle = { ...style, hole: true }

  switch (pad.shape) {
    case 'circle':
      return ellipseElement({
        height: pad.hole_diameter,
        style: holeStyle,
        width: pad.hole_diameter,
        x: pad.x,
        y: pad.y,
      })
    case 'oval':
      return ellipseElement({
        height: pad.hole_height,
        rotation: pad.ccw_rotation,
        style: holeStyle,
        width: pad.hole_width,
        x: pad.x,
        y: pad.y,
      })
    case 'pill':
      return rectElement({
        height: pad.hole_height,
        pill: true,
        rotation: pad.ccw_rotation,
        style: holeStyle,
        width: pad.hole_width,
        x: pad.x,
        y: pad.y,
      })
    case 'circular_hole_with_rect_pad':
      return ellipseElement({
        height: pad.hole_diameter,
        style: holeStyle,
        width: pad.hole_diameter,
        x: pad.x + pad.hole_offset_x,
        y: pad.y + pad.hole_offset_y,
      })
    case 'pill_hole_with_rect_pad':
      return rectElement({
        height: pad.hole_height,
        pill: true,
        style: holeStyle,
        width: pad.hole_width,
        x: pad.x + pad.hole_offset_x,
        y: pad.y + pad.hole_offset_y,
      })
    case 'rotated_pill_hole_with_rect_pad':
      return rectElement({
        height: pad.hole_height,
        pill: true,
        rotation: pad.hole_ccw_rotation,
        style: holeStyle,
        width: pad.hole_width,
        x: pad.x + pad.hole_offset_x,
        y: pad.y + pad.hole_offset_y,
      })
    case 'hole_with_polygon_pad': {
      const diameter = pad.hole_diameter ?? 0
      const dimensions = {
        height: pad.hole_height ?? diameter,
        style: holeStyle,
        width: pad.hole_width ?? diameter,
        x: pad.x + pad.hole_offset_x,
        y: pad.y + pad.hole_offset_y,
      }

      if (pad.hole_shape === 'circle') {
        return ellipseElement(dimensions)
      }
      if (pad.hole_shape === 'oval') {
        return ellipseElement(dimensions)
      }
      return rectElement({
        ...dimensions,
        pill: true,
        rotation:
          pad.hole_shape === 'rotated_pill' ? pad.ccw_rotation : 0,
      })
    }
  }
}

const holeElement = (hole: PcbHole, style: ShapeStyle) => {
  const holeStyle = { ...style, hole: true }

  switch (hole.hole_shape) {
    case 'circle':
      return ellipseElement({
        height: hole.hole_diameter,
        style: holeStyle,
        width: hole.hole_diameter,
        x: hole.x,
        y: hole.y,
      })
    case 'square':
      return rectElement({
        height: hole.hole_diameter,
        style: holeStyle,
        width: hole.hole_diameter,
        x: hole.x,
        y: hole.y,
      })
    case 'rect':
      return rectElement({
        height: hole.hole_height,
        style: holeStyle,
        width: hole.hole_width,
        x: hole.x,
        y: hole.y,
      })
    case 'oval':
      return ellipseElement({
        height: hole.hole_height,
        style: holeStyle,
        width: hole.hole_width,
        x: hole.x,
        y: hole.y,
      })
    case 'pill':
      return rectElement({
        height: hole.hole_height,
        pill: true,
        style: holeStyle,
        width: hole.hole_width,
        x: hole.x,
        y: hole.y,
      })
    case 'rotated_pill':
      return rectElement({
        height: hole.hole_height,
        pill: true,
        rotation: hole.ccw_rotation,
        style: holeStyle,
        width: hole.hole_width,
        x: hole.x,
        y: hole.y,
      })
  }
}

const getRequiredBounds = (points: readonly Point[]): Bounds => {
  const bounds = getBoundsFromPoints([...points])
  if (!bounds) throw new Error('Cannot calculate bounds without points')
  return bounds
}

const getPolygonCenter = (points: readonly Point[]) =>
  getBoundsCenter(getRequiredBounds(points))

const getPadCenter = (pad: PcbSmtPad | PcbPlatedHole) =>
  pad.type === 'pcb_smtpad' && pad.shape === 'polygon'
    ? getPolygonCenter(pad.points)
    : { x: pad.x, y: pad.y }

const getPadId = (pad: PcbSmtPad | PcbPlatedHole) =>
  pad.type === 'pcb_smtpad' ? pad.pcb_smtpad_id : pad.pcb_plated_hole_id

const rotatePoint = (point: Point, degrees: number): Point => {
  const radians = (degrees * Math.PI) / 180
  return {
    x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: point.x * Math.sin(radians) + point.y * Math.cos(radians),
  }
}

const getRectBounds = (
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = 0,
): Bounds => {
  if (!rotation) {
    return getBoundFromCenteredRect({
      center: { x, y },
      height,
      width,
    })
  }

  const points = [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: height / 2 },
  ].map((point) => {
    const rotated = rotatePoint(point, rotation)
    return { x: rotated.x + x, y: rotated.y + y }
  })

  return getRequiredBounds(points)
}

const getHoleBounds = (hole: PcbHole) => {
  switch (hole.hole_shape) {
    case 'circle':
      return getRectBounds(
        hole.x,
        hole.y,
        hole.hole_diameter,
        hole.hole_diameter,
      )
    case 'square':
      return getRectBounds(
        hole.x,
        hole.y,
        hole.hole_diameter,
        hole.hole_diameter,
      )
    case 'rect':
      return getRectBounds(
        hole.x,
        hole.y,
        hole.hole_width,
        hole.hole_height,
      )
    case 'oval':
      return getRectBounds(
        hole.x,
        hole.y,
        hole.hole_width,
        hole.hole_height,
      )
    case 'pill':
      return getRectBounds(
        hole.x,
        hole.y,
        hole.hole_width,
        hole.hole_height,
      )
    case 'rotated_pill':
      return getRectBounds(
        hole.x,
        hole.y,
        hole.hole_width,
        hole.hole_height,
        hole.ccw_rotation,
      )
  }
}

const mergeBounds = (bounds: readonly Bounds[]): Bounds =>
  getRequiredBounds(
    bounds.flatMap((bound) => [
      { x: bound.minX, y: bound.minY },
      { x: bound.maxX, y: bound.maxY },
    ]),
  )

const getTransformedBounds = (
  bounds: Bounds,
  footprint: Footprint,
): Bounds => {
  const points = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ].map((point) => {
    const rotated = rotatePoint(point, footprint.rotation ?? 0)
    return {
      x: rotated.x + (footprint.x ?? 0),
      y: rotated.y + (footprint.y ?? 0),
    }
  })

  return getRequiredBounds(points)
}

const getLayerBounds = (footprint: Footprint) =>
  getTransformedBounds(
    mergeBounds([
      getFootprintBounds(footprint.pads),
      ...footprint.holes.map(getHoleBounds),
    ]),
    footprint,
  )

export function FootprintSvg({
  layers,
  showLabels = true,
}: FootprintSvgProps) {
  const patternId = useId().replace(/:/g, '')
  const merged =
    layers.length > 0
      ? mergeBounds(layers.map((layer) => getLayerBounds(layer.footprint)))
      : getRectBounds(0, 0, 1, 1)
  const mergedWidth = merged.maxX - merged.minX
  const mergedHeight = merged.maxY - merged.minY
  const padX = Math.max(mergedWidth * 0.18, 0.65)
  const padY = Math.max(mergedHeight * 0.18, 0.65)
  const paddedBounds = {
    maxX: merged.maxX + padX,
    maxY: merged.maxY + padY,
    minX: merged.minX - padX,
    minY: merged.minY - padY,
  }
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

        {layers.map((layer) => {
          const style = {
            accent: layer.accent,
            fillOpacity: layer.fillOpacity,
          }

          return (
            <g
              key={layer.label}
              transform={`translate(${layer.footprint.x ?? 0} ${-(layer.footprint.y ?? 0)})`}
            >
              <g
                transform={
                  layer.footprint.rotation
                    ? `rotate(${-layer.footprint.rotation})`
                    : undefined
                }
              >
                {layer.footprint.pads.map((pad, padIndex) => {
                  const padId = getPadId(pad)
                  const center = getPadCenter(pad)

                  return (
                    <g
                      key={`${padId || pad.port_hints?.join('-') || padIndex}`}
                    >
                      {pad.type === 'pcb_smtpad'
                        ? smtPadElement(pad, style)
                        : platedHoleCopperElement(pad, style)}
                      {pad.type === 'pcb_plated_hole'
                        ? platedHoleDrillElement(pad, style)
                        : null}
                      {showLabels ? (
                        <text
                          x={center.x}
                          y={-center.y}
                          fill="rgba(248,250,252,0.88)"
                          fontSize="0.24"
                          fontFamily="ui-monospace, SFMono-Regular, monospace"
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {pad.port_hints?.[0] ?? padId}
                        </text>
                      ) : null}
                    </g>
                  )
                })}
                {layer.footprint.holes.map((hole, holeIndex) => (
                  <g key={hole.pcb_hole_id || `hole-${holeIndex}`}>
                    {holeElement(hole, style)}
                  </g>
                ))}
              </g>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
