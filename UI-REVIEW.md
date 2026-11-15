# UI detail review — sarai-keestra.com

2026-11-15 · TypeUI UI-foundations and micro-interaction libraries · fixes applied in the same change

## 1. Scope and system

- **Scope:** the whole site: one generated page (`scripts/build-site.mjs` → `public/index.html`) and `theme/*.css`.
- **Stack:** a Node string-template generator, plain CSS split into four layers (tokens, base, layout, sections) and about 50 lines of inline vanilla JS. There is no framework and no component library.
- **Design-system source:** `theme/00-tokens.css` (colour roles, the hand/sans type pair, radii, light and dark themes via `prefers-color-scheme`). No `DESIGN.md` exists.
- **Motion:** `0.2–0.35s ease` colour, opacity and background-size transitions. `prefers-reduced-motion` turns off smooth scroll, link transitions and the chapter-menu fade.
- **Focus convention:** a global `:focus-visible` ring, `2px solid var(--plum)`, offset 3px (`theme/10-base.css:35`).
- **Rendered vs read:** I only read the source. Headless Chrome would not start in the sandbox, so every rendered check is listed under §7. Contrast ratios are computed from token values.

## 2. Inventory

| Component | File(s) | Instances | Category |
| --- | --- | --- | --- |
| Theme filter chips | `build-site.mjs:524`, `30-sections.css:45` | 5 | 03-selection-controls |
| Chapter menu (fixed, scroll-spy) | `build-site.mjs:209`, `30-sections.css:188` | 1 menu, 6 links | 08-navigation |
| Profile badges | `build-site.mjs:195`, `30-sections.css:13` | social links | 01-buttons (links) |
| Read more (about clamp) | `build-site.mjs:290`, `30-sections.css:62` | 1 | 01-buttons |
| Author-list toggle | `build-site.mjs:507` | long author lists | 01-buttons |
| `details` reveals (More, Abstract, Show all) | `build-site.mjs:379, 419, 509` | many | 09-lists |
| Cards (feature, news, theme, glance) | `build-site.mjs:243–341` | ~10 | 11-cards |
| Compact and dated lists, publications | `30-sections.css:92, 151` | 6 lists | 09-lists |
| Inline prose links | `renderRichText`, `home.json` | 6 in About, plus venue and footer links | text |

## 3. Findings (all confirmed issues fixed)

