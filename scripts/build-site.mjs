import crypto from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
const themeDir = path.join(root, "theme");

const readJson = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const readText = async (file) => readFile(path.join(root, file), "utf8");

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const slugifyTopic = (value = "") =>
  String(value)
    .split("&")[0]
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

const externalLinkAttrs = ' target="_blank" rel="noreferrer noopener"';
const sourceAttrs = (file, label = file) =>
  ` data-source-file="${escapeHtml(file)}" data-source-label="${escapeHtml(label)}"`;

function renderLink(href, text, extra = "") {
  return `<a href="${escapeHtml(href)}"${externalLinkAttrs}${extra}>${escapeHtml(text)}</a>`;
}

function renderRichText(parts = []) {
  return parts
    .map((part) => {
      if (part.href) {
        return renderLink(part.href, part.text);
      }
      return escapeHtml(part.text || "");
    })
    .join("");
}

function stripBib(value = "") {
  return String(value)
    .replaceAll(/\s+/g, " ")
    .replaceAll("{", "")
    .replaceAll("}", "")
    .replaceAll("\\_", "_")
    .replaceAll("\\&", "&")
    .replaceAll(" ", " ")
    .replaceAll("Kees tra", "Keestra")
    .trim();
}

function splitAuthors(value = "") {
  return stripBib(value)
    .split(/\s+and\s+/i)
    .map((author) => author.trim())
    .filter(Boolean);
}

