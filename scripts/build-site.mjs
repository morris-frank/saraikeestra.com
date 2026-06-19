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

function renderEducationSection(content) {
  const cards = content.items
    .map(
      (item) => `<div${sourceAttrs("content/education.json", "Education content")}>
        <div class="institution">
          <div>
            <p>${escapeHtml(item.institution)}</p>
            <p class="years">${escapeHtml(item.years)}</p>
          </div>
          ${item.logo ? `<img src="logos/${escapeHtml(item.logo)}" alt="${escapeHtml(item.institution)} logo" loading="lazy" />` : ""}
        </div>
        <div class="degree">
          <p class="degree-name">${escapeHtml(item.degree)}</p>
          ${item.distinction ? `<p class="distinction">${escapeHtml(item.distinction)}</p>` : ""}
        </div>
        ${item.description ? `<p class="description">${escapeHtml(item.description)}</p>` : ""}
        ${item.thesis ? `<p class="thesis">Thesis: ${escapeHtml(item.thesis)}</p>` : ""}
        ${item.supervisors ? `<p class="supervisors">Supervisors: ${escapeHtml(item.supervisors.join(", "))}</p>` : ""}
      </div>`
    )
    .join("");

  return `<section${sourceAttrs("content/education.json", "Education content")}>
    <h2>${escapeHtml(content.title)}</h2>
    <div class="education">${cards}</div>
    <p class="education-swipe">${escapeHtml(content.swipeHint)}</p>
  </section>`;
}

function renderExperienceSection(content) {
  const cards = content.items
    .map(
      (item) => `<div${sourceAttrs("content/experience.json", "Experience content")}>
        <div class="institution">
          <div>
            <p>${escapeHtml(item.institution)}</p>
            <p class="years">${escapeHtml(item.years)}</p>
          </div>
          ${item.logo ? `<img src="logos/${escapeHtml(item.logo)}" alt="${escapeHtml(item.institution)} logo" loading="lazy" />` : ""}
        </div>
        <p class="title">${escapeHtml(item.title)}</p>
        <p class="description">${escapeHtml(item.description)}</p>
      </div>`
    )
    .join("");

  return `<section${sourceAttrs("content/experience.json", "Experience content")}>
    <h2>${escapeHtml(content.title)}</h2>
    <div class="experience">${cards}</div>
    <p class="experience-swipe">${escapeHtml(content.swipeHint)}</p>
  </section>`;
}

function renderScienceCommunicationSection(content) {
  const featuredMedia = content.featuredMedia
    .map(
      (item) => `<a href="${escapeHtml(item.url)}"${externalLinkAttrs}${sourceAttrs("content/science-communication.json", "Science communication content")}>
        <img src="logos/${escapeHtml(item.logo)}" alt="${escapeHtml(item.name)} logo" loading="lazy" />
      </a>`
    )
    .join("");

  const nemoLinks = content.nemo.links
    .map(
      (item) => `<a href="${escapeHtml(item.url)}"${externalLinkAttrs}${sourceAttrs("content/science-communication.json", "Science communication content")}>
        <div>
          <p>${escapeHtml(item.titleEn)}</p>
          <p>${escapeHtml(item.title)}</p>
        </div>
        <span>${escapeHtml(item.year)}</span>
      </a>`
    )
    .join("");

  const media = content.media
    .map(
      (item) => `<div${sourceAttrs("content/science-communication.json", "Science communication content")}>
        ${item.url ? `<a href="${escapeHtml(item.url)}"${externalLinkAttrs}>${escapeHtml(item.title)}</a>` : `<span>${escapeHtml(item.title)}</span>`}
        <div>
          <span>${escapeHtml(item.outlet)}</span>
          <span>${escapeHtml(item.year)}</span>
        </div>
      </div>`
    )
    .join("");

  return `<section${sourceAttrs("content/science-communication.json", "Science communication content")}>
    <h2>${escapeHtml(content.title)}</h2>
    <video src="${escapeHtml(content.video.src)}" controls poster="${escapeHtml(content.video.poster)}"></video>
    <div class="nemo-box"${sourceAttrs("content/science-communication.json", "Science communication content")}>
      <a href="${escapeHtml(content.nemo.url)}"${externalLinkAttrs}>
        <img src="logos/${escapeHtml(content.nemo.logo)}" alt="${escapeHtml(content.nemo.title)} logo" />
      </a>
      <p>${escapeHtml(content.nemo.description)}</p>
      ${nemoLinks}
    </div>
    <h3>${escapeHtml(content.mediaHeading)}</h3>
    <div class="featured-media"${sourceAttrs("content/science-communication.json", "Science communication content")}>${featuredMedia}</div>
    <div class="media"${sourceAttrs("content/science-communication.json", "Science communication content")}>${media}</div>
  </section>`;
}

