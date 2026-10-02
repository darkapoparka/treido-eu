"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { MerchantPhoto } from "./native-merchant-chrome";

export function MerchantReviewReply({
  body,
  author,
  date,
  avatar,
}: {
  body: string;
  author: string;
  date: string;
  avatar?: string;
}) {
  const ui = useTranslations("discoveryUI");
  const [expanded, setExpanded] = useState(false);
  return (
    <aside className="native-merchant-reply">
      <p data-expanded={expanded}>{body}</p>
      {body.length > 110 && (
        <button
          className="native-merchant-read-more"
          aria-label={ui("value1MerchantReply", {
            value1: expanded ? ui("collapse") : ui("expand"),
          })}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? ui("readLess") : ui("readMore")}
        </button>
      )}
      <div className="native-merchant-reply-author">
        {avatar && <MerchantPhoto src={avatar} />}
        <small>
          {author} · {date}
        </small>
      </div>
    </aside>
  );
}
