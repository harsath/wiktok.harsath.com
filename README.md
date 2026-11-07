# wiktok.harsath.com
TikTok-style app for exploring Wikipedia articles with infinite scrolling, bookmarking, and topic-based feeds.

## How feeds work
- **Hacker News** (`data/hackernews.json`): the Wikipedia articles HN keeps linking to. `scripts/build_hackernews.py`
  scans every HN comment and story since 2006 for Wikipedia links, follows redirects to the real article, and
  keeps articles linked by at least 8 different people, in 3+ threads, across 2+ years. Articles that are
  popular everywhere ("Hong Kong") need more HN links to count, so the feed leans to what HN is uniquely into.
  HN data comes from the [open-index/hacker-news](https://huggingface.co/datasets/open-index/hacker-news) mirror (ODC-By).
- **Article type** (default: Featured articles): live random picks from articles Wikipedia's editors
  rated [Featured](https://en.wikipedia.org/wiki/Wikipedia:Featured_articles) (~7k) or
  [Good](https://en.wikipedia.org/wiki/Wikipedia:Good_articles) (~45k), across every subject.
- **India** (`data/india-*.json`): history, cricket, politics, economy and culture, crawled from
  hand-picked Wikipedia categories by `scripts/crawl_categories.py` (stubs dropped).
- **Hand-picked** (`data/*.json`): article titles hand-crawled from Wikipedia's category graph with
  [Wiki-Indexer](https://github.com/harsath/Wiki-Indexer). The client shuffles a category's list once
  and walks through it, so nothing repeats until the whole category has been seen.
- **Broad**: live random picks from Wikipedia search using its ML topic labels
  (`articletopic:<topic>` with `srsort=random`), filtering out stubs, biographies, lists and disambiguation pages.

Summaries and images come from the Wikipedia API in both cases. Bookmarks are stored in `localStorage`.
Feeds are defined in `src/feeds.js`.

## Updating static feeds
```bash
python3 scripts/export_data.py path/to/wiki_cats.db     # hand-picked feeds, from a Wiki-Indexer DB
python3 scripts/crawl_categories.py [india-history ...]  # India feeds, via the Wikipedia API (~10 min for all)
uv run scripts/build_hackernews.py                      # Hacker News feed (~12 GB download, ~2 h; cached in .hn-cache)
```
Seed categories, depths and exclusions live at the top of `crawl_categories.py`.
Run one crawl at a time: parallel crawls get rate-limited (HTTP 429).

## Development
```bash
npm install
npm start        # http://localhost:1234
npm run build    # outputs dist/
npm run clean    # if the dev server shows "Failed to resolve module specifier", then npm start again
```
