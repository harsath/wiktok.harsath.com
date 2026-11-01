"""Crawl Wikipedia categories through the public API into data/<feed>.json.

Same idea as Wiki-Indexer, but over the live API instead of a dump: walk each seed
category's subcategories to a set depth, skip subcategories matching an exclude
pattern, then drop stubs (every stub template transcludes Template:Asbox).

Usage: python3 scripts/crawl_categories.py [feed ...]   (default: all feeds)
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "wiktok.harsath.com category crawler (https://github.com/harsath)"
OUT_DIR = Path(__file__).resolve().parent.parent / "data"

# Subcategories we never want to descend into.
COMMON_EXCLUDE = [
    r"stubs$", r"lists?\b", r"\bby (year|decade|century|city|district|state|location)\b",
    r"^\d{3,4}s? ", r"\b\d{3,4}s?$", r"[Ee]stablishments", r"[Dd]isestablishments",
    r"\bimages\b", r"\btemplates\b", r"Wikipedia",
    r"[Ff]ilms?\b", r"[Tt]elevision", r"[Ss]ongs", r"[Nn]ovels", r"[Bb]ooks", r"[Ss]hips",
    r"[Mm]useums?", r"[Cc]ollections",
]

# Media pages often sit directly in topic categories ("Article 370 (film)" under politics).
TITLE_EXCLUDE = re.compile(
    r"\((\d{4} )?(\w+ )?(film|TV series|web series|novel|book|album|song|ship|play|soundtrack)\)$"
)

# feed id -> seed categories as (name, depth) plus extra subcategory excludes.
FEEDS = {
    "india-history": {
        "seeds": [
            ("History of India by period", 3), ("Former monarchies of India", 1),
            ("Archaeology of India", 1), ("Historic sites in India", 1),
            ("Political history of India", 1), ("Cultural history of India", 1),
            ("Economic history of India", 1),
        ],
        # The by-period tree runs into present-day India; keep sport and policy out of it.
        "exclude": [r"people", r"\bpersons\b", r"politicians", r"rulers", r"monarchs", r"births", r"deaths",
                    r"[Cc]ricket", r"[Ss]port", r"[Tt]rophy", r"[Ss]chemes", r"[Gg]overnment programmes",
                    r"[Ll]egislation", r"[Aa]cts of", r"[Ss]cams", r"[Ee]lections"],
    },
    "india-cricket": {
        "seeds": [
            ("India Test cricketers", 0), ("India One Day International cricketers", 0),
            ("India women Test cricketers", 0), ("History of Indian cricket", 1),
            ("Indian Premier League", 1), ("Cricket grounds in India", 0),
            ("Cricket competitions in India", 1), ("Cricket administration in India", 1),
        ],
        "exclude": [r"seasons?$", r"squads", r"players", r"umpires", r"ground", r"teams in India$"],
    },
    "india-politics": {
        "seeds": [
            ("Prime ministers of India", 0), ("Presidents of India", 0),
            ("Political parties in India", 1), ("Political history of India", 1),
            ("Political movements in India", 1), ("Constitution of India", 1),
            ("Political corruption in India", 1), ("Foreign relations of India", 1),
            ("Human rights in India", 1), ("General elections in India", 0),
            ("Political terminology in India", 0),
        ],
        "exclude": [r"constituenc", r"[Mm]embers", r"MLAs", r"Legislative", r"politicians",
                    r"people", r"office holders", r"elections in", r"councillors", r"diplomats",
                    r"ambassadors", r"[Hh]igh [Cc]ommissioners"],
    },
    "india-economy": {
        "seeds": [
            ("Economy of India", 0), ("Economic history of India", 1),
            ("Economic planning in India", 1), ("Finance in India", 1),
            ("Taxation in India", 1), ("Poverty in India", 1), ("Industries of India", 1),
            ("Foreign trade of India", 1), ("Energy in India", 1), ("Currencies of India", 1),
            ("Indian economists", 0), ("Conglomerate companies of India", 0),
        ],
        "exclude": [r"people", r"bankers", r"executives", r"businesspeople", r"power stations",
                    r"companies based in", r"banks of", r"[Mm]ines", r"dams",
                    r"[Ii]nstruments", r"[Hh]andicrafts", r"East India Company"],
    },
    "india-culture": {
        "seeds": [
            ("Indian cuisine", 2), ("Indian clothing", 1), ("Festivals of Indian culture", 1),
            ("Cultural festivals in India", 1), ("Indian martial arts", 1),
            ("Indian folk culture", 1), ("Indian classical music", 1), ("Dances of India", 1),
            ("Indian art", 1), ("Indian traditions", 1), ("Cultural heritage of India", 1),
            ("National symbols of India", 1), ("Yoga", 1), ("Indian philosophy", 1),
            ("Elephants in Indian culture", 0), ("Indian games", 1),
        ],
        "exclude": [r"people", r"musicians", r"dancers", r"artists", r"painters", r"writers",
                    r"singers", r"chefs", r"films?\b", r"television", r"songs", r"albums",
                    r"restaurants", r"companies", r"brands", r"philosophers", r"gurus",
                    r"practitioners", r"teachers", r"scholars", r"academics", r"composers",
                    r"organi[sz]ations", r"awards"],
    },
}


def api(params):
    params = {"action": "query", "format": "json", "formatversion": 2, **params}
    url = f"{API}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                return json.load(res)
        except Exception as err:
            if attempt == 5:
                raise
            # Back off as asked on 429 (rate limited); otherwise retry with exponential delay.
            retry_after = getattr(err, "headers", None) and err.headers.get("Retry-After")
            time.sleep(int(retry_after) if retry_after and retry_after.isdigit() else 2 ** attempt)


def members(category):
    """Yield (namespace, title) for every page and subcategory in a category."""
    params = {"list": "categorymembers", "cmtitle": f"Category:{category}",
              "cmtype": "page|subcat", "cmnamespace": "0|14", "cmlimit": "max"}
    while True:
        data = api(params)
        for m in data["query"]["categorymembers"]:
            yield m["ns"], m["title"]
        if "continue" not in data:
            return
        params.update(data["continue"])


def crawl(category, depth, exclude, visited, titles):
    if category in visited:
        return
    visited.add(category)
    found = False
    for ns, title in members(category):
        found = True
        if ns == 0:
            if not title.startswith("List of") and not TITLE_EXCLUDE.search(title):
                titles.add(title)
        elif depth > 0:
            sub = title.removeprefix("Category:")
            if not any(re.search(p, sub) for p in exclude):
                crawl(sub, depth - 1, exclude, visited, titles)
    return found


def stubs(titles):
    """Return the subset of titles that are stubs."""
    titles, found = sorted(titles), set()
    for i in range(0, len(titles), 50):
        params = {"prop": "templates", "tltemplates": "Template:Asbox", "tllimit": "max",
                  "titles": "|".join(titles[i:i + 50])}
        while True:
            data = api(params)
            for page in data["query"]["pages"]:
                if page.get("templates"):
                    found.add(page["title"])
            if "continue" not in data:
                break
            params.update(data["continue"])
    return found


def main():
    selected = sys.argv[1:] or list(FEEDS)
    OUT_DIR.mkdir(exist_ok=True)
    for feed in selected:
        config = FEEDS[feed]
        exclude = COMMON_EXCLUDE + config["exclude"]
        visited, titles = set(), set()
        for category, depth in config["seeds"]:
            if crawl(category, depth, exclude, visited, titles) is False:
                print(f"  warning: Category:{category} is empty or missing")
        stub_titles = stubs(titles)
        kept = sorted(titles - stub_titles)
        (OUT_DIR / f"{feed}.json").write_text(json.dumps(kept, ensure_ascii=False, separators=(",", ":")))
        print(f"{feed}: {len(kept)} articles ({len(stub_titles)} stubs dropped, {len(visited)} categories)")


if __name__ == "__main__":
    main()
