import { expect, test } from 'bun:test'
import {
  buildFootprinterPreview,
  PreviewBuildError,
} from '../server/footprints.js'

test('builds footprinter previews through the shared library', () => {
  const preview = buildFootprinterPreview('0402')

  expect(preview.title).toBe('0402')
  expect(preview.subtitle).toBe('Validated directly by @tscircuit/footprinter')
  expect(preview.pads.length).toBeGreaterThan(0)
})

test('keeps API-specific validation errors in the app', () => {
  expect(() => buildFootprinterPreview('')).toThrow(PreviewBuildError)

  try {
    buildFootprinterPreview('')
  } catch (error) {
    expect(error).toMatchObject({
      code: 'FOOTPRINTER_REQUIRED',
      field: 'footprinterString',
      status: 400,
    })
  }
})
