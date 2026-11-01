import React, { useEffect } from "react";
import { PiXLight } from "react-icons/pi";

// Glass panel: bottom sheet on phones, centered dialog on desktop.
const Sheet = ({ title, onClose, children }) => {
  useEffect(() => {
    const onKey = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet glass"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <header className="sheet-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <PiXLight />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
};

export default Sheet;