function parseBibtex(source) {
  const entries = [];
  let index = 0;
  while (index < source.length) {
    const at = source.indexOf("@", index);
    if (at === -1) break;
    const typeEnd = source.indexOf("{", at);
    if (typeEnd === -1) break;
    const type = source.slice(at + 1, typeEnd).trim().toLowerCase();
    let depth = 1;
    let cursor = typeEnd + 1;
    while (cursor < source.length && depth > 0) {
      if (source[cursor] === "{") depth += 1;
      if (source[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    const body = source.slice(typeEnd + 1, cursor - 1);
    const comma = body.indexOf(",");
    if (comma > -1) {
      const key = body.slice(0, comma).trim();
      const fieldsText = body.slice(comma + 1);
      entries.push({ type, key, fields: parseBibFields(fieldsText) });
    }
    index = cursor;
  }
  return entries;
}

function parseBibFields(fieldsText) {
  const fields = {};
  let index = 0;
  while (index < fieldsText.length) {
    const match = fieldsText.slice(index).match(/([A-Za-z-]+)\s*=/);
    if (!match) break;
    const name = match[1].toLowerCase();
    index += match.index + match[0].length;
    while (/\s/.test(fieldsText[index] || "")) index += 1;
    const opener = fieldsText[index];
    let value = "";
    if (opener === "{") {
      let depth = 1;
      index += 1;
      const start = index;
      while (index < fieldsText.length && depth > 0) {
        if (fieldsText[index] === "{") depth += 1;
        if (fieldsText[index] === "}") depth -= 1;
        index += 1;
      }
      value = fieldsText.slice(start, index - 1);
    } else if (opener === '"') {
      index += 1;
      const start = index;
      while (index < fieldsText.length && fieldsText[index] !== '"') index += 1;
      value = fieldsText.slice(start, index);
      index += 1;
    } else {
      const start = index;
      while (index < fieldsText.length && fieldsText[index] !== ",") index += 1;
      value = fieldsText.slice(start, index);
    }
    fields[name] = stripBib(value);
    while (index < fieldsText.length && fieldsText[index] !== ",") index += 1;
    index += 1;
  }
  return fields;
}

function renderSocialIcon(icon, label) {
  if (icon === "linkedin") {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" />
      <path d="M8 11l0 5" />
      <path d="M8 8l0 .01" />
      <path d="M12 16l0 -5" />
      <path d="M16 16v-3a2 2 0 0 0 -4 0" />
    </svg><span>${escapeHtml(label)}</span>`;
  }

  if (icon === "orcid") {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 256 256" aria-hidden="true">
      <path fill="currentColor" d="M256,128c0,70.7-57.3,128-128,128C57.3,256,0,198.7,0,128C0,57.3,57.3,0,128,0C198.7,0,256,57.3,256,128z" />
      <g>
        <path fill="#fff" d="M86.3,186.2H70.9V79.1h15.4v48.4V186.2z" />
        <path fill="#fff" d="M108.9,79.1h41.6c39.6,0,57,28.3,57,53.6c0,27.5-21.5,53.6-56.8,53.6h-41.8V79.1z M124.3,172.4h24.5c34.9,0,42.9-26.5,42.9-39.7c0-21.5-13.7-39.7-43.7-39.7h-23.7V172.4z" />
        <path fill="#fff" d="M88.7,56.8c0,5.5-4.5,10.1-10.1,10.1c-5.6,0-10.1-4.6-10.1-10.1c0-5.6,4.5-10.1,10.1-10.1C84.2,46.7,88.7,51.3,88.7,56.8z" />
      </g>
    </svg><span>${escapeHtml(label)}</span>`;
  }

  if (icon === "scholar") {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="M256 411.12L0 202.667 256 0z" />
      <path fill="currentColor" fill-opacity="0.8" d="M256 411.12l256-208.453L256 0z" />
      <circle fill="currentColor" fill-opacity="0.45" cx="256" cy="362.667" r="149.333" />
      <path fill="currentColor" fill-opacity="0.65" d="M121.037 298.667c23.968-50.453 75.392-85.334 134.963-85.334s110.995 34.881 134.963 85.334H121.037z" />
    </svg><span>${escapeHtml(label)}</span>`;
  }

  if (icon === "pubmed") {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M8.23 7.982l.006-1.005C7.846 1.417 5.096 0 5.096 0l.048 2.291C3.73 1.056 2.6 1.444 2.6 1.444l.118 15.307s4.218-1.796 5.428 5.505C10.238 13.535 21.401 24 21.401 24V9S10.52-.18 8.231 7.982zm9.79 9.941l-1.046-5.232-1.904 4.507h-.96l-1.72-4.301-1.046 5.04H9.321l2.093-9.39h.802l2.491 5.543 2.508-5.557h.869l2.075 9.39h-2.138z" />
    </svg><span>${escapeHtml(label)}</span>`;
  }

  return escapeHtml(label);
}

const SRC = {
  site: ["content/site.json", "Site settings"],
  home: ["content/home.json", "Home intro"],
  news: ["content/news.json", "News & highlights"],
  education: ["content/education.json", "Education content"],
  experience: ["content/experience.json", "Experience content"],
  scicomm: ["content/science-communication.json", "Science communication content"],
  pubs: ["content/publications.json", "Publication topics"],
  bib: ["references.bib", "Publication source file"]
};
const src = (key) => sourceAttrs(...SRC[key]);

const lastYear = (years = "") => {
  const all = String(years).match(/\d{4}/g) || ["0"];
  return Number.parseInt(all[all.length - 1], 10);
};

// Section headings use the plain section name so they match the contents strip.
function sectionHead(_num, name, _title, intro = "") {
  return `<header class="section-head">
      <h2>${escapeHtml(name)}</h2>
      ${intro ? `<p class="section-intro">${escapeHtml(intro)}</p>` : ""}
    </header>`;
}

/* ---------- hero with contents strip ---------- */
function renderHero(site) {
  const profiles = site.socialLinks.map((link) => `<a class="badge" href="${escapeHtml(link.url)}"${externalLinkAttrs} title="${escapeHtml(link.label)}">${renderSocialIcon(link.icon, link.label)}</a>`);
  return `<header class="hero"${src("site")}>
    <div class="id-row">
      <img class="portrait" src="${escapeHtml(site.assets.profileImage)}" alt="Portrait of ${escapeHtml(site.name)}" width="240" height="240" />
      <div class="id-text">
        <h1>${escapeHtml(site.name)}</h1>
        <p class="role">${escapeHtml(site.role)}</p>
      </div>
    </div>
    <p class="tagline">${escapeHtml(site.tagline)}</p>
    <nav class="badge-line" aria-label="Profiles">${profiles.join("")}</nav>
  </header>`;
}

function renderChapterMenu(site) {
  const links = site.chapters.map((c) => `<a href="#${escapeHtml(c.id)}" data-spy="${escapeHtml(c.id)}">${escapeHtml(c.label)}</a>`).join("");
  return `<nav class="chapters" aria-label="Chapters"${src("site")}>
    <a class="chapters-name" href="#top">${escapeHtml(site.name)}</a>
    <div class="chapters-links">${links}</div>
  </nav>`;
}

/* ---------- topic glyphs: small hand-drawn marks instead of colour dots ---------- */
const GLYPHS = {
  // thyroid: two lobes and the isthmus (own viewBox, solid)
  thyroid: `<svg viewBox="0 0 175 148"><path fill="currentColor" stroke="none" d="M170.075 81.865C170.075 79.626 169.554 77.53 168.653 75.713C172.193 72.095 174.436 66.846 174.436 60.984C174.436 55.653 172.584 50.824 169.587 47.27C170.644 45.346 171.265 43.076 171.265 40.635C171.265 35.753 168.814 31.537 165.25 29.484C166.778 27.335 167.697 24.594 167.697 21.606C167.697 15.932 164.391 11.15 159.866 9.62901C158.736 4.11201 154.423 0 149.262 0C145.305 0 141.851 2.423 139.94 6.037C130.723 14.982 130.669 38.004 122.191 48.63C113.663 59.319 108.12 82.092 100.871 76.979C93.622 71.867 87.226 90.921 79.978 86.274C72.729 81.627 65.054 79.303 65.054 79.303C59.084 42.588 50.556 38.406 47.998 36.082C45.44 33.758 45.013 29.111 40.323 13.31C38.78 8.11101 36.311 5.38901 33.452 4.37601C31.452 1.70201 28.489 0.00100708 25.174 0.00100708C20.013 0.00100708 15.7 4.113 14.57 9.63C10.046 11.15 6.73901 15.933 6.73901 21.607C6.73901 24.595 7.658 27.336 9.186 29.485C5.622 31.539 3.17101 35.755 3.17101 40.636C3.17101 43.077 3.792 45.347 4.849 47.271C1.852 50.825 0 55.653 0 60.985C0 66.847 2.242 72.097 5.783 75.714C4.882 77.531 4.361 79.627 4.361 81.866C4.361 86.627 6.688 90.764 10.109 92.87C8.984 94.835 8.325 97.18 8.325 99.705C8.325 104.579 10.768 108.79 14.323 110.847C14.036 111.966 13.875 113.148 13.875 114.373C13.875 115.738 14.073 117.048 14.426 118.278C13.571 120.061 13.082 122.106 13.082 124.284C13.082 130.829 17.48 136.189 23.075 136.719C24.739 141.178 28.601 144.304 33.103 144.304C33.904 144.304 34.683 144.199 35.434 144.011C40.167 146.875 43.734 146.225 43.734 146.225C58.658 142.042 57.379 136.465 62.922 127.17C68.465 117.875 88.676 111.572 101.468 121.797C114.26 132.021 108.12 132.747 117.074 145.295C120.568 150.191 126.788 147.162 133.455 140.434C135.44 142.814 138.232 144.304 141.333 144.304C145.834 144.304 149.697 141.178 151.361 136.719C156.956 136.188 161.354 130.829 161.354 124.284C161.354 122.106 160.865 120.06 160.01 118.278C160.363 117.048 160.561 115.738 160.561 114.373C160.561 113.147 160.4 111.966 160.113 110.847C163.668 108.79 166.111 104.579 166.111 99.705C166.111 97.18 165.452 94.834 164.327 92.87C167.747 90.763 170.075 86.626 170.075 81.865Z"/></svg>`,
  // capsule, half filled
  pill: `<path class="fill" d="M8.4 8.6 4.8 12.2a3.6 3.6 0 0 0 5.1 5.1l3.6-3.6z"/><path d="M19.3 4.8a3.6 3.6 0 0 0-5.1-.1L4.8 14.1a3.6 3.6 0 0 0 5.1 5.1l9.4-9.3a3.6 3.6 0 0 0 0-5.1zM8.4 8.6l5.1 5.1"/>`,
  // magnifier over a page: transparency
  lens: `<path d="M5.5 3.8h7.8l3 3v3.4M5.5 3.8v15.6h5.2M8 8.2h4.6M8 11.2h3"/><circle class="fill" cx="15.2" cy="15.2" r="3.4"/><circle cx="15.2" cy="15.2" r="3.4"/><path d="m17.7 17.8 2.6 2.6"/>`,
  // globe
  globe: `<circle class="fill" cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="8.2"/><path d="M3.9 10.6c2.6.9 5.3 1.3 8.1 1.3s5.5-.4 8.1-1.3M12 3.8c-2.3 2.2-3.4 5-3.4 8.2s1.1 6 3.4 8.2c2.3-2.2 3.4-5 3.4-8.2S14.3 6 12 3.8z"/>`
};
function glyph(name, title = "") {
  const body = GLYPHS[name] || GLYPHS.globe;
  return `<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${title ? `<title>${escapeHtml(title)}</title>` : ""}${body}</svg>`;
}
function topicMeta(content) {
  const map = new Map();
  content.topics.forEach((t, i) => map.set(slugifyTopic(t.name), { index: i + 1, glyph: t.glyph, name: t.name, short: t.short || t.name }));
  return map;
}

/* ---------- lately: feature + small cards ---------- */
function renderNews(news) {
  const feature = news.items.find((i) => i.feature);
  const rest = news.items.filter((i) => !i.feature);
  const featureHtml = feature
    ? `<article class="card feature"${src("news")}>
        ${feature.image ? `<figure class="feature-photo">
          <img src="${escapeHtml(feature.image)}" alt="${escapeHtml(feature.imageAlt || "")}" fetchpriority="high" width="720" height="1079" />
          ${feature.imageCredit ? `<figcaption>${escapeHtml(feature.imageCredit)}</figcaption>` : ""}
        </figure>` : ""}
        <div class="feature-body">
          <h3>${escapeHtml(feature.title)} <span class="year">${escapeHtml(feature.year)}</span></h3>
          <p class="feature-sub">${escapeHtml(feature.subtitle || "")}</p>
          ${feature.quote ? `<blockquote>
            <p lang="${escapeHtml(feature.quoteLang || "en")}">“${escapeHtml(feature.quote)}”</p>
            ${feature.quoteTranslation ? `<p class="translation">${escapeHtml(feature.quoteTranslation)}</p>` : ""}
          </blockquote>` : ""}
          <p class="feature-text">${escapeHtml(feature.text || "")}</p>
          ${feature.url ? `<a class="more" href="${escapeHtml(feature.url)}"${externalLinkAttrs}>${escapeHtml(feature.linkLabel || "Read more")} →</a>` : ""}
        </div>
      </article>`
    : "";
  const cards = rest
    .map((item) => `<article class="card news-card"${src("news")}>
      <h3>${escapeHtml(item.title)} <span class="year">${escapeHtml(item.year)}</span></h3>
      <p>${escapeHtml(item.text)}</p>
      ${item.url ? `<a class="more" href="${escapeHtml(item.url)}"${externalLinkAttrs}>${escapeHtml(item.linkLabel || "Read more")} →</a>` : ""}
    </article>`)
    .join("");
  return `<section id="news" class="news"${src("news")}>
    <div class="bento">
      ${featureHtml}
      <div class="news-stack">${cards}</div>
    </div>
  </section>`;
}

/* ---------- about + at a glance ---------- */
function renderAbout(home, num) {
  const [first, ...rest] = home.intro;
  const glance = (home.glance || [])
    .map((g) => `<div><dt>${escapeHtml(g.label)}</dt><dd>${escapeHtml(g.value)}</dd></div>`)
    .join("");
  return `<section id="about"${src("home")}>
    ${sectionHead(num, "About", home.heading || "About")}
    <div class="split">
      <div class="about-text">
        <div class="prose is-clamped">
          <p class="lead">${renderRichText(first.parts)}</p>
          ${rest.map((p) => `<p>${renderRichText(p.parts)}</p>`).join("")}
          <p class="coronis" aria-hidden="true">⸎</p>
        </div>
        <button type="button" class="read-more">Read more</button>
      </div>
      <aside class="card glance" aria-label="At a glance">
        <h3>At a glance</h3>
        <dl>${glance}</dl>
      </aside>
    </div>
  </section>`;
}

/* ---------- research ---------- */
function renderResearch(content, publications, num) {
  const counts = new Map();
  for (const p of publications) {
    const slug = slugifyTopic(p.fields.topic || "Other");
    counts.set(slug, (counts.get(slug) || 0) + 1);
  }
  const themes = content.topics
    .map((topic, index) => {
      const slug = slugifyTopic(topic.name);
      return `<article class="card theme-card t-${index + 1}"${src("pubs")}>
        <div class="theme-top"><h3>${escapeHtml(topic.short || topic.name)}</h3>${glyph(topic.glyph)}</div>
        <p>${escapeHtml(topic.summary || topic.description)}</p>
        <a class="more" href="#publications" data-filter="${escapeHtml(slug)}">${counts.get(slug) || 0} publications →</a>
      </article>`;
    })
    .join("");

  const byKey = new Map(publications.map((p) => [p.key, p]));
  const featured = (content.featured || [])
    .map((key) => byKey.get(key))
    .filter(Boolean)
    .map((entry) => {
      const f = entry.fields;
      const url = f.url || (f.doi ? `https://doi.org/${f.doi}` : "");
      return `<li${src("bib")}>
        <span class="year">${escapeHtml(f.year || "")}</span>
        <div>
          ${url ? `<a href="${escapeHtml(url)}"${externalLinkAttrs}>${escapeHtml(f.title)}</a>` : escapeHtml(f.title)}
          <p class="venue">${escapeHtml(f.journal || f.booktitle || f.publisher || "")}</p>
        </div>
      </li>`;
    })
    .join("");

  return `<section id="research"${src("pubs")}>
    ${sectionHead(num, "Research", "Three connected threads")}
    <div class="grid-3">${themes}</div>
    ${featured ? `<div class="card selected"${src("pubs")}>
      <h3 class="mini-head">Selected work</h3>
      <ol class="compact-list">${featured}</ol>
    </div>` : ""}
  </section>`;
}

/* ---------- writing & media ---------- */
function renderWriting(content, num) {
  const nemo = content.nemo.links
    .map((item, i, all) => `<li class="${i && all[i - 1].year === item.year ? "same-year" : ""}"${src("scicomm")}>
      <span class="year">${i && all[i - 1].year === item.year ? "" : escapeHtml(item.year)}</span>
      <a href="${escapeHtml(item.url)}"${externalLinkAttrs}><span class="en">${escapeHtml(item.titleEn)}</span><span class="nl" lang="nl">${escapeHtml(item.title)}</span></a>
    </li>`)
    .join("");
  const logos = content.featuredMedia
    .map((item) => `<a href="${escapeHtml(item.url)}"${externalLinkAttrs} title="${escapeHtml(item.name)}"${src("scicomm")}>
      <img src="logos/${escapeHtml(item.logo)}" alt="${escapeHtml(item.name)}" loading="lazy" />
    </a>`)
    .join("");
  const media = [...content.media]
    .sort((a, b) => b.year - a.year)
    .map((item) => `<li${src("scicomm")}>
      <span class="year">${escapeHtml(item.year)}</span>
      <div>
        ${item.url ? `<a href="${escapeHtml(item.url)}"${externalLinkAttrs}>${escapeHtml(item.title)}</a>` : `<span>${escapeHtml(item.title)}</span>`}
        <p class="venue">${escapeHtml(item.outlet)}</p>
      </div>
    </li>`)
    .join("");

  return `<section id="writing"${src("scicomm")}>
    ${sectionHead(num, "Writing & media", "Keeping the questions coming")}
    <div class="split split-even">
      <div class="col">
        <div class="card press">
          <h3 class="mini-head">Research featured in</h3>
          <div class="press-logos"${src("scicomm")}>${logos}</div>
        </div>
        <div class="card appearances">
          <h3 class="mini-head">${escapeHtml(content.mediaHeading)}</h3>
          <ul class="compact-list">${media}</ul>
        </div>
      </div>
      <div class="col">
        <figure class="video card">
          <video src="${escapeHtml(content.video.src)}" controls preload="none" poster="${escapeHtml(content.video.poster)}"></video>
          <figcaption>Faces of Science portrait · KNAW, De Jonge Akademie and NEMO</figcaption>
        </figure>
      <div class="card nemo"${src("scicomm")}>
        <div class="nemo-head">
          <a href="${escapeHtml(content.nemo.url)}"${externalLinkAttrs}><img src="logos/${escapeHtml(content.nemo.logo)}" alt="NEMO Kennislink" /></a>
          <p>${escapeHtml(content.nemo.description)}</p>
        </div>
        <ol class="compact-list dense">${nemo}</ol>
      </div>
      </div>
    </div>
  </section>`;
}

/* ---------- path: two columns ---------- */
function renderPathColumn(title, items, key) {
  const rows = items
    .map((item) => {
      const heading = item.degree || item.title;
      const more = [
        item.description ? `<p>${escapeHtml(item.description)}</p>` : "",
        item.thesis ? `<p class="small"><em>Thesis:</em> ${escapeHtml(item.thesis)}</p>` : "",
        item.supervisors ? `<p class="small"><em>Supervisors:</em> ${escapeHtml(item.supervisors.join("; "))}</p>` : ""
      ].join("");
      return `<li class="step"${src(key)}>
        <span class="year">${escapeHtml(item.years)}</span>
        <div class="step-body">
          <div class="step-head">
            <div>
              <p class="step-title">${escapeHtml(heading)}${item.distinction ? ` <span class="distinction">${escapeHtml(item.distinction)}</span>` : ""}</p>
              <p class="institution">${escapeHtml(item.institution)}</p>
            </div>
            ${item.logo ? `<img src="logos/${escapeHtml(item.logo)}" alt="" loading="lazy" />` : ""}
          </div>
          ${more ? `<details><summary>More</summary>${more}</details>` : ""}
        </div>
      </li>`;
    })
    .join("");
  return `<div class="card path-col k-${key}"${src(key)}>
    <h3 class="mini-head">${escapeHtml(title)}</h3>
    <ol class="steps">${rows}</ol>
  </div>`;
}

function renderPostsByInstitution(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.institution)) groups.set(item.institution, { institution: item.institution, logo: item.logo, items: [] });
    groups.get(item.institution).items.push(item);
  }
  const ordered = [...groups.values()]
    .map((g) => ({ ...g, items: g.items.sort((a, b) => lastYear(b.years) - lastYear(a.years)) }))
    .sort((a, b) => lastYear(b.items[0].years) - lastYear(a.items[0].years));
  const rows = ordered
    .map((g) => `<li class="inst"${src("experience")}>
      <div class="inst-head">
        <p class="inst-name">${escapeHtml(g.institution)}</p>
        ${g.logo ? `<img src="logos/${escapeHtml(g.logo)}" alt="" loading="lazy" />` : ""}
      </div>
      <ol class="inst-roles">${g.items
        .map((item) => `<li class="step">
          <span class="year">${escapeHtml(item.years)}</span>
          <div class="step-body">
            <p class="step-title">${escapeHtml(item.title)}</p>
            ${item.description ? `<details><summary>More</summary><p>${escapeHtml(item.description)}</p></details>` : ""}
          </div>
        </li>`)
        .join("")}</ol>
    </li>`)
    .join("");
  return `<div class="card path-col"${src("experience")}>
    <h3 class="mini-head">Research posts</h3>
    <ol class="insts">${rows}</ol>
  </div>`;
}

