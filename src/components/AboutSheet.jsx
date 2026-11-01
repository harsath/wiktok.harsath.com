import React from "react";
import Sheet from "./Sheet";

const AboutSheet = ({ onClose }) => (
  <Sheet title="About" onClose={onClose}>
    <div className="about">
      <p className="about-lead">Doomscroll Wikipedia.</p>
      <p className="about-byline">
        Made with ❤️ by <a href="https://harsath.com" target="_blank" rel="noreferrer">@harsath</a>
        <br />
        Read code on{" "}
        <a href="https://github.com/harsath/wiktok.harsath.com" target="_blank" rel="noreferrer">GitHub</a>
      </p>
      <p className="about-meta keys">
        <kbd>↑</kbd> <kbd>↓</kbd> or <kbd>J</kbd> <kbd>K</kbd> to scroll · <kbd>S</kbd> to save
      </p>
      <p className="about-meta about-footer">Articles from Wikipedia, CC BY-SA</p>
    </div>
  </Sheet>
);

export default AboutSheet;
