# /// script
# requires-python = ">=3.9"
# dependencies = ["duckdb"]
# ///
"""Build data/hackernews.json: the Wikipedia articles Hacker News keeps citing.

Walks every HN comment and story since 2006 (the open-index/hacker-news Parquet
mirror on Hugging Face, ~12 GB), pulls out English Wikipedia links, resolves them
to canonical articles through the Wikipedia API, and keeps articles cited by
enough different people in enough different threads, asking more of articles
that are popular everywhere.

Usage: uv run scripts/build_hackernews.py [work_dir]   (default work_dir: .hn-cache)
Every stage caches its output in work_dir, so reruns only redo what's missing.
"""
import concurrent.futures
import html
import json
import re
import socket
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import duckdb

DATASET = "https://huggingface.co/datasets/open-index/hacker-news"
WIKI_API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "wiktok.harsath.com HN citation builder (https://github.com/harsath)"
OUT = Path(__file__).resolve().parent.parent / "data" / "hackernews.json"

# HN wraps links as <a href="full url">possibly truncated url...</a>; keep only the href.
ANCHOR = re.compile(r'<a\s[^>]*?href="([^"]*)"[^>]*>.*?</a>', re.S | re.I)
WIKI_URL = re.compile(
    r"(?:https?://)?(?:(?:en|en\.m|www)\.)?wikipedia\.org/(?:wiki/|w/index\.php\?)[^\s<>\"]+", re.I)
# Links into these namespaces aren't articles.
NAMESPACES = {
    "file", "image", "media", "special", "talk", "user", "user talk", "wikipedia", "wp", "project",
    "category", "template", "help", "portal", "draft", "module", "mediawiki", "book", "timedtext",
    "wikipedia talk", "template talk", "category talk", "file talk", "help talk", "portal talk",
    "wiktionary", "wikt", "commons", "meta", "m", "s", "q", "b", "n", "v",
}

# An article makes the cut when this many different people linked it, in this many different
# threads, across this many different years: recurring recommendations, not one-off news.
MIN_USERS, MIN_THREADS, MIN_YEARS = 8, 3, 2
# Articles popular everywhere ("Hong Kong", "Boeing 707") get linked as definitions. Above this
# many views in 60 days, the people needed grows with the square root of an article's views.
POPULAR_VIEWS = 20_000
LIST_PREFIXES = ("List of", "Lists of", "Comparison of", "Index of", "Outline of")
# "Main Page" is Wikipedia's home page; "Anchoring" (the bias) now redirects to "Anchor".
EXCLUDE = {"Main Page", "Anchor"}


def month_files():
    """Paths of every monthly Parquet file in the dataset."""
    url = f"https://huggingface.co/api/datasets/open-index/hacker-news/tree/main/data?recursive=true"
    with urllib.request.urlopen(url, timeout=60) as res:
        tree = json.load(res)
    return sorted(f["path"] for f in tree if f["type"] == "file" and f["path"].endswith(".parquet"))


def extract_month(path, work):
    """Download one month and keep only what later stages need, then drop the raw file."""
    name = Path(path).stem
    done = work / "extract" / f"{name}.done"
    if done.exists():
        return name
    raw = work / "raw" / f"{name}.parquet"
    for attempt in range(6):
        try:
            urllib.request.urlretrieve(f"{DATASET}/resolve/main/{path}", raw)
            break
        except OSError:
            if attempt == 5:
                raise
            time.sleep(2 ** attempt)
    con = duckdb.connect()
    src = f"read_parquet('{raw}')"
    out = work / "extract"
    # Items that mention Wikipedia, in comment text or as a story's link.
    con.execute(f"""COPY (SELECT id, type, "by", time, parent, text, url, dead, deleted FROM {src}
        WHERE (text ILIKE '%wikipedia.org%' OR url ILIKE '%wikipedia.org%') AND "by" IS NOT NULL)
        TO '{out}/links-{name}.parquet'""")
    # Parent edges, to find the thread each comment belongs to.
    con.execute(f"COPY (SELECT id, parent FROM {src} WHERE parent IS NOT NULL) TO '{out}/edges-{name}.parquet'")
    # Story titles, to see which threads a citation came from.
    con.execute(f"""COPY (SELECT id, title, score, time FROM {src} WHERE type = 1)
        TO '{out}/stories-{name}.parquet'""")
    con.close()
    raw.unlink()
    done.touch()
    return name


