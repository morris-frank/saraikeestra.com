# UI detail review — sarai-keestra.com

2026-11-26 · re-review after the surface-stack, squircle and dark-token changes (since `1167ca3`) · review only, nothing applied

## 1. Scope and system

- **Scope:** the whole site: `scripts/build-site.mjs` (generated page + ~90 lines of inline JS) and `theme/*.css`.
- **Stack:** Node string templates, four plain CSS layers, no framework.
- **Design system:** sparse, in `theme/00-tokens.css`. Defined: colour (incl. a new 5-step surface ladder in `lch()` for light and dark), type pair (Caveat / Alegreya Sans), radii (6 / 10 / 12 / pill), one shadow per theme, gutter/space. Undefined: type scale, spacing scale, motion durations, press state.
- **Motion:** 0.2–0.35s `ease` colour/opacity transitions; `prefers-reduced-motion` covers smooth scroll, link transitions and the chapter-menu fade.
- **Focus:** global `2px solid var(--plum)`, offset 3px (`theme/10-base.css:32`).
- **Rendered vs read:** read only. Contrast ratios are computed from the token values (CSS `lch()` → sRGB, D50→D65), not sampled from a render.

## 2. Inventory (changed or new since the last review)

| Element | Location | Role | Match |
| --- | --- | --- | --- |
| Surface stack: page / panel / card / well | `00-tokens.css:13–23` | page frame, cards | direct (08, 19) |
| Theme filter chips (on the publications surface) | `build-site.mjs:509`, `30-sections.css:96–100` | chooses a state | direct |
| Chapter menu, active pill | `30-sections.css:205–216` | moves between views | direct |
| Phone "Show all" reveal + card tap | `build-site.mjs:364, 374, 626–631`, `30-sections.css:150–156` | expands content | direct |
| Read more (about clamp) | `build-site.mjs:293, 588–597` | expands content | direct |
| Footer build time | `build-site.mjs:682`, `20-layout.css:62` | text | direct |
| Inline prose links (highlight removed in `abaea65`) | `10-base.css:29` | triggers navigation | direct |

## 3. Findings

| # | Rule | Component | Evidence | Problem | Smallest fix |
| --- | --- | --- | --- | --- | --- |
| 1 | WCAG 1.4.3 text contrast | All `--muted` text on the page and in active wells | `00-tokens.css:24` vs `:15` | The tinted page (`23563f8`) dropped `--muted` from 4.68 to **4.30:1** (hero `.role`, footer). Inside the selected chip (`--paper-2`) the count is **3.80:1**. | `--muted: #71665f` → 5.12 on page, 4.53 on the chip well, 5.57 on card. Dark already passes. |
| 2 | WCAG 1.4.3 | Footer "Built …" line | `20-layout.css:62` (`opacity: 0.7`) | 0.72rem muted text at 70% opacity is **2.56:1** light, 3.58:1 dark. | Drop the `opacity`; size already makes it secondary. |
| 3 | WCAG 2.4.3 focus order | Phone "Show all" buttons | `build-site.mjs:628` | `open()` hides the focused button, so keyboard/switch focus falls to `<body>`. Same defect the Read-more fix closed last round. | In `open()`, move focus to the first newly shown link (`r.querySelector("li:nth-child(2) a")?.focus()`), only when the button had focus. |
| 4 | WCAG 1.4.11 non-text / `14-*` state | Selected theme chip | `30-sections.css:99` | Selected vs unselected is fill only: `--paper-2` vs white = **1.23:1** (dark 1.11). Text goes `--ink-2`→`--ink`, also subtle. `aria-pressed` covers AT, not sighted users. | Add a non-fill cue to `.chip.is-on`, e.g. `font-weight: 500` or an inset `--line-strong` border. |
| 5 | WCAG 1.4.11 / navigation state | Chapter menu active pill | `30-sections.css:212` | Current chapter is `--pill-on` on `--panel` = **1.14:1** (dark 1.29). | Same cue as #4 (weight 500), so the two pill controls share one "on" language. |

Already working: focus ring on the new surfaces (7.7:1 light page, 8.2–9.3:1 dark), `--ink-2` and `--rose` on the tinted page (7.9 / 7.8), topic `.more` colours on card (4.6–5.4 light, 6.5–7.5 dark), the clipped-ring fix on chapter links, the Read-more focus hand-off, `aria-pressed` / `aria-current` sync, reduced-motion coverage.