function renderPublication(entry, authorMatch) {
  const fields = entry.fields;
  const title = fields.title || entry.key;
  const authors = splitAuthors(fields.author || "");
  const matchedIndex = authors.findIndex((author) => author.toLowerCase().includes(String(authorMatch).toLowerCase()));
  const expands = authors.length > 3;
  const authorHtml = authors
    .map((author, index) => {
      const isMatch = index === matchedIndex;
      const isFirst = index === 0;
      const isLast = index === authors.length - 1;
      const className = isMatch ? "author-match" : !expands || isFirst || isLast ? "author-visible" : "author-toggle";
      const text = `${author}${isLast ? "" : ","}`;
      const prefix = isFirst && expands && !isMatch ? `<span class="author-ellipsis">...</span>` : "";
      const suffix = isLast && expands && !isMatch ? `<span class="author-ellipsis">...</span>` : "";
      return `${prefix}<span class="${className}">${escapeHtml(text)}</span>${suffix}`;
    })
    .join("");
  const source = [fields.journal || fields.booktitle || fields.publisher || fields.institution, fields.volume ? `Vol. ${fields.volume}` : "", fields.number ? `No. ${fields.number}` : ""]
    .filter(Boolean)
    .join(" | ");
  const topic = fields.topic || "Other";
  const topicClass = slugifyTopic(topic);
  const doi = fields.doi || "";
  const url = fields.url || (doi ? `https://doi.org/${doi}` : "");
  const hasScore = doi.startsWith("10.");
  return `<div class="reference ${hasScore ? "with-score" : "no-score"} ${escapeHtml(topicClass)}" style="order: 200;" data-topic="${escapeHtml(topicClass)}"${sourceAttrs("references.bib", "Publication source file")}>
    <div class="year">${escapeHtml(fields.year || "")}</div>
    <div class="source"><span>${escapeHtml(source)}</span></div>
    <span class="topic">${escapeHtml(topic)}</span>
    <div class="title">
      ${url ? `<a href="${escapeHtml(url)}"${externalLinkAttrs}>${escapeHtml(title)}</a>` : escapeHtml(title)}
      ${doi ? `<span>${escapeHtml(doi)}</span>` : ""}
    </div>
    <div class="badges">
      ${doi ? `<span class="__dimensions_badge_embed__" data-doi="${escapeHtml(doi)}" data-legend="hover-right" data-style="small_circle"></span>` : ""}
      ${doi ? `<div class="altmetric-embed" data-badge-type="donut" data-badge-popover="right" data-doi="${escapeHtml(doi)}"></div>` : ""}
      ${doi ? `<a href="https://plu.mx/plum/a/?doi=${escapeHtml(doi)}" class="plumx-plum-print-popup" data-popup="right" data-size="medium" data-site="plum" data-hide-when-empty="true"${externalLinkAttrs}></a>` : ""}
    </div>
    <div class="authors ${expands ? "" : "expanded"}" onclick="this.classList.add('expanded')">${authorHtml}</div>
    <div class="abstract"><div>${escapeHtml(fields.abstract || "")}</div></div>
  </div>`;
}