| # | Rule | Component | Evidence | Problem | Fix applied |
| --- | --- | --- | --- | --- | --- |
| 1 | `book-text/recognizable-links` + WCAG 1.4.1 | About prose, publication version links, footer | `10-base.css:27` (`text-decoration: none`) | In light mode, an inline link (`--rose` #5e3a8c) against prose (`--ink-2` #554a44) is **1.00:1**. The links are readable only by hue until hover. Venue and footer links reach about 2.0:1 against `--muted`. | A thin underline (45% of the link colour) on `.prose a, .venue a, .footer a`. The highlighter hover is unchanged. |
| 2 | `input-contrast/text-contrast` | Every `--muted` text: years, venues, meta, institution, glance labels, captions, footer, chip counts | `00-tokens.css:20` | #857a72 is **4.18:1** on paper and **4.11:1** on card, and is used for 0.68–0.85rem text, below 4.5:1. | `--muted` changed to #7d726b (**4.68 / 4.60**). Same hue, one step darker. Dark theme already passes. |
| 3 | `focus-visible/focus-visible` (clipping) | Chapter menu links | `30-sections.css:199` (`overflow-x: auto`) | The scroll strip has no padding, so the ring (3px offset plus 2px width) is clipped at its top and bottom. | `.chapters-links a:focus-visible { outline-offset: -2px }` keeps the ring inside the link. |
| 4 | `focus-visible` (obscured) / WCAG 2.4.11 | About prose clamp | `30-sections.css:62`, `build-site.mjs:601` | While clamped, the links below the 17rem fade can still take keyboard focus but cannot be seen. Activating Read more hides the button and drops focus to `<body>`. | Focus inside the prose opens it. When the button had focus, focus moves to the opened prose (`tabIndex=-1`, `preventScroll`). |
| 5 | `press-feedback/chip` (accessible state) | Theme filter chips | `build-site.mjs:524, 623` | The selected chip is shown only by fill. Screen readers get no pressed state. | `aria-pressed` is rendered and kept in sync with `is-on`. |
| 6 | `08-navigation` state | Chapter menu scroll-spy | `build-site.mjs:592` | The active chapter is shown only by the ink fill. | `aria-current="location"` is set on the active link and removed from the others. |

Already working: the global focus ring (8.4:1 light, 8.1:1 dark), reduced-motion handling, `aria-expanded` on the author toggle, the hidden chapter menu using `visibility` (so it cannot take focus), and 24px targets for chips and badges (computed heights of about 34px and 28px).

Not fixed (deferred, one line each):
- Sticky `:hover` highlight after a tap on touch devices. This is cosmetic, and fixing it would mean wrapping every hover rule in `@media (hover: hover)`.
- The "More", "Abstract" and "Show all" summaries are 0.8rem text (about 20px tall). They likely pass WCAG 2.5.8 through its spacing exception. This is unverified.

## 4. Micro-interaction proposals

None applied. Every user action on the page already gives immediate, unambiguous feedback: a chip fills, a `details` toggles its +/− sign, the chapter link fills, and the highlighter sweeps on hover. Nothing is async apart from the native `<video>` controls. Considered and rejected:
- A press scale on chips. The system has no press language, and selection is already instant.
- Animating the publication-list filter. This is decoration on an instant result.

## 5. Contrast table (computed, not rounded up)

| Element | FG | BG | Ratio | Requirement | Result |
| --- | --- | --- | --- | --- | --- |
| Muted text, light (before) | #857a72 | #ffffff | 4.18 | 4.5 | fail → fixed |
| Muted text on card, light (before) | #857a72 | #fdfdff | 4.11 | 4.5 | fail → fixed |
| Muted text, light (after) | #7d726b | #ffffff | 4.68 | 4.5 | pass |
| Muted text on card, light (after) | #7d726b | #fdfdff | 4.60 | 4.5 | pass |
| Body `--ink-2`, light | #554a44 | #ffffff | 8.57 | 4.5 | pass |
| Link `--rose`, light | #5e3a8c | #ffffff | 8.54 | 4.5 | pass |
| Link vs surrounding prose, light | #5e3a8c | #554a44 | 1.00 | 3:1 or non-colour cue | fail → underline |
| Link vs surrounding prose, dark | #b9a0e0 | #c9bfb8 | 1.27 | 3:1 or non-colour cue | fail → underline |
| Distinction badge, light | #6e3f52 | #eadde3 | 6.39 | 4.5 | pass |
| Topic `.more` sage / terracotta / blue / ochre on card, light | — | #fdfdff | 4.56 / 4.60 / 5.32 / 4.88 | 4.5 | pass |
| Muted text, dark | #9a8f88 | #1b1b1b | 5.46 | 4.5 | pass |
| Muted text on card, dark | #9a8f88 | #232026 | 5.10 | 4.5 | pass |
| Distinction badge, dark | #d6a4b8 | #3f2d35 | 6.02 | 4.5 | pass |
| Active chip / chapter, dark | #1b1b1b | #ece6e1 | 13.9 | 4.5 | pass |
| Focus ring, light / dark | plum | paper | 8.41 / 8.09 | 3:1 | pass |
| Chip border (`--line-strong`), light | composite #d1d0cf | #ffffff | 1.54 | n/a: the label identifies the control | — |

## 6. Values the system does not define, and conflicts

- **No press or active state token.** None was added.
- **No underline token.** The link underline reuses `currentColor` at 45% through `color-mix`, the same mechanism the tokens already use for `--line-*`.
- **Conflict:** the design convention of unadorned inline links meets WCAG 1.4.1. Accessibility won, using the quietest underline that still gives a non-colour cue.

## 7. Unverified

- Everything rendered: the actual underline appearance, the focus ring inside the chapter strip, and the focus behaviour of the prose clamp under real keyboard use. Headless Chrome did not start in the sandbox.
- White figcaption text over the feature photo (`30-sections.css:26`). This depends on the image, so I could not compute it.
- Forced-colours mode, 200% zoom, screen-reader announcement of `aria-pressed` and `aria-current`.
- Third-party Altmetric and Dimensions badge popovers.