function renderPath(education, experience, num) {
  const sort = (arr) => [...arr].sort((a, b) => lastYear(b.years) - lastYear(a.years));
  return `<section id="path"${src("education")}>
    ${sectionHead(num, "Path", "From human sciences to the clinic")}
    <div class="split split-even">
      ${renderPathColumn(education.title, sort(education.items), "education")}
      ${renderPostsByInstitution(experience.items)}
    </div>
  </section>`;
}

/* ---------- publications ---------- */
function renderPublication(entry, authorMatch, topics) {
  const f = entry.fields;
  const title = f.title || entry.key;
  const authors = splitAuthors(f.author || "");
  const mi = authors.findIndex((a) => a.toLowerCase().includes(String(authorMatch).toLowerCase()));
  const fmt = (a, i) => (i === mi ? `<strong>${escapeHtml(a)}</strong>` : escapeHtml(a));
  let authorShort;
  if (authors.length <= 4) {
    authorShort = authors.map(fmt).join(", ");
  } else {
    const keep = [...new Set([0, mi, authors.length - 1].filter((i) => i >= 0))].sort((a, b) => a - b);
    const parts = [];
    let prev = -1;
    keep.forEach((i) => { if (i - prev > 1) parts.push(`<span class="ellip">…</span>`); parts.push(fmt(authors[i], i)); prev = i; });
    authorShort = parts.join(", ");
  }
  const venue = [f.journal || f.booktitle || f.publisher || f.institution, f.volume ? `vol. ${f.volume}` : "", f.number ? `no. ${f.number}` : ""].filter(Boolean).join(" · ");
  const topic = f.topic || "Other";
  const slug = slugifyTopic(topic);
  const doi = f.doi || "";
  const url = f.url || (doi ? `https://doi.org/${doi}` : "");
  const abstract = f.abstract && !/^N\/A$/i.test(f.abstract) ? f.abstract : "";
  const search = `${title} ${authors.join(" ")} ${venue} ${f.year || ""}`.toLowerCase();
  const versions = entry.versions.map((v) => {
    const vurl = v.fields.url || (v.fields.doi ? `https://doi.org/${v.fields.doi}` : "");
    const label = `${{ inproceedings: "Abstract", techreport: "Report" }[v.type] || "Preprint"}: ${v.fields.journal || v.fields.publisher || ""} ${v.fields.year || ""}`.trim();
    return ` · <a href="${escapeHtml(vurl)}"${externalLinkAttrs}>${escapeHtml(label)}</a>`;
  }).join("");

  return `<li class="pub t-${topics.get(slug)?.index || 0}" data-topic="${escapeHtml(slug)}" data-search="${escapeHtml(search)}"${src("bib")}>
    <span class="year">${escapeHtml(f.year || "")}</span>
    <div class="pub-body">
      <p class="pub-title"><span class="pub-glyph" title="${escapeHtml(topic)}">${glyph(topics.get(slug)?.glyph)}</span>${url ? `<a href="${escapeHtml(url)}"${externalLinkAttrs}>${escapeHtml(title)}</a>` : escapeHtml(title)}</p>
      <p class="pub-meta">${authors.length > 4
        ? `<button type="button" class="pub-authors" aria-expanded="false" title="Show all authors"><span class="a-short">${authorShort}</span><span class="a-full">${authors.map(fmt).join(", ")}</span></button>`
        : `<span class="pub-authors">${authorShort}</span>`}<span class="venue">${escapeHtml(venue)}${versions}</span></p>
      ${abstract || doi ? `<details name="pub">
        <summary>${abstract ? "Abstract" : "Details"}</summary>
        ${doi ? `<div class="badges">
          <span class="__dimensions_badge_embed__" data-doi="${escapeHtml(doi)}" data-legend="hover-right" data-style="small_circle"></span>
          <div class="altmetric-embed" data-badge-type="donut" data-badge-popover="right" data-doi="${escapeHtml(doi)}" data-hide-no-mentions="true"></div>
          <a class="doi" href="https://doi.org/${escapeHtml(doi)}"${externalLinkAttrs}>doi:${escapeHtml(doi)}</a>
        </div>` : ""}
        ${abstract ? `<p>${escapeHtml(abstract)}</p>` : ""}
      </details>` : ""}
    </div>
  </li>`;
}

