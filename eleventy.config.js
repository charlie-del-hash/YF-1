const { EleventyHtmlBasePlugin } = require("@11ty/eleventy");
const pluginRss = require("@11ty/eleventy-plugin-rss");
const MarkdownIt = require("markdown-it");
const sections = require("./src/_data/sections.js");

const md = new MarkdownIt({ html: true });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Renders a .frame figure. Options:
   { ratio: ""|"wide"|"43"|"32"|"sq", src, alt, label, caption, credit } */
function frameHtml(o = {}) {
  const ratios = { wide: " frame--wide", 43: " frame--43", 32: " frame--32", sq: " frame--sq" };
  const ratio = ratios[o.ratio] || "";
  const inner = o.src
    ? `<img src="${esc(o.src)}" alt="${esc(o.alt || "")}">`
    : `<span class="frame-label">${esc(o.label || "Image slot · replace with img")}</span>`;
  const credit = o.credit ? ` <span class="credit">${esc(o.credit)}</span>` : "";
  const caption = o.caption ? `<figcaption>${o.caption}${credit}</figcaption>` : "";
  return `<figure><div class="frame${ratio}">${inner}</div>${caption}</figure>`;
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPassthroughCopy({ "src/css": "css", "src/images": "images" });

  /* ---------- filters ---------- */

  eleventyConfig.addFilter("readableDate", (d) => {
    const date = d instanceof Date ? d : new Date(d);
    return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  });

  eleventyConfig.addFilter("readingTime", (content) => {
    const words = String(content || "").replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
    return `${Math.max(1, Math.round(words / 220))} min read`;
  });

  /* first section (from ./src/_data/sections.js) matching a page's tags */
  eleventyConfig.addFilter("sectionOf", (tags) => {
    const t = tags || [];
    return sections.find((s) => t.includes(s.slug)) || null;
  });

  /* section archive URL for a display name like "Air Warfare", else null */
  eleventyConfig.addFilter("sectionSlugFor", (name) => {
    const s = sections.find((x) => x.title.toLowerCase() === String(name).toLowerCase());
    return s ? s.slug : null;
  });

  eleventyConfig.addFilter("findFeatured", (coll = []) => {
    const flagged = coll.filter((p) => p.data.featured);
    return flagged.length ? flagged[flagged.length - 1] : coll[coll.length - 1];
  });

  eleventyConfig.addFilter("without", (coll = [], page) =>
    coll.filter((p) => !page || p.url !== page.url)
  );

  eleventyConfig.addFilter("newestFirst", (coll = []) => [...coll].reverse());

  eleventyConfig.addFilter("limitTo", (coll = [], n) => coll.slice(0, n));

  /* newest n articles that aren't the current page — used for "related" */
  eleventyConfig.addFilter("relatedTo", (coll = [], page, n = 3) =>
    [...coll].reverse().filter((p) => p.url !== page.url).slice(0, n)
  );

  eleventyConfig.addFilter("frameHtml", frameHtml);

  /* look up one article by its file slug — used by the Theme Thunder pages
     to re-render an existing article inside a period-correct design */
  eleventyConfig.addFilter("articleBySlug", (coll = [], slug) =>
    coll.find((p) => p.fileSlug === slug) || null
  );

  /* ---------- shortcodes ---------- */

  eleventyConfig.addShortcode("frame", frameHtml);

  eleventyConfig.addShortcode("dinkus", () => `<p class="dinkus" aria-hidden="true">✦ ✦ ✦</p>`);

  eleventyConfig.addShortcode("factbox", (title, rows = []) => {
    const body = rows
      .map(([k, v]) => `<div class="row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`)
      .join("\n      ");
    return `<div class="factbox">
  <h2 class="factbox-title">${esc(title)}</h2>
  <dl>
      ${body}
  </dl>
</div>`;
  });

  eleventyConfig.addPairedShortcode("pullquote", (content, cite) => {
    const c = cite ? `<cite>${esc(cite)}</cite>` : "";
    return `<div class="pullquote"><p>${content.trim()}</p>${c}</div>`;
  });

  eleventyConfig.addPairedShortcode("wireitem", (content, no, dateline, hed, meta) => {
    const metaLine = meta ? `<p class="wire-meta">${esc(meta)}</p>` : "";
    return `<article class="wire-item">
  <span class="wire-no">${esc(no)}</span>
  <div>
    <span class="dateline">${esc(dateline)}</span>
    <h2 class="wire-hed">${esc(hed)}</h2>
    ${md.render(content.trim())}
    ${metaLine}
  </div>
</article>`;
  });

  return {
    dir: { input: "src", includes: "_includes", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
