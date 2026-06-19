# Sarai Keestra website

Static personal site built with a node-based generator.

## Content files

Visible site content lives in these files:

- `content/site.json`
- `content/home.json`
- `content/education.json`
- `content/experience.json`
- `content/science-communication.json`
- `content/publications.json`
- `references.bib`

## Edit mode on the live site

The generated page exposes `window.enableConfigEditMode()`.

- Run `window.enableConfigEditMode()` in the browser console, or open `https://sarai-keestra.com/?edit=1`
- Click any highlighted content block
- The page redirects to the matching GitHub edit URL for that source file

This is meant to let a non-technical editor click the part they want to change and land in the right file directly.

## Build

```bash
pnpm build
```

The generator writes `public/index.html` and a hashed stylesheet into `public/`.

## Preview locally

```bash
pnpm preview
```

This builds the site and serves `public/` at `http://127.0.0.1:4173`.