function renderPublications(content, publications, num) {
  const topics = topicMeta(content);
  const chips = [`<button type="button" class="chip is-on" data-filter="all">All <span>${publications.length}</span></button>`]
    .concat(content.topics.map((t, i) => {
      const slug = slugifyTopic(t.name);
      const n = publications.filter((p) => slugifyTopic(p.fields.topic || "") === slug).length;
      return `<button type="button" class="chip t-${i + 1}" data-filter="${escapeHtml(slug)}">${glyph(t.glyph)}${escapeHtml(t.short || t.name)} <span>${n}</span></button>`;
    }))
    .join("");
  const descs = content.topics
    .map((t) => `<p class="topic-desc" data-topic="${escapeHtml(slugifyTopic(t.name))}" hidden>${escapeHtml(t.summary || t.description)}</p>`)
    .join("");
  return `<section id="publications"${src("pubs")}>
    ${sectionHead(num, "Publications", content.title)}
    <div class="pub-controls">
      <div class="chips" role="group" aria-label="Filter by theme">${chips}</div>
      <label class="search"><span class="sr-only">Search publications</span><input type="search" placeholder="Search titles, co-authors, journals…" /></label>
    </div>
    ${descs}
    <ol class="pub-list">${publications.map((p) => renderPublication(p, content.authorMatch, topics)).join("")}</ol>
    <p class="empty" hidden>No publications match that search.</p>
  </section>`;
}

