# gar-front-end-data

A data service for the Gulf Coast Radar front end: an Express server on Vercel that serves business (entity) data from cached JSON files, plus the Node scripts that fetched, merged and organized that data in May 2026.

Superseded by [`gcr-api-clean`](https://github.com/CultureReset/gcr-api-clean). Nothing current reads from it.

## How it works

- **`data/`** holds one JSON file per business (`data/entities/`) and index files that list them all. The scripts built it by pulling every business from the launching-GCR API, adding Google Place IDs, and consolidating duplicate records.
- **`server.js`** serves that data with CORS and a five-minute in-memory cache, plus a small `/dashboard` page and `POST /api/cache/clear`.
- **Scripts:** `batch-fetch-entities.js`, `consolidate-*.js`, `apply-category-organization.js`, `add-google-place-ids.js`, `analyze-current-data.js` and `RUN-FINAL-MERGE.sh` are the one-off steps of that data cleanup. `SECTIONS-INTEGRATION-GUIDE.md` and `DEPLOYMENT-STATUS.md` record how it was wired.

## Run it

```bash
npm install
npm start          # or: npm run dev
npm run sync       # re-pull data
```
