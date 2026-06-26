# fast-footprint-compare

Internal site for validating a `footprinter` string against the JLCPCB/EasyEDA
footprint for an exact JLCPCB part number.

## What it does

- accepts a footprint string only when `@tscircuit/footprinter` can build it directly
- accepts a JLC part only when EasyEDA resolves the exact same `C...` supplier number
- left side preview for a footprinter string
- right side preview for a JLCPCB part number
- aligned overlay preview
- pad-only IoU score
- heatmap showing overlap, footprinter-only, and JLC-only geometry
- matched pin metrics for center, size, and rotation deltas

## Stack

- React + Vite for the UI
- small Express API for `footprinter` and `easyeda` adapters
- `@tscircuit/footprinter` for left-side geometry
- `easyeda` for JLCPCB footprint lookup and conversion

## Validation rules

- No local footprint aliases or fallback parsing are applied. If `@tscircuit/footprinter` rejects the string, this app rejects it too.
- Only exact `C...` JLCPCB/LCSC supplier numbers are accepted.
- EasyEDA fuzzy matches are rejected. Analysis is shown only after both sides validate successfully.

## Development

```bash
bun install
bun run dev
```

This starts:

- Vite on `http://localhost:5173`
- API server on `http://localhost:8787`

## Production build

```bash
bun run build
bun run start
```

This starts the API on `http://localhost:8787`.

## Main API routes

- `POST /api/compare`

## Example input

- footprinter string: `sot23_6`
- JLCPCB part number: `C2149796`
