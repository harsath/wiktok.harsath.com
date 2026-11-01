import { HEADERS, wikiQuery } from "./api";

const REST_HTML = "https://en.wikipedia.org/api/rest_v1/page/html/";

// Sections that are reference apparatus rather than reading material.
const DROP_SECTIONS = new Set([
  "References", "Notes", "Citations", "Sources", "Bibliography", "Footnotes",
  "External links", "Further reading", "Notes and references", "Works cited"
]);

// Page furniture that doesn't belong in a reader view.
const DROP_SELECTORS = [
  "script", "style", "link", "meta", "iframe", "object", "embed", "form", "input", "button",
  ".navbox", ".vertical-navbox", ".navbox-styles", ".sidebar", ".hatnote", ".shortdescription",
  ".ambox", ".mbox-small", ".ombox", ".sistersitebox", ".side-box", ".portalbox", ".noprint",
  ".metadata", ".mw-editsection", ".mw-references-wrap", ".reflist", ".refbegin",
  "sup.reference", "sup.mw-ref", ".mw-empty-elt", ".ext-phonos", ".succession-box",
  "[role=navigation]", ".mw-cite-backlink"
].join(",");

const fileKey = src => src?.match(/\/(?:thumb\/)?([0-9a-f]\/[0-9a-f]{2}\/[^/?]+)/)?.[1];

const NON_ARTICLE = /^(File|Image|Media|Category|Help|Wikipedia|WP|Template|Special|Portal|Talk|User|Module|Draft|MediaWiki|TimedText|Book|[A-Za-z]+ talk):/i;

// "./Some_Title#Section" -> "Some Title" (null for non-article namespaces like File: or Help:)
function articleTitle(href) {
  if (!href?.startsWith("./")) return null;
  const title = decodeURIComponent(href.slice(2).split("#")[0]).replace(/_/g, " ");
  return title && !NON_ARTICLE.test(title) ? title : null;
}

const unwrap = el => el.replaceWith(...el.childNodes);

// Wikipedia HTML is rendered with dangerouslySetInnerHTML, so strip anything
// executable and rewrite links/images for an in-app reader.
function clean(html, heroImage) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;

  body.querySelectorAll("section > h2").forEach(h2 => {
    if (DROP_SECTIONS.has(h2.textContent.trim())) h2.parentElement.remove();
  });
  body.querySelectorAll(DROP_SELECTORS).forEach(el => el.remove());
  // Inline styles get stripped below, so drop what Wikipedia hides with them first
  // (e.g. the machine-readable "(1953-03-28)" next to dates in infoboxes).
  body.querySelectorAll("[style]").forEach(el => {
    if (/display\s*:\s*none/i.test(el.getAttribute("style"))) el.remove();
  });

  // The hero already shows the lead image; drop its duplicate from the article.
  const heroKey = fileKey(heroImage);
  if (heroKey) {
    const dupe = [...body.querySelectorAll("img")].find(img => fileKey(img.getAttribute("src")) === heroKey);
    if (dupe) (dupe.closest("figure") || dupe.closest(".infobox tr") || dupe).remove();
  }

  body.querySelectorAll("*").forEach(el => {
    for (const { name } of [...el.attributes]) {
      if (name.startsWith("on") || name === "style" || name.startsWith("data-") ||
          ["about", "typeof", "resource", "srcset"].includes(name)) {
        el.removeAttribute(name);
      }
    }
  });

  body.querySelectorAll("img").forEach(img => {
    const src = img.getAttribute("src") || "";
    if (src.startsWith("//")) img.setAttribute("src", `https:${src}`);
    img.setAttribute("loading", "lazy");
    img.removeAttribute("width");
    img.removeAttribute("height");
  });

  body.querySelectorAll("a").forEach(a => {
    const href = a.getAttribute("href") || "";
    const title = articleTitle(href);
    if (title && !a.classList.contains("new")) {
      a.setAttribute("href", `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`);
      a.dataset.title = title;
    } else if (/^(https?:)?\/\//.test(href)) {
      a.setAttribute("href", href.startsWith("//") ? `https:${href}` : href);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    } else if (!href.startsWith("#")) {
      unwrap(a); // file pages, red links, other namespaces, javascript: etc.
    }
  });

  // Wide tables scroll sideways instead of stretching the page.
  body.querySelectorAll("table").forEach(table => {
    const wrap = doc.createElement("div");
    wrap.className = table.classList.contains("infobox") ? "table-scroll infobox-wrap" : "table-scroll";
    table.replaceWith(wrap);
    wrap.appendChild(table);
  });

  return body.innerHTML;
}

export async function fetchArticle(title) {
  const [meta] = await wikiQuery({
    titles: title,
    redirects: 1,
    prop: "pageimages|description|extracts",
    piprop: "thumbnail",
    pithumbsize: 1280,
    exintro: 1,
    explaintext: 1,
    exsentences: 2
  });
  if (!meta) throw new Error(`No article named "${title}"`);

  const res = await fetch(REST_HTML + encodeURIComponent(meta.title.replace(/ /g, "_")), { headers: HEADERS });
  if (!res.ok) throw new Error(`Wikipedia REST ${res.status}`);
  const image = meta.thumbnail?.source || null;

  return {
    title: meta.title,
    description: meta.description || "",
    image,
    desc: meta.extract || "",
    html: clean(await res.text(), image)
  };
}