/* ---------- css + scripts ---------- */
async function buildCss() {
  const files = (await readdir(themeDir)).filter((file) => file.endsWith(".css")).sort();
  const css = (await Promise.all(files.map(async (file) => `/* ${file} */\n${await readFile(path.join(themeDir, file), "utf8")}`))).join("\n\n");
  const hash = crypto.createHash("md5").update(css).digest("hex").slice(0, 8);
  const fileName = `style-${hash}.css`;
  const publicFiles = await readdir(publicDir);
  await Promise.all(publicFiles.filter((file) => /^style-[a-f0-9]{8}\.css$/.test(file)).map((file) => rm(path.join(publicDir, file))));
  await writeFile(path.join(publicDir, fileName), css);
  return fileName;
}

function renderPageScript(site) {
  const repo = `${site.repo.owner}/${site.repo.name}`;
  return `<script>
  document.addEventListener("DOMContentLoaded", function () {
    var body = document.body;
    var editConfig = ${JSON.stringify({ repo, branch: site.repo.branch })};
    function editUrl(file) {
      return "https://github.com/" + editConfig.repo + "/edit/" + editConfig.branch + "/" + encodeURI(file).replaceAll("%2F", "/");
    }
    function setEdit(on) { body.classList.toggle("config-edit-mode", on); }
    window.enableConfigEditMode = function (on) { setEdit(on === undefined ? true : Boolean(on)); };
    window.openConfigSourceFromElement = function (el) {
      var t = el instanceof Element ? el.closest("[data-source-file]") : null;
      if (!t) return false; window.location.href = editUrl(t.dataset.sourceFile); return true;
    };
    setEdit(new URLSearchParams(location.search).get("edit") === "1");
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "e") { e.preventDefault(); setEdit(!body.classList.contains("config-edit-mode")); }
    });
    document.addEventListener("click", function (e) {
      if (!body.classList.contains("config-edit-mode")) return;
      var t = e.target.closest("[data-source-file]");
      if (!t) return; e.preventDefault(); e.stopPropagation(); location.href = editUrl(t.dataset.sourceFile);
    }, true);

    // chapter menu: fades in once the header has scrolled away, highlights the current chapter
    var hero = document.querySelector(".hero");
    var menu = document.querySelector(".chapters");
    if (hero && menu && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        menu.classList.toggle("is-visible", !entries[0].isIntersecting);
      }).observe(hero);
      var spyLinks = menu.querySelectorAll("[data-spy]");
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          spyLinks.forEach(function (l) { l.classList.toggle("is-active", l.dataset.spy === e.target.id); });
        });
      }, { rootMargin: "-25% 0px -65% 0px" });
      spyLinks.forEach(function (l) { var t = document.getElementById(l.dataset.spy); if (t) spy.observe(t); });
    }

    // about: fade the prose until clicked
    var prose = document.querySelector(".prose.is-clamped");
    var readMore = document.querySelector(".read-more");
    function openProse() { prose.classList.remove("is-clamped"); readMore.hidden = true; }
    if (prose && readMore) {
      readMore.addEventListener("click", openProse);
      prose.addEventListener("click", function (e) { if (!e.target.closest("a")) openProse(); });
    }

    document.querySelectorAll("button.pub-authors").forEach(function (b) {
      b.addEventListener("click", function () { b.setAttribute("aria-expanded", b.getAttribute("aria-expanded") !== "true"); });
    });

    // publications: theme chips + search
    var chips = document.querySelectorAll("#publications .chip");
    var items = document.querySelectorAll(".pub");
    
    var descs = document.querySelectorAll(".topic-desc");
    var input = document.querySelector("#publications input[type=search]");
    var empty = document.querySelector("#publications .empty");
    var current = "all";
    function apply() {
      var q = (input && input.value || "").trim().toLowerCase();
      var shown = 0;
      items.forEach(function (it) {
        var ok = (current === "all" || it.dataset.topic === current) && (!q || it.dataset.search.indexOf(q) > -1);
        it.hidden = !ok; if (ok) shown++;
      });
      descs.forEach(function (d) { d.hidden = d.dataset.topic !== current; });
      chips.forEach(function (c) { c.classList.toggle("is-on", c.dataset.filter === current); });
      if (empty) empty.hidden = shown > 0;
    }
    function setFilter(f) { current = f; apply(); }
    chips.forEach(function (c) { c.addEventListener("click", function () {
      if (body.classList.contains("config-edit-mode")) return;
      setFilter(c.dataset.filter === current ? "all" : c.dataset.filter);
    }); });
    if (input) input.addEventListener("input", apply);
    document.querySelectorAll("a[data-filter]").forEach(function (a) {
      a.addEventListener("click", function () { if (!body.classList.contains("config-edit-mode")) setFilter(a.dataset.filter); });
    });

  });
  </script>`;
}