def extract(work):
    socket.setdefaulttimeout(60)  # a dropped connection otherwise stalls a download forever
    (work / "raw").mkdir(parents=True, exist_ok=True)
    (work / "extract").mkdir(parents=True, exist_ok=True)
    files = month_files()
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        for i, name in enumerate(pool.map(lambda p: extract_month(p, work), files), 1):
            print(f"  extracted {name} ({i}/{len(files)})", flush=True)


def link_titles(text):
    """English Wikipedia article titles linked from an HN comment's HTML (or a story URL)."""
    text = html.unescape(ANCHOR.sub(lambda m: f" {m.group(1)} ", text or ""))
    titles = set()
    for match in WIKI_URL.finditer(text):
        # Bare URLs pick up sentence punctuation; drop it but keep balanced parentheses.
        url = match.group(0).rstrip(".,;:!?*'")
        while url.endswith(")") and url.count("(") < url.count(")"):
            url = url[:-1].rstrip(".,;:!?*'")
        if "://" not in url:
            url = f"https://{url}"
        parts = urllib.parse.urlsplit(url)
        if parts.path.startswith("/wiki/"):
            title = parts.path[len("/wiki/"):]
        else:
            title = urllib.parse.parse_qs(parts.query).get("title", [""])[0]
        title = urllib.parse.unquote(title).replace("_", " ").strip()
        if not title or title.endswith(("...", "…")):
            continue
        if ":" in title and title.split(":", 1)[0].strip().lower() in NAMESPACES:
            continue
        titles.add(title[0].upper() + title[1:])
    return titles


def mentions(work):
    """One row per (linked title, HN item), with the author and the thread it belongs to."""
    db = work / "hn.duckdb"
    con = duckdb.connect(str(db))
    if "mentions" in {t for (t,) in con.execute("SHOW TABLES").fetchall()}:
        return con
    ext = work / "extract"
    items = con.execute(f"""SELECT id, text, url FROM '{ext}/links-*.parquet'
        WHERE coalesce(dead, 0) = 0 AND coalesce(deleted, 0) = 0""").fetchall()
    with open(work / "titles.jsonl", "w") as f:
        for id_, text, url in items:
            for title in link_titles(text) | link_titles(url):
                f.write(json.dumps({"id": id_, "title": title}) + "\n")
    con.execute(f"""CREATE TABLE m AS SELECT t.title, l.id, l."by", l.time,
        CASE WHEN l.type = 2 THEN l.parent END AS anc
        FROM read_json('{work}/titles.jsonl', columns = {{id: 'UINTEGER', title: 'VARCHAR'}}) t
        JOIN '{ext}/links-*.parquet' l USING (id)""")
    # Walk each comment up its parents until reaching the story (or poll) at the top.
    # Stories have parent 0 in this dataset, so leave them out or every walk ends at item 0.
    con.execute(f"CREATE TABLE edges AS SELECT * FROM '{ext}/edges-*.parquet' WHERE parent > 0")
    con.execute("CREATE TABLE walk AS SELECT DISTINCT id, anc FROM m WHERE anc IS NOT NULL")
    while True:
        moved = con.execute("""UPDATE walk SET anc = edges.parent FROM edges
            WHERE edges.id = walk.anc""").fetchone()[0]
        if not moved:
            break
    con.execute("""CREATE TABLE mentions AS SELECT m.title, m.id, m."by", m.time,
        coalesce(walk.anc, m.id) AS story FROM m LEFT JOIN (SELECT DISTINCT id, anc FROM walk) walk USING (id)""")
    con.execute("DROP TABLE m; DROP TABLE walk; DROP TABLE edges")
    con.execute(f"CREATE TABLE stories AS SELECT * FROM '{ext}/stories-*.parquet'")
    return con


def wiki_api(params):
    params = {"action": "query", "format": "json", "formatversion": 2, **params}
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(WIKI_API, data=data, headers={"User-Agent": USER_AGENT})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                return json.load(res)
        except Exception as err:
            if attempt == 5:
                raise
            retry_after = getattr(err, "headers", None) and err.headers.get("Retry-After")
            time.sleep(int(retry_after) if retry_after and retry_after.isdigit() else 2 ** attempt)


