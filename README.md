# fast-footprint-compare

Internal site for validating a `footprinter` string against the JLCPCB/EasyEDA
footprint for an exact JLCPCB part number.

## What it does

- accepts a footprint string only when `@tscircuit/footprinter` can build it directly
- accepts a JLC part only when EasyEDA resolves the exact same `C...` supplier number
- left side preview for a footprinter string
- right side preview for a JLCPCB part number
- aligned overlay preview
- separate copper and drilled-hole IoU scores
- numeric pin match rate with position-level mismatch details
- heatmap showing overlap, footprinter-only, and JLC-only geometry
- matched pin metrics for center, size, and rotation deltas
- automatic discovery of ranked footprinter strings from a JLCPCB part number

## Footprinter discovery

Discovery combines package-domain heuristics with numerical optimization:

1. The JLC footprint is classified by pad kind and topology (linear, dual-row,
   quad-sided, grid, or irregular).
2. Plausible seeds are generated from the footprint families and standard sizes
   exposed by the installed `@tscircuit/footprinter` version.
3. Parameters that actually change each seed's copper geometry are detected.
4. Continuous dimensions are refined with finite-difference gradients and Adam.
5. Valid candidates are ranked by copper IoU, package-name evidence, and a
   pad-position/size geometry score.

The best result is loaded into the comparator automatically, while alternative
ranked strings remain available for review.

## Stack

- React + Vite for the UI
- small Express API for `footprinter` and `easyeda` adapters
- `circuit-json-to-footprinter` for footprint generation, shared shape geometry,
  and copper/hole comparison
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
- `POST /api/discover`

`POST /api/discover` accepts an exact JLCPCB part number and an optional result
limit:

```json
{
  "jlcpcbPartNumber": "C2149796",
  "maxCandidates": 5
}
```

## Example input

- footprinter string: `sot23_6`
- JLCPCB part number: `C2149796`
