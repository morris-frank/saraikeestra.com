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
    </svg><span class="sr-only">${escapeHtml(label)}</span>`;
  }

  if (icon === "orcid") {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 256 256" aria-hidden="true">
      <path fill="#A6CE39" d="M256,128c0,70.7-57.3,128-128,128C57.3,256,0,198.7,0,128C0,57.3,57.3,0,128,0C198.7,0,256,57.3,256,128z" />
      <g>
        <path fill="#FFFFFF" d="M86.3,186.2H70.9V79.1h15.4v48.4V186.2z" />
        <path fill="#FFFFFF" d="M108.9,79.1h41.6c39.6,0,57,28.3,57,53.6c0,27.5-21.5,53.6-56.8,53.6h-41.8V79.1z M124.3,172.4h24.5c34.9,0,42.9-26.5,42.9-39.7c0-21.5-13.7-39.7-43.7-39.7h-23.7V172.4z" />
        <path fill="#FFFFFF" d="M88.7,56.8c0,5.5-4.5,10.1-10.1,10.1c-5.6,0-10.1-4.6-10.1-10.1c0-5.6,4.5-10.1,10.1-10.1C84.2,46.7,88.7,51.3,88.7,56.8z" />
      </g>
    </svg><span class="sr-only">${escapeHtml(label)}</span>`;
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

function sectionHead(num, eyebrow, title, intro = "") {
  return `<header class="section-head">
      <p class="eyebrow"><span class="num">${escapeHtml(num)}</span>${escapeHtml(eyebrow)}</p>
      <h2>${escapeHtml(title)}</h2>
      ${intro ? `<p class="section-intro">${escapeHtml(intro)}</p>` : ""}
    </header>`;
}

/* ---------- hero with contents strip ---------- */
function renderHero(site, overview) {
  const socials = site.socialLinks
    .map((link) => `<a class="pill" href="${escapeHtml(link.url)}"${externalLinkAttrs}>${renderSocialIcon(link.icon, link.label).replace('<span class="sr-only">', "<span>")}</a>`)
    .join("");
  const tiles = overview
    .map((o, i) => `<a class="toc-tile" href="#${escapeHtml(o.id)}">
        <span class="num">${String(i + 1).padStart(2, "0")}</span>
        <span class="toc-label">${escapeHtml(o.label)}</span>
        <span class="toc-teaser">${escapeHtml(o.teaser)}</span>
      </a>`)
    .join("");
  return `<section class="hero"${src("site")}>
    <div class="hero-id">
      <div class="portrait" data-field-anchor>
        <img src="${escapeHtml(site.assets.profileImage)}" alt="Portrait of ${escapeHtml(site.name)}" width="540" height="540" />
      </div>
      <p class="eyebrow">${escapeHtml(site.role)}</p>
      <h1>${escapeHtml(site.name)}</h1>
      <p class="tagline">${escapeHtml(site.tagline)}</p>
      <nav class="socials" aria-label="Profiles">${socials}</nav>
    </div>
    <nav class="toc" aria-label="On this page">${tiles}</nav>
  </section>`;
}

function renderTopbar(site) {
  const links = site.nav.map((item) => `<a href="#${escapeHtml(item.id)}" data-spy="${escapeHtml(item.id)}">${escapeHtml(item.label)}</a>`).join("");
  return `<nav class="topbar" aria-label="Sections"${src("site")}>
    <a class="topbar-name" href="#top">${escapeHtml(site.name)}</a>
    <div class="topbar-links">${links}</div>
  </nav>`;
}

/* ---------- lately: feature + small cards ---------- */
function renderNews(news) {
  const feature = news.items.find((i) => i.feature);
  const rest = news.items.filter((i) => !i.feature);
  const featureHtml = feature
    ? `<article class="card feature"${src("news")}>
        ${feature.image ? `<figure class="feature-photo">
          <img src="${escapeHtml(feature.image)}" alt="${escapeHtml(feature.imageAlt || "")}" loading="lazy" width="900" height="1349" />
          ${feature.imageCredit ? `<figcaption>${escapeHtml(feature.imageCredit)}</figcaption>` : ""}
        </figure>` : ""}
        <div class="feature-body">
          <p class="meta"><span class="kind">${escapeHtml(feature.kind)}</span><span>${escapeHtml(feature.year)}</span></p>
          <h3>${escapeHtml(feature.title)}</h3>
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
      <p class="meta"><span class="kind">${escapeHtml(item.kind)}</span><span>${escapeHtml(item.year)}</span></p>
      <h3>${escapeHtml(item.title)}</h3>
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
      <div class="prose">
        <p class="lead">${renderRichText(first.parts)}</p>
        ${rest.map((p) => `<p>${renderRichText(p.parts)}</p>`).join("")}
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
        <div class="theme-top"><span class="theme-mark" aria-hidden="true"></span><h3>${escapeHtml(topic.short || topic.name)}</h3></div>
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
    ${featured ? `<div class="selected"${src("pubs")}>
      <h3 class="mini-head">Selected work</h3>
      <ol class="compact-list">${featured}</ol>
    </div>` : ""}
  </section>`;
}

