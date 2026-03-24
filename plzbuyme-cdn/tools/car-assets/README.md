# PBM-25 Car Thumbnail Manifest

This tooling builds a single manifest for GT7 car thumbnails so the app can load images directly from the GT CDN without downloading local copies.

## What It Does

1. Scrapes the GT7 car list bundle to discover stable car IDs.
2. Resolves GT7 metadata chunks for car/tuner data.
3. Auto-labels `make`, parsed `model`, parsed `year`, and sets `color` to `Unknown`.
4. Writes one all-in-one manifest with direct `sourceUrl` values (GT CDN).

## Scripts

### Generate manifest from GT7

```bash
cd plzbuyme-cdn/tools/car-assets
node generate-gt7-source-list.mjs
```

Default output:

- `manifests/gt7-car-thumbnails.manifest.json`

## Curation Workflow

`generate-gt7-source-list.mjs` now auto-populates:

- `make` from GT7 tuner/manufacturer metadata
- `model` and `year` parsed from GT7 `nameLong`
- `color` as `"Unknown"` (GT7 metadata does not expose a reliable color field)

You should still review `needs-curation` and `needs-color-curation` tagged rows before production publish.

## Rerun / Refresh Workflow

1. Regenerate manifest:
   - `node generate-gt7-source-list.mjs`
2. (Optional) Apply curation edits (`make`, `model`, `year`, `color`) and commit.
3. App uses each entry's `sourceUrl` directly.
