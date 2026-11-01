import React from "react";
import Sheet from "./Sheet";
import { FEEDS } from "../feeds";

const GROUPS = [
  { group: "type", title: "Article type", hint: "Rated best by Wikipedia's editors" },
  { group: "india", title: "India", hint: "From Wikipedia's India categories" },
  { group: "curated", title: "Hand-picked", hint: "Crawled from Wikipedia's category tree" },
  { group: "topic", title: "Broad", hint: "Live picks from all of Wikipedia" }
];

const FeedSheet = ({ current, onSelect, onClose }) => (
  <Sheet title="Topics" onClose={onClose}>
    {GROUPS.map(group => (
      <section className="feed-group" key={group.group}>
        <div className="feed-group-head">
          <h3>{group.title}</h3>
          <span>{group.hint}</span>
        </div>
        <div className="chips">
          {Object.entries(FEEDS)
            .filter(([, f]) => f.group === group.group)
            .map(([id, f]) => (
              <button
                key={id}
                className={`chip ${id === current ? "active" : ""}`}
                onClick={() => onSelect(id)}
              >
                {f.label}
              </button>
            ))}
        </div>
      </section>
    ))}
  </Sheet>
);

export default FeedSheet;
