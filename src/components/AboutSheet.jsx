import React from "react";
import Sheet from "./Sheet";

const AboutSheet = ({ onClose }) => (
  <Sheet title="About" onClose={onClose}>
    <div className="about">
      <p className="about-lead">
        It's for brainrotting with Wikipedia <em>(lul)</em>.
      </p>
      <p className="about-meta">
        Made by <a href="https://github.com/harsath" target="_blank" rel="noreferrer">@harsath</a> · Articles from Wikipedia, CC BY-SA
      </p>
      <p className="about-meta keys">
        <kbd>↑</kbd> <kbd>↓</kbd> or <kbd>J</kbd> <kbd>K</kbd> to scroll · <kbd>S</kbd> to save
      </p>
    </div>
  </Sheet>
);

export default AboutSheet;
