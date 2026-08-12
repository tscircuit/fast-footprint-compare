import type { Footprint } from './types'

export const hasDrilledGeometry = (footprint: Footprint) =>
  footprint.holes.length > 0 ||
  footprint.vias.length > 0 ||
  footprint.pads.some((pad) => pad.type === 'pcb_plated_hole')
