import { useEffect, useRef } from 'react'
import type { RasterComparison } from '../lib/types'

interface DiffHeatmapProps {
  comparison: RasterComparison
}

const COLOR_MAP: Record<number, [number, number, number, number]> = {
  0: [6, 15, 24, 255],
  1: [245, 158, 11, 255],
  2: [34, 211, 238, 255],
  3: [74, 222, 128, 255],
}

export function DiffHeatmap({ comparison }: DiffHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const renderHeatmap = () => {
      const rect = canvas.getBoundingClientRect()
      const displayWidth = Math.max(1, Math.round(rect.width))
      const displayHeight = Math.max(1, Math.round(rect.height))
      const devicePixelRatio = window.devicePixelRatio || 1
      const renderWidth = Math.round(displayWidth * devicePixelRatio)
      const renderHeight = Math.round(displayHeight * devicePixelRatio)

      if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
        canvas.width = renderWidth
        canvas.height = renderHeight
      }

      const { gridSize, occupancy } = comparison
      const imageCanvas = document.createElement('canvas')
      imageCanvas.width = gridSize
      imageCanvas.height = gridSize

      const imageContext = imageCanvas.getContext('2d')
      if (!imageContext) return

      const image = imageContext.createImageData(gridSize, gridSize)

      for (let index = 0; index < occupancy.length; index += 1) {
        const pixelOffset = index * 4
        const [red, green, blue, alpha] = COLOR_MAP[occupancy[index]] ?? COLOR_MAP[0]
        image.data[pixelOffset] = red
        image.data[pixelOffset + 1] = green
        image.data[pixelOffset + 2] = blue
        image.data[pixelOffset + 3] = alpha
      }

      imageContext.putImageData(image, 0, 0)

      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, renderWidth, renderHeight)
      context.scale(devicePixelRatio, devicePixelRatio)
      context.fillStyle = '#020617'
      context.fillRect(0, 0, displayWidth, displayHeight)
      context.imageSmoothingEnabled = false

      const inset = 20
      const plotSize = Math.max(1, Math.min(displayWidth, displayHeight) - inset * 2)
      const plotX = (displayWidth - plotSize) / 2
      const plotY = (displayHeight - plotSize) / 2

      context.drawImage(imageCanvas, plotX, plotY, plotSize, plotSize)
    }

    renderHeatmap()

    const resizeObserver = new ResizeObserver(() => {
      renderHeatmap()
    })

    resizeObserver.observe(canvas)

    return () => {
      resizeObserver.disconnect()
    }
  }, [comparison])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: '#4ade80' }}
          ></span>
          overlap
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: '#f59e0b' }}
          ></span>
          footprinter only
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: '#06b6d4' }}
          ></span>
          JLCPCB only
        </span>
      </div>
      <canvas
        className="h-[340px] w-full rounded-2xl border border-slate-800 bg-slate-950 shadow-inner [image-rendering:pixelated]"
        ref={canvasRef}
      ></canvas>
    </div>
  )
}