function renderPublicationsSection(content, bibSource) {
  const publications = parseBibtex(bibSource)
    .map((entry) => ({ ...entry, year: Number.parseInt(entry.fields.year || "0", 10) || 0 }))
    .sort((left, right) => right.year - left.year);

  const topics = content.topics
    .map(
      (topic) => `<span class="active ${escapeHtml(slugifyTopic(topic.name))}" data-topic="${escapeHtml(slugifyTopic(topic.name))}"${sourceAttrs("content/publications.json", "Publication topics")}>${escapeHtml(topic.name)}</span>`
    )
    .join("");

  const topicDescriptions = content.topics
    .map(
      (topic) => `<div class="topic-desc hidden ${escapeHtml(slugifyTopic(topic.name))}"${sourceAttrs("content/publications.json", "Publication topics")}>
        <h3>${escapeHtml(topic.name)}</h3>
        <p>${escapeHtml(topic.description)}</p>
      </div>`
    )
    .join("");

  const entries = publications.map((entry) => renderPublication(entry, content.authorMatch)).join("");

  return `<section${sourceAttrs("content/publications.json", "Publication topics")}>
    <h2>${escapeHtml(content.title)}</h2>
    <div class="topic-tags">${topics}</div>
    ${topicDescriptions}
    ${entries}
  </section>`;
}

async function buildCss() {
  const files = (await readdir(themeDir))
    .filter((file) => file.endsWith(".css"))
    .sort();
  const css = (
    await Promise.all(
      files.map(async (file) => `/* ${file} */\n${await readFile(path.join(themeDir, file), "utf8")}`)
    )
  ).join("\n\n");
  const hash = crypto.createHash("md5").update(css).digest("hex").slice(0, 8);
  const fileName = `style-${hash}.css`;

  const publicFiles = await readdir(publicDir);
  await Promise.all(
    publicFiles
      .filter((file) => /^style-[a-f0-9]{8}\.css$/.test(file))
      .map((file) => rm(path.join(publicDir, file)))
  );

  await writeFile(path.join(publicDir, fileName), css);
  return fileName;
}

function renderEditScript(site) {
  const repo = `${site.repo.owner}/${site.repo.name}`;
  return `<script>
    document.addEventListener("DOMContentLoaded", function () {
      const editConfig = ${JSON.stringify({ repo, branch: site.repo.branch })};
      const body = document.body;
      function editUrl(file) {
        return "https://github.com/" + editConfig.repo + "/edit/" + editConfig.branch + "/" + encodeURI(file).replaceAll("%2F", "/");
      }

      function updateEditState(enabled) {
        body.classList.toggle("config-edit-mode", enabled);
      }

      window.enableConfigEditMode = function (enabled = true) {
        updateEditState(Boolean(enabled));
      };

      window.openConfigSourceFromElement = function (element) {
        const target = element instanceof Element ? element.closest("[data-source-file]") : null;
        if (!target) return false;
        window.location.href = editUrl(target.dataset.sourceFile);
        return true;
      };

      updateEditState(new URLSearchParams(window.location.search).get("edit") === "1");

      document.addEventListener("keydown", function (event) {
        if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "e") {
          event.preventDefault();
          updateEditState(!body.classList.contains("config-edit-mode"));
        }
      });

      document.addEventListener("click", function (event) {
        if (!body.classList.contains("config-edit-mode")) return;
        const target = event.target.closest("[data-source-file]");
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        window.location.href = editUrl(target.dataset.sourceFile);
      }, true);

      function reorderReferences() {
        const references = document.querySelectorAll(".reference.with-score");
        let allScoresFound = true;
        references.forEach((ref) => {
          const scoreElement = ref.querySelector(".__dimensions_badge_embed__ .__db_score");
          if (!scoreElement) {
            allScoresFound = false;
            return;
          }
          const score = 200 - parseFloat(scoreElement.textContent);
          ref.style.order = score;
        });
        if (!allScoresFound) {
          setTimeout(reorderReferences, 500);
        }
      }

      reorderReferences();

      const topicTags = document.querySelectorAll(".topic-tags span");
      const topicDescs = document.querySelectorAll(".topic-desc");
      const references = document.querySelectorAll(".reference");

      topicTags.forEach((filter) => {
        filter.addEventListener("click", function () {
          if (body.classList.contains("config-edit-mode")) return;
          if (this.classList.contains("selected")) {
            topicTags.forEach((tag) => {
              tag.classList.remove("selected");
              tag.classList.add("active");
            });
            topicDescs.forEach((desc) => desc.classList.add("hidden"));
            references.forEach((reference) => reference.classList.remove("hidden"));
            return;
          }

          topicTags.forEach((tag) => {
            tag.classList.remove("selected");
            tag.classList.remove("active");
          });
          this.classList.add("selected");
          topicDescs.forEach((desc) => desc.classList.add("hidden"));
          const topic = this.dataset.topic;
          const description = document.querySelector(".topic-desc." + topic);
          if (description) description.classList.remove("hidden");
          references.forEach((reference) => {
            reference.classList.toggle("hidden", !reference.classList.contains(topic));
          });
        });
      });
    });
  </script>`;
}

