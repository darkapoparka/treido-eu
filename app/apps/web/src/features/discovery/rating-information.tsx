"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Sheet } from "./components";
import { Icon } from "./icons";

export function RatingInformation() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="rating-information"
        aria-label="About ratings"
        onClick={() => setOpen(true)}
      >
        <Icon name="info" />
      </button>
      {open &&
        createPortal(
          <Sheet open title="About ratings" onClose={() => setOpen(false)}>
            <p className="sheet-copy">
              Ratings summarize the scores shoppers gave this product or store.
              Individual reviews may include written feedback. This preview
              shows the captured rating totals and available review sample.
            </p>
          </Sheet>,
          document.body,
        )}
    </>
  );
}