function renderPage({ site, home, news, education, experience, scicomm, pubContent, publications, cssFile }) {
  const num = () => "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#fffefb" />
  <meta name="description" content="${escapeHtml(site.description)}" />
  <meta name="keywords" content="${escapeHtml(site.keywords.join(", "))}" />
  <meta name="author" content="${escapeHtml(site.author)}" />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/jpeg" href="${escapeHtml(site.assets.favicon)}" />
  <link rel="canonical" href="${escapeHtml(site.baseUrl)}" />
  <link rel="preload" href="${escapeHtml(site.assets.font)}" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="${escapeHtml(site.assets.headingFont)}" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="${escapeHtml(cssFile)}" />
  <script async src="https://d1bxh8uas1mnw7.cloudfront.net/assets/embed.js"></script>
  <script async src="https://badge.dimensions.ai/badge.js" charset="utf-8"></script>
  <title>${escapeHtml(site.pageTitle)}</title>
</head>
<body id="top">
  ${renderChapterMenu(site)}
  <div class="edit-indicator">Edit mode: press Ctrl/Cmd+Shift+E or use ?edit=1</div>
  <main class="page">
    ${renderHero(site)}
    ${renderNews(news)}
    ${renderAbout(home, num("about"))}
    ${renderResearch(pubContent, publications, num("research"))}
    ${renderWriting(scicomm, num("writing"))}
    ${renderPath(education, experience, num("path"))}
    ${renderPublications(pubContent, publications, num("publications"))}
  </main>
  <p class="fleuron" aria-hidden="true"><svg viewBox="0 0 6 8" width="0.75em" height="1em" fill="currentColor"><path d="M0.612 7.212C0.38142 7.212 0.0849564 7.04889 0 6.828C0.24 6.572 0.412 6.324 0.636 5.94C0.623194 5.69668 -0.0183444 3.828 0.468 3.828C0.783018 3.828 0.905083 5.01852 0.984 5.244L1.272 4.68C1.05437 4.38983 0.976899 3.87405 0.9 3.528C0.807763 3.08987 1.14009 2.70055 1.236 3.276C1.27133 3.48801 1.3335 4.02075 1.548 4.128L1.752 3.804C1.70482 3.62708 1.31678 2.352 1.728 2.352C1.87829 2.352 1.9354 3.32934 2.016 3.456L2.232 3.132C2.12136 2.74476 2.004 2.32534 2.004 1.92C2.004 1.17045 2.4129 1.85133 2.436 2.244C2.444 2.38 2.472 2.56 2.52 2.784L2.724 2.448C2.64344 2.22646 2.25111 0.852 2.736 0.852C2.99942 0.852 2.90565 1.81365 3.084 1.992L3.312 1.632C3.23974 1.45134 2.90042 0.372 3.336 0.372C3.42244 0.372 3.50561 1.18996 3.552 1.296L3.696 1.068C3.6765 0.91197 3.49212 0.156 3.816 0.156C3.97983 0.156 3.87214 0.57214 3.96 0.66C4.0388 0.423598 4.19558 0 4.5 0C4.93106 0 4.27404 0.744556 4.212 0.84C4.33318 0.820866 5.016 0.278398 5.016 0.66C5.016 0.947582 4.2662 1.23213 4.044 1.248L3.78 1.692C4.1108 1.692 4.51816 1.37286 4.836 1.5C5.16685 1.61028 4.54012 1.91348 4.464 1.932C4.12362 2.0259 3.78668 2.132 3.456 2.256L3.276 2.544C3.65311 2.544 4.00007 2.244 4.392 2.244C4.96593 2.244 4.00613 2.67705 3.9 2.7C3.62616 2.74417 3.36415 2.81296 3.096 2.88L2.844 3.3C3.0696 3.3 4.05031 2.87852 4.188 3.108C4.47169 3.48625 2.75073 3.66673 2.58 3.696L2.34 4.128C2.66538 4.128 2.99523 3.96097 3.3 3.864C3.58677 3.75972 4.12659 3.83227 3.636 4.092C3.17314 4.35236 2.59655 4.5224 2.076 4.62L1.86 4.968C2.02551 4.85766 3.69877 4.36061 3.648 4.716C3.59913 5.2047 2.02624 5.2231 1.644 5.376L1.476 5.628C2.04623 5.74205 2.5866 5.4 3.144 5.4C3.41434 5.4 3.23348 5.68108 3.108 5.748C2.72172 5.96873 1.6948 6.3074 1.248 6.084L0.612 7.212Z"/></svg></p>
  <footer class="footer"${src("site")}>
    <p>${escapeHtml(site.footer.copyright)}</p>
    <p><a href="#top">Back to top ↑</a></p>
    <p>Made with <span class="heart"><svg viewBox="0 0 12 10" width="1.2em" height="1em" fill="currentColor" aria-hidden="true"><path d="M3.42737 9.85944C3.29937 9.85944 3.19137 9.82344 3.10337 9.75144C2.93298 9.61513 2.96201 9.33041 3.04337 9.15144C3.4225 8.45635 2.65086 7.59538 2.21537 7.14744C1.42116 6.3163 0.494643 5.4989 0.151365 4.36344C-0.0733417 3.53951 -0.0656592 2.60166 0.295365 1.81944C0.495365 1.40344 0.763365 1.04344 1.09937 0.739437C1.44337 0.435437 1.82737 0.223437 2.25137 0.103437C2.83865 -0.0800899 3.534 -0.00158261 4.09937 0.199437C4.6695 0.397745 5.10699 0.764497 5.58737 1.11144C5.73137 1.21544 5.84337 1.26744 5.92337 1.26744C6.26505 1.26744 6.61988 0.854024 6.87137 0.667437C7.40954 0.257401 8.11279 0.0074371 8.79137 0.0074371C9.36736 0.0074371 9.87536 0.147437 10.3154 0.427437C10.7634 0.699437 11.1154 1.07144 11.3714 1.54344C11.6274 2.01544 11.7554 2.54744 11.7554 3.13944C11.7554 3.65144 11.6314 4.17544 11.3834 4.71144C10.411 6.78171 7.94345 8.29165 5.92337 9.17544C5.16716 9.52353 4.2789 9.85944 3.42737 9.85944Z"/></svg></span> by <a href="https://maurice-frank.com/"${externalLinkAttrs}>Maurice</a> on <a href="https://github.com/${escapeHtml(site.repo.owner)}/${escapeHtml(site.repo.name)}"${externalLinkAttrs}>GitHub</a></p>
  </footer>
  ${renderPageScript(site)}
</body>
</html>`;
}

async function main() {
  const [site, home, news, education, experience, scicomm, pubContent, bibSource] = await Promise.all([
    readJson("content/site.json"),
    readJson("content/home.json"),
    readJson("content/news.json"),
    readJson("content/education.json"),
    readJson("content/experience.json"),
    readJson("content/science-communication.json"),
    readJson("content/publications.json"),
    readText("references.bib")
  ]);
  const entries = parseBibtex(bibSource).map((entry) => ({ ...entry, year: Number.parseInt(entry.fields.year || "0", 10) || 0, versions: [] }));
  // An entry with `related = {key}` is an earlier version (preprint, abstract) and is listed under that key's entry.
  const byKey = new Map(entries.map((e) => [e.key, e]));
  for (const e of entries) byKey.get(e.fields.related)?.versions.push(e);
  const publications = entries.filter((e) => !byKey.has(e.fields.related)).sort((a, b) => b.year - a.year);

  const cssFile = await buildCss();
  const html = renderPage({ site, home, news, education, experience, scicomm, pubContent, publications, cssFile });
  await writeFile(path.join(publicDir, "index.html"), html);
  process.stdout.write(`Built public/index.html (${publications.length} publications)\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
