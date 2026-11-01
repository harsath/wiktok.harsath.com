import React, { forwardRef, useState } from "react";
import { PiArrowRightLight, PiBookmarkSimpleFill, PiBookmarkSimpleLight, PiExportLight } from "react-icons/pi";
import { wikiUrl } from "../wiki";

const Card = forwardRef(({ card, index, kicker, saved, onToggleSave, onShare, onRead }, ref) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <article className={`card ${card.image ? "" : "no-image"}`} ref={ref} data-index={index}>
      {card.image ? (
        <>
          <img className="card-ambient" src={card.image} alt="" aria-hidden="true" />
          <img
            className={`card-image ${loaded ? "loaded" : ""}`}
            src={card.image}
            alt=""
            onLoad={() => setLoaded(true)}
            loading={index < 2 ? "eager" : "lazy"}
          />
        </>
      ) : (
        <div className="card-mono" aria-hidden="true">{card.title[0]}</div>
      )}
      <div className="card-scrim" />

      <div className="card-panel glass">
        <div className="card-kicker">{kicker}</div>
        <h1>{card.title}</h1>
        {card.desc && <p>{card.desc}</p>}
        <div className="card-foot">
          <a
            className="read-link"
            href={wikiUrl(card.title)}
            onClick={e => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return; // still opens Wikipedia in a new tab
              e.preventDefault();
              onRead();
            }}
          >
            Read article <PiArrowRightLight />
          </a>
          <div className="card-actions">
            <button
              className={`icon-btn ${saved ? "on" : ""}`}
              onClick={onToggleSave}
              aria-label={saved ? "Remove from saved" : "Save"}
              aria-pressed={saved}
            >
              {saved ? <PiBookmarkSimpleFill /> : <PiBookmarkSimpleLight />}
            </button>
            <button className="icon-btn" onClick={onShare} aria-label="Share">
              <PiExportLight />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
});

export default Card;
