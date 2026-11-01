import React, { useState } from "react";
import Sheet from "./Sheet";
import { PiMagnifyingGlassLight, PiTrashLight } from "react-icons/pi";
import { wikiUrl } from "../wiki";

const BookmarksSheet = ({ bookmarks, removeBookmark, onClose }) => {
  const [search, setSearch] = useState("");

  const filtered = bookmarks.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Sheet title="Saved" onClose={onClose}>
      {bookmarks.length > 0 && (
        <label className="search">
          <PiMagnifyingGlassLight />
          <input
            type="text"
            placeholder="Search saved articles"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
      )}

      <div className="saved-list">
        {bookmarks.length === 0 && (
          <p className="empty">Nothing saved yet. Tap the bookmark on any article to keep it here.</p>
        )}
        {bookmarks.length > 0 && filtered.length === 0 && <p className="empty">No matches.</p>}
        {filtered.map(b => (
          <div className="saved-item" key={b.title}>
            <a className="saved-link" href={wikiUrl(b.title)} target="_blank" rel="noopener noreferrer">
              {b.image
                ? <img src={b.image} alt="" className="saved-thumb" loading="lazy" />
                : <div className="saved-thumb placeholder">{b.title[0]}</div>}
              <div className="saved-info">
                <div className="saved-title">{b.title}</div>
                <div className="saved-desc">{b.desc}</div>
              </div>
            </a>
            <button className="icon-btn subtle" onClick={() => removeBookmark(b.title)} aria-label={`Remove ${b.title}`}>
              <PiTrashLight />
            </button>
          </div>
        ))}
      </div>
    </Sheet>
  );
};

export default BookmarksSheet;
