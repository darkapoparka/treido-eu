"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Sheet } from "./components";
import { Icon } from "./icons";

export function RatingInformation() {
  const ui = useTranslations("discoveryUI");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="rating-information"
        aria-label={ui("aboutRatings")}
        onClick={() => setOpen(true)}
        data-ui-label="aboutRatings"
      >
        <Icon name="info" />
      </button>
      {open &&
        createPortal(
          <Sheet open title={ui("aboutRatings")} onClose={() => setOpen(false)}>
            <p className="sheet-copy">
              {ui("ratingsSummarizeTheScoresShoppersGaveThisProductOrStore")}
            </p>
          </Sheet>,
          document.body,
        )}
    </>
  );
}