Not applicable: card-vs-page boundary (1.09:1) and outlined chip border (1.23:1). Both are decorative grouping; the label identifies the control.

Deferred, one line each:
- `.feature blockquote p` hard-codes `#000` / `#fff` (`30-sections.css:28–29`) instead of `--ink`; harmless, off-system.
- `--on-ink` is defined but no longer used after the chip/chapter restyle.

## 4. Micro-interaction proposals

1. **Inline-link hover** (S). Since `abaea65` removed the highlighter, prose/venue/footer links have no hover change at all: colour stays `--rose`, underline stays at 45%. Hovering a link in the About text gives no sign it is live. Proposal: on `:hover` raise the underline to `currentColor` (100%) — `micro-interactions/buttons` link-hover pattern, reusing the existing 0.2s colour transition; reduced-motion already sets `transition: none`, so it becomes an instant swap.
2. **Phone reveal hand-off** (S). Same change as finding #3; seen as feedback, the revealed list should be where focus and the eye land.

Rejected (restrained register): press scale on chips and chapter pills (selection is instant and unambiguous); animating the publication filter or the list reveal (decoration on an instant result).

## 5. Contrast table (computed, not rounded up)

| Element | FG | BG | Ratio | Req. | Result |
| --- | --- | --- | --- | --- | --- |
| Muted text on page, light | #7d726b | #f6f5f8 | 4.30 | 4.5 | **fail** |
| Muted text on card, light | #7d726b | #ffffff | 4.68 | 4.5 | pass |
| Muted count in selected chip, light | #7d726b | #e8e7ea | 3.80 | 4.5 | **fail** |
| Muted in chapter active pill, light | #7d726b | #ececed | 3.97 | 4.5 | n/a (no muted text there today) |
| Footer "Built" (muted @ 0.7), light | ≈#a19995 | #f6f5f8 | 2.56 | 4.5 | **fail** |
| Footer "Built", dark | ≈#6f6762 | #0a090a | 3.58 | 4.5 | **fail** |
| Proposed muted #71665f on page / well / card | #71665f | — | 5.12 / 4.53 / 5.57 | 4.5 | pass |
| Body `--ink-2` on page, light | #554a44 | #f6f5f8 | 7.88 | 4.5 | pass |
| Link `--rose` on page, light | #5e3a8c | #f6f5f8 | 7.84 | 4.5 | pass |
| Focus ring on page, light / dark | plum | page | 7.73 / 9.32 | 3:1 | pass |
| Selected vs unselected chip fill, light / dark | #e8e7ea / #242325 | #ffffff / #1a1a1b | 1.23 / 1.11 | 3:1 (state) | **fail** |
| Active vs idle chapter pill, light / dark | #ececed / #2a292a | #fbfbfc / #121213 | 1.14 / 1.29 | 3:1 (state) | **fail** |
| Muted on page / card / well, dark | #9a8f88 | #0a090a / #1a1a1b / #242325 | 6.30 / 5.52 / 4.97 | 4.5 | pass |
| Topic `.more` terracotta / sage / ochre / blue on card, light | — | #ffffff | 4.68 / 4.63 / 4.96 / 5.40 | 4.5 | pass |

## 6. System grade and upstream values

- **Grade:** sparse (colour, type families, radius, elevation defined; type scale, spacing scale, motion, press state not).
- **Upstream values used:** none. Every proposed fix reuses an existing token or weight (`--line-strong`, font-weight 500, `currentColor`).
- **Conflict:** the deliberately low-contrast surface ladder (fill-only "on" states) vs WCAG 1.4.11. Accessibility wins; the suggested fix adds a weight/border cue and leaves the ladder intact.

## 7. Unverified

- Everything rendered, incl. light/dark appearance of the new ladder and squircle corners (`corner-shape` is Chromium-only; other engines fall back to round).
- Target size (WCAG 2.5.8): `.m-more` (~16px tall, 0.8rem, no padding), `.read-more` (~23px), chapter links (~24px). Likely pass via the spacing exception; needs a render.
- Real keyboard pass of the phone reveal and card-tap behaviour; forced-colours (fill-only states vanish there too, which #4/#5 would also cover); 200% zoom.
- White figcaption over the feature photo (image-dependent); third-party Altmetric/Dimensions popovers.