/* ---------- writing & media ---------- */
function renderWriting(content, num) {
  const nemo = content.nemo.links
    .map((item) => `<li${src("scicomm")}>
      <span class="year">${escapeHtml(item.year)}</span>
      <a href="${escapeHtml(item.url)}"${externalLinkAttrs}>${escapeHtml(item.titleEn)}<span class="nl" lang="nl">${escapeHtml(item.title)}</span></a>
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
        <figure class="video card">
          <video src="${escapeHtml(content.video.src)}" controls preload="none" poster="${escapeHtml(content.video.poster)}"></video>
          <figcaption>Faces of Science portrait · KNAW, De Jonge Akademie and NEMO</figcaption>
        </figure>
        <div class="card press">
          <h3 class="mini-head">Research featured in</h3>
          <div class="press-logos"${src("scicomm")}>${logos}</div>
        </div>
        <div class="card appearances">
          <h3 class="mini-head">${escapeHtml(content.mediaHeading)}</h3>
          <ul class="compact-list">${media}</ul>
        </div>
      </div>
      <div class="card col nemo"${src("scicomm")}>
        <div class="nemo-head">
          <a href="${escapeHtml(content.nemo.url)}"${externalLinkAttrs}><img src="logos/${escapeHtml(content.nemo.logo)}" alt="NEMO Kennislink" /></a>
          <p>${escapeHtml(content.nemo.description)}</p>
        </div>
        <ol class="compact-list dense">${nemo}</ol>
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

function renderPath(education, experience, num) {
  const sort = (arr) => [...arr].sort((a, b) => lastYear(b.years) - lastYear(a.years));
  return `<section id="path"${src("education")}>
    ${sectionHead(num, "Path", "From human sciences to the clinic")}
    <div class="split split-even">
      ${renderPathColumn(education.title, sort(education.items), "education")}
      ${renderPathColumn("Research posts", sort(experience.items), "experience")}
    </div>
  </section>`;
}

/* ---------- publications ---------- */
function renderPublication(entry, authorMatch, topicIndex) {
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
    keep.forEach((i) => { if (i - prev > 1) parts.push("…"); parts.push(fmt(authors[i], i)); prev = i; });
    authorShort = parts.join(", ");
  }
  const venue = [f.journal || f.booktitle || f.publisher || f.institution, f.volume ? `vol. ${f.volume}` : "", f.number ? `no. ${f.number}` : ""].filter(Boolean).join(" · ");
  const topic = f.topic || "Other";
  const slug = slugifyTopic(topic);
  const doi = f.doi || "";
  const url = f.url || (doi ? `https://doi.org/${doi}` : "");
  const abstract = f.abstract && !/^N\/A$/i.test(f.abstract) ? f.abstract : "";
  const search = `${title} ${authors.join(" ")} ${venue} ${f.year || ""}`.toLowerCase();

  return `<li class="pub t-${topicIndex.get(slug) || 0}" data-topic="${escapeHtml(slug)}" data-search="${escapeHtml(search)}"${src("bib")}>
    <span class="year">${escapeHtml(f.year || "")}</span>
    <div class="pub-body">
      <p class="pub-title"><span class="topic-dot" title="${escapeHtml(topic)}" aria-hidden="true"></span>${url ? `<a href="${escapeHtml(url)}"${externalLinkAttrs}>${escapeHtml(title)}</a>` : escapeHtml(title)}</p>
      <p class="pub-meta"><span class="pub-authors">${authorShort}</span><span class="venue">${escapeHtml(venue)}</span></p>
      ${abstract || doi ? `<details>
        <summary>${abstract ? "Abstract" : "Details"}</summary>
        ${abstract ? `<p>${escapeHtml(abstract)}</p>` : ""}
        ${authors.length > 4 ? `<p class="small">${authors.map(fmt).join(", ")}</p>` : ""}
        ${doi ? `<div class="badges">
          <span class="doi">doi:${escapeHtml(doi)}</span>
          <span class="__dimensions_badge_embed__" data-doi="${escapeHtml(doi)}" data-legend="hover-right" data-style="small_circle"></span>
          <div class="altmetric-embed" data-badge-type="donut" data-badge-popover="right" data-doi="${escapeHtml(doi)}" data-hide-no-mentions="true"></div>
        </div>` : ""}
      </details>` : ""}
    </div>
  </li>`;
}

function renderPublications(content, publications, num) {
  const topicIndex = new Map(content.topics.map((t, i) => [slugifyTopic(t.name), i + 1]));
  const chips = [`<button type="button" class="chip is-on" data-filter="all">All <span>${publications.length}</span></button>`]
    .concat(content.topics.map((t, i) => {
      const slug = slugifyTopic(t.name);
      const n = publications.filter((p) => slugifyTopic(p.fields.topic || "") === slug).length;
      return `<button type="button" class="chip t-${i + 1}" data-filter="${escapeHtml(slug)}"><span class="topic-dot" aria-hidden="true"></span>${escapeHtml(t.short || t.name)} <span>${n}</span></button>`;
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
    <ol class="pub-list">${publications.map((p) => renderPublication(p, content.authorMatch, topicIndex)).join("")}</ol>
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

    // topbar shows once the hero has scrolled away
    var hero = document.querySelector(".hero");
    var bar = document.querySelector(".topbar");
    if (hero && bar && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        bar.classList.toggle("is-visible", !entries[0].isIntersecting);
      }, { rootMargin: "-40% 0px 0px 0px" }).observe(hero);
    }

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

    // scrollspy for the top bar
    var spyLinks = document.querySelectorAll(".topbar [data-spy]");
    if ("IntersectionObserver" in window && spyLinks.length) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          spyLinks.forEach(function (l) { l.classList.toggle("is-active", l.dataset.spy === e.target.id); });
        });
      }, { rootMargin: "-25% 0px -65% 0px" });
      spyLinks.forEach(function (l) { var s = document.getElementById(l.dataset.spy); if (s) spy.observe(s); });
    }
  });
  </script>`;
}

function renderPage({ site, home, news, education, experience, scicomm, pubContent, publications, cssFile }) {
  const years = publications.map((p) => p.year).filter(Boolean);
  const pathItems = education.items.length + experience.items.length;
  const firstYear = Math.min(...[...education.items, ...experience.items].map((i) => Number.parseInt((String(i.years).match(/\d{4}/) || ["9999"])[0], 10)));
  const overview = [
    { id: "about", label: "About", teaser: "Doctor, researcher, writer" },
    { id: "research", label: "Research", teaser: `${pubContent.topics.length} threads, from iodine to evidence` },
    { id: "writing", label: "Writing & media", teaser: `${scicomm.nemo.links.length} NEMO blogs · ${scicomm.featuredMedia.length} outlets` },
    { id: "path", label: "Path", teaser: `${pathItems} steps since ${firstYear}` },
    { id: "publications", label: "Publications", teaser: `${publications.length} since ${Math.min(...years)}` }
  ];
  const num = (id) => String(overview.findIndex((o) => o.id === id) + 1).padStart(2, "0");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#fbf7f2" />
  <meta name="description" content="${escapeHtml(site.description)}" />
  <meta name="keywords" content="${escapeHtml(site.keywords.join(", "))}" />
  <meta name="author" content="${escapeHtml(site.author)}" />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/jpeg" href="${escapeHtml(site.assets.favicon)}" />
  <link rel="canonical" href="${escapeHtml(site.baseUrl)}" />
  <link rel="preload" href="${escapeHtml(site.assets.font)}" as="font" type="font/ttf" crossorigin />
  <link rel="stylesheet" href="${escapeHtml(cssFile)}" />
  <script async src="https://d1bxh8uas1mnw7.cloudfront.net/assets/embed.js"></script>
  <script async src="https://badge.dimensions.ai/badge.js" charset="utf-8"></script>
  <title>${escapeHtml(site.pageTitle)}</title>
</head>
<body id="top">
  <canvas id="field" aria-hidden="true"></canvas>
  <div class="edit-indicator">Edit mode: press Ctrl/Cmd+Shift+E or use ?edit=1</div>
  ${renderTopbar(site)}
  <main class="page">
    ${renderHero(site, overview)}
    ${renderNews(news)}
    ${renderAbout(home, num("about"))}
    ${renderResearch(pubContent, publications, num("research"))}
    ${renderWriting(scicomm, num("writing"))}
    ${renderPath(education, experience, num("path"))}
    ${renderPublications(pubContent, publications, num("publications"))}
  </main>
  <footer class="footer"${src("site")}>
    <p>${escapeHtml(site.footer.copyright)}</p>
    <p><a href="#top">Back to top ↑</a></p>
  </footer>
  <script src="field.js" defer></script>
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
  const publications = parseBibtex(bibSource)
    .map((entry) => ({ ...entry, year: Number.parseInt(entry.fields.year || "0", 10) || 0 }))
    .sort((a, b) => b.year - a.year);

  const cssFile = await buildCss();
  const html = renderPage({ site, home, news, education, experience, scicomm, pubContent, publications, cssFile });
  await writeFile(path.join(publicDir, "index.html"), html);
  process.stdout.write(`Built public/index.html (${publications.length} publications)\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
