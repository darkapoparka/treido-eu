import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MessageImageNotice } from "../../apps/web/src/features/account-closure/message-image-notice";
import { privacyCopy } from "../../apps/web/src/features/account-privacy/copy";
function Fixture() {
  const locale =
    new URLSearchParams(location.search).get("lang") === "bg" ? "bg" : "en";
  const [review, setReview] = useState(false);
  return (
    <main>
      <p id="privacy-scope">{privacyCopy[locale].scope}</p>
      <button onClick={() => setReview((value) => !value)}>
        Review fixture
      </button>
      <section aria-label="Communication review">
        <MessageImageNotice
          locale={locale}
          review={
            review
              ? {
                  version: "message-image-lifecycle-v1",
                  description: {
                    en: "Synthetic reviewed rule only",
                    bg: "Само синтетично прегледано правило",
                  },
                  handling: "remove",
                  delaySeconds: 17,
                  removedObjects: 2,
                  retainedObjects: 4,
                }
              : null
          }
        />
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
