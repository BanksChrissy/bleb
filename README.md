# Clinical Guideline Atlas

Static clinical guideline reference site: https://bankschrissy.github.io/bleb/

This repository contains 35 direct guideline references and 32 official specialty library links. Search by topic, specialty, year and document type, save favorites in the current browser, copy references, and export a CSV.

## Updating sources
- Individual guideline records are in `data/guidelines.json`.
- Specialty directories are in `data/societies.json`.
- Prefer original publisher and journal links.
- Record publisher-reported publication years, intended population, type and reference date.
- A publication year does not mean the document is the newest version.
- A `reviewFlag` should reflect an explicitly documented publisher update only.
- Evidence grades belong to individual recommendations. Do not invent a single score for an entire guideline.

## Automated audit
The optional `.github/workflows/link-check.yml` runs Sundays at 09:17 UTC and on demand. `tools/check_links.py` checks for HTTP accessibility and writes `data/link-status.json`. Publishers may block bots, so 403 and 429 are marked *blocked*, not broken. 404/410 are *possible-broken* and require human review. This does **not** monitor scientific currency or automatic guideline supersession.

For Actions to commit results, GitHub Actions must be enabled and `contents:write` permission allowed for the workflow.

## Preview
Run `python3 -m http.server 8000` in the repo root and visit `http://localhost:8000`.

This is a discovery and educational index, not a clinical protocol. Consult full publisher guidance and your local clinical policies before patient care. Copyrights remain with the respective organizations.
