import React, { useEffect, useRef, useState } from "react";
import {
  PiArrowLeftLight, PiArrowUpRightLight, PiBookmarkSimpleFill, PiBookmarkSimpleLight, PiXLight
} from "react-icons/pi";
import { fetchArticle } from "../reader";
import { wikiUrl } from "../wiki";

// In-app article reader. Links to other articles open here too, with a back stack.
const Reader = ({ title, onClose, isBookmarked, onToggleSave }) => {
  const [stack, setStack] = useState([title]);
  const [article, setArticle] = useState(null);
  const [error, setError] = useState(false);
  const scrollRef = useRef(null);
  const current = stack[stack.length - 1];

  useEffect(() => {
    let cancelled = false;
    setArticle(null);
    setError(false);
    scrollRef.current?.scrollTo(0, 0);
    fetchArticle(current)
      .then(a => !cancelled && setArticle(a))
      .catch(err => {
        console.error("Failed to load article", err);
        if (!cancelled) setError(true);
      });
    return () => { cancelled = true; };
  }, [current]);

  const back = () => setStack(s => s.slice(0, -1));

  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose();
      if (e.key === "Backspace" && stack.length > 1 && e.target.tagName !== "INPUT") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, stack.length]);

  // Follow article links in place; let modifier-clicks open real Wikipedia.
  const onBodyClick = e => {
    const a = e.target.closest("a");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const href = a.getAttribute("href") || "";
    if (href.startsWith("#")) {
      e.preventDefault();
      scrollRef.current.querySelector(`[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`)
        ?.scrollIntoView({ behavior: "smooth" });
    } else if (a.dataset.title) {
      e.preventDefault();
      setStack(s => [...s, a.dataset.title]);
    }
  };

  const shownTitle = article?.title || current;
  const saved = isBookmarked(shownTitle);

  return (
    <div className="reader-backdrop" onClick={onClose}>
      <div className="reader glass" role="dialog" aria-modal="true" aria-label={shownTitle} onClick={e => e.stopPropagation()}>
        <header className="reader-bar">
          {stack.length > 1 ? (
            <button className="icon-btn" onClick={back} aria-label="Back"><PiArrowLeftLight /></button>
          ) : <span className="reader-bar-spacer" />}
          <span className="reader-bar-title">{shownTitle}</span>
          <div className="reader-bar-actions">
            <button
              className={`icon-btn ${saved ? "on" : ""}`}
              onClick={() => article && onToggleSave(article)}
              disabled={!article}
              aria-label={saved ? "Remove from saved" : "Save"}
              aria-pressed={saved}
            >
              {saved ? <PiBookmarkSimpleFill /> : <PiBookmarkSimpleLight />}
            </button>
            <a className="icon-btn" href={wikiUrl(shownTitle)} target="_blank" rel="noopener noreferrer" aria-label="Open on Wikipedia">
              <PiArrowUpRightLight />
            </a>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><PiXLight /></button>
          </div>
        </header>

        <div className="reader-scroll" ref={scrollRef}>
          {error && (
            <div className="reader-state">
              <p>Couldn't load this article.</p>
              <a className="pill glass" href={wikiUrl(current)} target="_blank" rel="noopener noreferrer">
                Open on Wikipedia <PiArrowUpRightLight />
              </a>
            </div>
          )}
          {!error && !article && (
            <div className="reader-inner skeleton reader-skeleton">
              <span /><span /><span /><span /><span /><span />
            </div>
          )}
          {article && (
            <article className="reader-inner">
              {article.image && (
                <img className="reader-hero" src={article.image} alt="" onLoad={e => e.currentTarget.classList.add("loaded")} />
              )}
              <h1 className="reader-title">{article.title}</h1>
              {article.description && <p className="reader-desc">{article.description}</p>}
              <div className="article" onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: article.html }} />
              <p className="reader-source">
                From <a href={wikiUrl(article.title)} target="_blank" rel="noopener noreferrer">Wikipedia</a>, CC BY-SA
              </p>
            </article>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reader;
