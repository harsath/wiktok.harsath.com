// Feeds come from one of two sources:
// - `load`: a static title list in data/ (curated via Wiki-Indexer, scripts/crawl_categories.py
//   or scripts/build_hackernews.py).
// - `query`: live random picks from Wikipedia search.
// `group` decides where a feed shows up in the topic picker.

// Reviewed articles span every subject, which makes them the broadest feeds.
const TYPES = {
  featured: { label: "Featured articles", query: "incategory:Featured_articles" },
  good: { label: "Good articles", query: "incategory:Good_articles" }
};

// Articles HN commenters keep linking to, mined from every comment by scripts/build_hackernews.py.
const HN = {
  hackernews: { label: "Hacker News", load: () => import("../data/hackernews.json") }
};

// Static strings so Parcel can code-split each list into its own lazy bundle.
const CURATED = {
  cs: { label: "Computer Science", load: () => import("../data/cs.json") },
  math: { label: "Mathematics", load: () => import("../data/math.json") },
  physics: { label: "Physics", load: () => import("../data/physics.json") },
  bio: { label: "Biology", load: () => import("../data/bio.json") },
  health: { label: "Health", load: () => import("../data/health.json") },
  phil: { label: "Philosophy", load: () => import("../data/phil.json") },
  biz: { label: "Business", load: () => import("../data/biz.json") },
  econ: { label: "Economics", load: () => import("../data/econ.json") },
  law: { label: "Law", load: () => import("../data/law.json") },
  psych: { label: "Psychology", load: () => import("../data/psych.json") },
  electronics: { label: "Electronics", load: () => import("../data/electronics.json") }
};

// Crawled from hand-picked Wikipedia categories by scripts/crawl_categories.py.
const INDIA = {
  "india-history": { label: "Indian History", load: () => import("../data/india-history.json") },
  "india-cricket": { label: "Indian Cricket", load: () => import("../data/india-cricket.json") },
  "india-politics": { label: "Indian Politics", load: () => import("../data/india-politics.json") },
  "india-economy": { label: "Indian Economy", load: () => import("../data/india-economy.json") },
  "india-culture": { label: "Culture of India", load: () => import("../data/india-culture.json") }
};

// topic -> label, or [label, extra search filter]
const TOPICS = {
  space: "Space",
  // Without this, year pages ("1779 in Wales", "522") dominate the feed.
  history: ["History", "-intitle:/[0-9][0-9][0-9]/"],
  chemistry: "Chemistry",
  "earth-and-environment": "Earth & Environment",
  software: "Software",
  "military-and-warfare": "Military & Warfare",
  architecture: "Architecture",
  "visual-arts": "Visual Arts",
  literature: "Literature",
  linguistics: "Linguistics",
  music: "Music",
  films: "Films",
  "video-games": "Video Games",
  "food-and-drink": "Food & Drink"
};

export const DEFAULT_FEED = "featured";

export const FEEDS = {
  ...Object.fromEntries(
    Object.entries(TYPES).map(([id, f]) => [id, { group: "type", ...f }])
  ),
  ...Object.fromEntries(
    Object.entries(HN).map(([id, f]) => [id, { group: "hn", ...f }])
  ),
  ...Object.fromEntries(
    Object.entries(CURATED).map(([id, f]) => [id, { group: "curated", ...f }])
  ),
  ...Object.fromEntries(
    Object.entries(INDIA).map(([id, f]) => [id, { group: "india", ...f }])
  ),
  ...Object.fromEntries(
    Object.entries(TOPICS).map(([topic, entry]) => {
      const [label, extra = ""] = [].concat(entry);
      return [
        `t-${topic}`,
        {
          group: "topic",
          label,
          // Drop stubs (every stub template uses Template:Asbox), biographies,
          // lists and disambiguation pages, which otherwise dominate random picks.
          query: `articletopic:${topic} -articletopic:biography -hastemplate:Asbox -hastemplate:Dmbox -intitle:"List of" ${extra}`.trim()
        }
      ];
    })
  )
};
