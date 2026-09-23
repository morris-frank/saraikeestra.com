<p align="center">
  <a href="https://sarai-keestra.com">
    <img src="https://img.shields.io/badge/%E2%86%97%20sarai--keestra.com-D78A7A?style=for-the-badge&amp;labelColor=2D2825" alt="Open sarai-keestra.com">
  </a>
</p>

<img src="brand/icon/icon-saraikeestra-on-obsidian-1024.png" align="left" width="128" hspace="16" alt="sarai-keestra.com icon">

<h3>sarai-keestra.com</h3>

<p>
  <sub>JSON IN, ONE STATIC PAGE OUT</sub>
  <br>
  <strong>Personal site of Sarai Keestra, medical researcher at Amsterdam UMC.</strong>
  <br>
  <br>
  <img src="https://img.shields.io/badge/generator-node-D78A7A?style=flat-square&amp;labelColor=2D2825" alt="Node generator">
  <a href="references.bib"><img src="https://img.shields.io/badge/publications-BibTeX-D78A7A?style=flat-square&amp;labelColor=2D2825" alt="Publications from BibTeX"></a>
  <a href="#edit-mode-on-the-live-site"><img src="https://img.shields.io/badge/edit-click%20%E2%86%92%20GitHub-7E9688?style=flat-square&amp;labelColor=2D2825" alt="Click to edit on GitHub"></a>
</p>

<br clear="left">

```bash
pnpm build      # content/*.json + references.bib → public/index.html + hashed CSS
pnpm preview    # build, then serve public/ at http://127.0.0.1:4173
```

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
