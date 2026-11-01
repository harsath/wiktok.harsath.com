import React, { useCallback, useEffect, useRef, useState } from "react";
import { PiBookmarksSimpleLight, PiCaretDownLight, PiArrowClockwiseLight, PiInfoLight } from "react-icons/pi";
import { fetchArticles } from "./api";
import { FEEDS, DEFAULT_FEED } from "./feeds";
import { wikiUrl } from "./wiki";
import useBookmarks from "./hooks/useBookmarks";
import Card from "./components/Card";
import FeedSheet from "./components/FeedSheet";
import BookmarksSheet from "./components/BookmarksSheet";
import AboutSheet from "./components/AboutSheet";
import Reader from "./components/Reader";
import "./styles.css";

const FEED_KEY = "wiktokFeed";
const PREFETCH_AHEAD = 4; // load the next batch when this many cards remain

const readFeed = () => {
  try {
    const id = localStorage.getItem(FEED_KEY);
    return FEEDS[id] ? id : DEFAULT_FEED;
  } catch {
    return DEFAULT_FEED;
  }
};

const App = () => {
  const [feed, setFeed] = useState(readFeed);
  const [cards, setCards] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [active, setActive] = useState(0);
  const [sheet, setSheet] = useState(null); // feeds | saved | about
  const [toast, setToast] = useState(null);
  const [reading, setReading] = useState(null); // article title open in the reader

  const containerRef = useRef(null);
  const cardRefs = useRef([]);
  const fetching = useRef(false);
  const feedRef = useRef(feed);

  const { bookmarks, toggleBookmark, isBookmarked, removeBookmark } = useBookmarks();

  const loadMore = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    const forFeed = feedRef.current;
    try {
      const batch = await fetchArticles(forFeed);
      if (forFeed !== feedRef.current) return; // feed changed mid-flight
      setCards(prev => {
        const seen = new Set(prev.map(c => c.title));
        return [...prev, ...batch.filter(c => !seen.has(c.title))];
      });
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load articles", err);
      if (forFeed === feedRef.current) setStatus(s => (s === "loading" ? "error" : s));
    } finally {
      fetching.current = false;
    }
  }, []);

  // Reset and load whenever the feed changes.
  useEffect(() => {
    feedRef.current = feed;
    try { localStorage.setItem(FEED_KEY, feed); } catch {}
    fetching.current = false;
    setCards([]);
    setActive(0);
    setStatus("loading");
    containerRef.current?.scrollTo(0, 0);
    loadMore();
  }, [feed, loadMore]);

  // Track which card is on screen.
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && setActive(Number(e.target.dataset.index))),
      { root: containerRef.current, threshold: 0.6 }
    );
    cardRefs.current.slice(0, cards.length).forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
  }, [cards.length]);

  useEffect(() => {
    if (status === "ready" && active >= cards.length - PREFETCH_AHEAD) loadMore();
  }, [active, cards.length, status, loadMore]);

  const showToast = msg => {
    setToast(msg);
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => setToast(null), 1800);
  };

  const handleShare = async card => {
    const url = wikiUrl(card.title);
    if (navigator.share) {
      navigator.share({ title: card.title, url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch {
      showToast("Couldn't copy link");
    }
  };

  const handleSave = card => {
    showToast(isBookmarked(card.title) ? "Removed from saved" : "Saved");
    toggleBookmark(card);
  };

  const goTo = i => {
    const el = cardRefs.current[i];
    if (el) containerRef.current.scrollTo({ top: el.offsetTop, behavior: "smooth" });
  };

  // Keyboard navigation for desktop.
  useEffect(() => {
    const onKey = e => {
      if (sheet || reading || e.metaKey || e.ctrlKey || e.altKey || e.target.tagName === "INPUT") return;
      if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); goTo(active + 1); }
      if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); goTo(active - 1); }
      if (e.key === "s" && cards[active]) handleSave(cards[active]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const selectFeed = id => {
    setSheet(null);
    if (id !== feed) setFeed(id);
  };

  return (
    <>
      <header className="top-bar">
        <span className="wordmark">wiktok<span className="wordmark-domain">.harsath.com</span></span>
        <div className="top-actions">
          <button className="pill glass" onClick={() => setSheet("feeds")}>
            <span className="pill-label">{FEEDS[feed].label}</span> <PiCaretDownLight />
          </button>
          <button className="icon-btn glass" onClick={() => setSheet("saved")} aria-label="Saved articles">
            <PiBookmarksSimpleLight />
            {bookmarks.length > 0 && <span className="badge">{bookmarks.length}</span>}
          </button>
          <button className="icon-btn glass" onClick={() => setSheet("about")} aria-label="About">
            <PiInfoLight />
          </button>
        </div>
      </header>

      <main className="feed" ref={containerRef}>
        {status === "loading" && (
          <div className="card state">
            <div className="card-panel glass skeleton">
              <span /><span /><span /><span />
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="card state">
            <div className="state-msg">
              <p>Couldn't reach Wikipedia.</p>
              <button className="pill glass" onClick={() => { setStatus("loading"); loadMore(); }}>
                <PiArrowClockwiseLight /> Try again
              </button>
            </div>
          </div>
        )}
        {cards.map((card, i) => (
          <Card
            key={card.title}
            ref={el => (cardRefs.current[i] = el)}
            card={card}
            index={i}
            kicker={FEEDS[feed].label}
            saved={isBookmarked(card.title)}
            onToggleSave={() => handleSave(card)}
            onShare={() => handleShare(card)}
            onRead={() => setReading(card.title)}
          />
        ))}
      </main>

      {toast && <div className="toast glass" role="status">{toast}</div>}

      {sheet === "feeds" && (
        <FeedSheet
          current={feed}
          onSelect={selectFeed}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "saved" && (
        <BookmarksSheet
          bookmarks={bookmarks}
          removeBookmark={removeBookmark}
          onRead={title => { setSheet(null); setReading(title); }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "about" && <AboutSheet onClose={() => setSheet(null)} />}
      {reading && (
        <Reader
          key={reading}
          title={reading}
          onClose={() => setReading(null)}
          isBookmarked={isBookmarked}
          onToggleSave={handleSave}
        />
      )}
    </>
  );
};

export default App;
