# Source Strategy

## Search Sources

Use these sources in order:

1. `arXiv`
   - Best for preprints and direct PDF access.
   - Stable API for query + metadata.
   - PDF can usually be derived from the arXiv ID.
2. `Semantic Scholar`
   - Good for broad discovery and `openAccessPdf`.
   - Use it as a metadata and open-access PDF source, not as a paywall bypass.
3. `OpenAlex`
   - Good for open-access status, DOI, landing pages, and PDF URLs when available.
4. `Hugging Face daily_papers`
   - Discovery source for fresh ML papers.
   - Treat it as a lead source and map back to arXiv or DOI when possible.

## Legal Constraints

- Download only openly accessible PDFs.
- Do not add publisher scraping that tries to bypass login walls or CAPTCHAs.
- If the paper is traceable but not downloadable, keep the metadata and mark `pdf_status: unavailable`.

## Metadata Fields

Each record should preserve these fields when available:

- `title`
- `authors`
- `year`
- `abstract`
- `source`
- `landing_page`
- `pdf_url`
- `doi`
- `arxiv_id`
- `local_pdf_path`
- `local_markdown_paths`

## Suggested User Inputs

Ask only when needed:

- query or topic
- time window
- paper count
- open-access only or metadata-only fallback
- local input directory, if the user already has PDFs

## Environment Variables

- `PADDLEOCR_API_URL`
- `PADDLEOCR_TOKEN`
- `OPENALEX_MAILTO`

`OPENALEX_MAILTO` is optional but recommended for polite API usage.