def resolve(titles, cache_path):
    """Map raw linked titles to canonical article info, following redirects. Cached on disk."""
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    todo = sorted(t for t in titles if t not in cache)
    for i in range(0, len(todo), 50):
        batch = todo[i:i + 50]
        data = wiki_api({"titles": "|".join(batch), "redirects": 1, "prop": "pageprops|templates",
                         "ppprop": "disambiguation", "tltemplates": "Template:Asbox", "tllimit": "max"})
        q = data.get("query", {})
        renames = {n["from"]: n["to"] for n in q.get("normalized", [])}
        redirects = {r["from"]: r["to"] for r in q.get("redirects", [])}
        pages = {p["title"]: p for p in q.get("pages", [])}
        for raw in batch:
            title = renames.get(raw, raw)
            for _ in range(5):  # redirect chains
                title = redirects.get(title, title)
            page = pages.get(title)
            if not page or page.get("missing") or page.get("invalid") or page.get("ns") != 0:
                cache[raw] = None
            else:
                cache[raw] = {"title": page["title"], "disambig": "pageprops" in page,
                              "stub": bool(page.get("templates"))}
        if i // 50 % 100 == 0:
            cache_path.write_text(json.dumps(cache))
            print(f"  resolved {i + len(batch)}/{len(todo)}", flush=True)
    cache_path.write_text(json.dumps(cache))
    return cache


def pageviews(titles, cache_path):
    """Views over the last 60 days for each article, as a measure of general popularity. Cached."""
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    todo = sorted(t for t in titles if t not in cache)
    for i in range(0, len(todo), 50):
        params = {"titles": "|".join(todo[i:i + 50]), "prop": "pageviews", "pvipdays": 60}
        while True:
            data = wiki_api(params)
            for page in data.get("query", {}).get("pages", []):
                if "pageviews" in page:
                    cache[page["title"]] = sum(v or 0 for v in page["pageviews"].values())
            if "continue" not in data:
                break
            params.update(data["continue"])
        if i // 50 % 20 == 0:
            cache_path.write_text(json.dumps(cache))
            print(f"  pageviews {i + 50}/{len(todo)}", flush=True)
    cache_path.write_text(json.dumps(cache))
    return cache


def main():
    if len(sys.argv) > 2 or sys.argv[1:2] and sys.argv[1].startswith("-"):
        sys.exit(__doc__)
    work = Path(sys.argv[1] if len(sys.argv) > 1 else ".hn-cache")
    print("1/4 extracting Wikipedia mentions from every HN item")
    extract(work)
    print("2/4 parsing links and finding each comment's thread")
    con = mentions(work)
    print("3/4 resolving titles through the Wikipedia API")
    # Most titles are linked once by one person and can't pass the cut, so only resolve titles
    # whose loose spelling ("Dunning-Kruger effect" ~ "Dunning–Kruger Effect") has 2+ people.
    spellings = {}
    for title, by in con.execute('SELECT DISTINCT title, "by" FROM mentions').fetchall():
        spellings.setdefault(re.sub(r"[\W_]+", "", title.lower()), {}).setdefault(title, set()).add(by)
    raw = [t for group in spellings.values() if len(set().union(*group.values())) >= 2 for t in group]
    resolved = resolve(raw, work / "resolved.json")
    with open(work / "resolved.jsonl", "w") as f:
        for t in raw:
            if resolved[t]:
                f.write(json.dumps({"raw": t, **resolved[t]}) + "\n")
    con.execute(f"CREATE OR REPLACE TABLE resolved AS SELECT * FROM read_json('{work}/resolved.jsonl')")

    print("4/4 scoring articles")
    con.execute("""CREATE OR REPLACE TABLE scores AS
        SELECT r.title, any_value(r.disambig) AS disambig, any_value(r.stub) AS stub,
            count(DISTINCT m."by") AS users, count(DISTINCT m.story) AS threads,
            count(DISTINCT year(m.time)) AS years, min(m.time) AS first, max(m.time) AS last
        FROM mentions m JOIN resolved r ON r.raw = m.title GROUP BY r.title""")
    candidates = [title for (title,) in con.execute(f"""SELECT title FROM scores
        WHERE users >= {MIN_USERS} AND threads >= {MIN_THREADS} AND years >= {MIN_YEARS}
        AND NOT disambig AND NOT stub""").fetchall()
        if not title.startswith(LIST_PREFIXES) and title not in EXCLUDE]
    views = pageviews(candidates, work / "pageviews.json")
    users = dict(con.execute("SELECT title, users FROM scores").fetchall())
    kept = sorted(t for t in candidates
                  if users[t] >= MIN_USERS * max(1, (views.get(t, 0) / POPULAR_VIEWS) ** 0.5))
    OUT.write_text(json.dumps(kept, ensure_ascii=False, separators=(",", ":")))
    print(f"{OUT.name}: {len(kept)} articles ({len(candidates)} candidates, {len(users)} linked)")


if __name__ == "__main__":
    main()