function renderPage({ site, home, education, experience, scienceCommunication, publications, cssFile }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="${escapeHtml(site.themeColor)}" />
  <meta name="description" content="${escapeHtml(site.description)}" />
  <meta name="keywords" content="${escapeHtml(site.keywords.join(", "))}" />
  <meta name="author" content="${escapeHtml(site.author)}" />
  <meta name="robots" content="index, follow" />
  <meta name="language" content="${escapeHtml(site.language)}" />
  <link rel="icon" type="image/jpeg" href="${escapeHtml(site.assets.favicon)}" />
  <link rel="canonical" href="${escapeHtml(site.baseUrl)}" />
  <link rel="stylesheet" href="${escapeHtml(cssFile)}" />
  <script type="text/javascript" src="https://d1bxh8uas1mnw7.cloudfront.net/assets/embed.js"></script>
  <script async src="https://badge.dimensions.ai/badge.js" charset="utf-8"></script>
  <script type="text/javascript" src="//cdn.plu.mx/widget-popup.js"></script>
  <title>${escapeHtml(site.pageTitle)}</title>
</head>
<body>
  <div class="edit-indicator">Edit mode: press Ctrl/Cmd+Shift+E or use ?edit=1</div>
  <header${sourceAttrs("content/site.json", "Site settings")}>
    <img src="${escapeHtml(site.assets.profileImage)}" alt="${escapeHtml(site.name)}" />
    <main>
      <h1>${escapeHtml(site.name)}</h1>
      <nav>
        ${site.socialLinks
          .map(
            (link) => `<a href="${escapeHtml(link.url)}"${externalLinkAttrs} aria-label="${escapeHtml(link.label)}">${renderSocialIcon(link.icon, link.label)}</a>`
          )
          .join("")}
      </nav>
    </main>
  </header>

  <header class="sticky"${sourceAttrs("content/site.json", "Site settings")}>
    <img src="${escapeHtml(site.assets.profileImage)}" alt="${escapeHtml(site.name)}" />
    <main>
      <h1>${escapeHtml(site.name)}</h1>
    </main>
  </header>

  <section${sourceAttrs("content/home.json", "Home intro")}>
    ${home.intro.map((paragraph) => `<p>${renderRichText(paragraph.parts)}</p>`).join("")}
  </section>

  <main>
    ${renderEducationSection(education)}
    ${renderExperienceSection(experience)}
    ${renderScienceCommunicationSection(scienceCommunication)}
    ${renderPublicationsSection(publications.content, publications.bibSource)}
  </main>

  <footer${sourceAttrs("content/site.json", "Site settings")}>
    <p>${escapeHtml(site.footer.copyright)}</p>
  </footer>

  ${renderEditScript(site)}
</body>
</html>`;
}

async function main() {
  const [site, home, education, experience, scienceCommunication, publicationsContent, bibSource] = await Promise.all([
    readJson("content/site.json"),
    readJson("content/home.json"),
    readJson("content/education.json"),
    readJson("content/experience.json"),
    readJson("content/science-communication.json"),
    readJson("content/publications.json"),
    readText("references.bib")
  ]);

  const cssFile = await buildCss();
  const html = renderPage({
    site,
    home,
    education,
    experience,
    scienceCommunication,
    publications: { content: publicationsContent, bibSource },
    cssFile
  });

  await writeFile(path.join(publicDir, "index.html"), html);
  process.stdout.write("Built public/index.html\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
