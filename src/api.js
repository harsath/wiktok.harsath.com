import { FEEDS } from "./feeds";

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const BATCH_SIZE = 10;

// Browsers can't set User-Agent; Wikimedia asks for Api-User-Agent instead.
export const HEADERS = { "Api-User-Agent": "wiktok.harsath.com (https://github.com/harsath)" };

const PAGE_PROPS = {
  prop: "extracts|pageimages",
  exintro: 1,
  explaintext: 1,
  exlimit: BATCH_SIZE,
  piprop: "thumbnail",
  pithumbsize: 1280
};

export async function wikiQuery(params) {
  const url = new URL(WIKI_API);
  const all = { action: "query", format: "json", formatversion: 2, origin: "*", ...params };
  Object.entries(all).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  const data = await res.json();
  return (data.query?.pages || []).filter(p => !p.missing && !p.invalid);
}

const toCard = page => ({
  title: page.title,
  desc: page.extract,
  image: page.thumbnail?.source || null
});

// Static-list feeds: shuffle the full title list once, then walk through it so
// nothing repeats until the whole category has been seen.
const pools = {};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function nextTitles(feedId) {
  if (!pools[feedId]) {
    // Parcel resolves a dynamic JSON import to the value itself, not a module namespace.
    const mod = await FEEDS[feedId].load();
    const titles = mod.default ?? mod;
    pools[feedId] = { titles: shuffle([...titles]), cursor: 0 };
  }
  const pool = pools[feedId];
  if (pool.cursor >= pool.titles.length) {
    shuffle(pool.titles);
    pool.cursor = 0;
  }
  const batch = pool.titles.slice(pool.cursor, pool.cursor + BATCH_SIZE);
  pool.cursor += BATCH_SIZE;
  return batch;
}

async function fetchCurated(feedId) {
  const titles = await nextTitles(feedId);
  const pages = await wikiQuery({ ...PAGE_PROPS, titles: titles.join("|"), redirects: 1 });
  // The API returns pages in arbitrary order; keep the shuffled order.
  const order = new Map(titles.map((t, i) => [t, i]));
  const rank = p => order.get(p.title) ?? BATCH_SIZE;
  return pages.sort((a, b) => rank(a) - rank(b)).map(toCard);
}

async function fetchTopic(feedId) {
  const pages = await wikiQuery({
    ...PAGE_PROPS,
    generator: "search",
    gsrsearch: FEEDS[feedId].query,
    gsrsort: "random",
    gsrlimit: BATCH_SIZE,
    gsrnamespace: 0
  });
  return pages.map(toCard);
}

export async function fetchArticles(feedId) {
  return FEEDS[feedId].load ? fetchCurated(feedId) : fetchTopic(feedId);
}
