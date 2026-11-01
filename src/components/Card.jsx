import React, { forwardRef, useState } from "react";
import { PiArrowUpRightLight, PiBookmarkSimpleFill, PiBookmarkSimpleLight, PiExportLight } from "react-icons/pi";
import { wikiUrl } from "../wiki";

const Card = forwardRef(({ card, index, kicker, saved, onToggleSave, onShare }, ref) => {
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
          <a className="read-link" href={wikiUrl(card.title)} target="_blank" rel="noopener noreferrer">
            Read on Wikipedia <PiArrowUpRightLight />
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
