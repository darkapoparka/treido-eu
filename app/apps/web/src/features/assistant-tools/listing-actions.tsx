"use client";
import { useEffect, useRef, useState, startTransition } from "react";
import { SourceLink } from "../discovery/return-navigation";
import { ListingCollectionButton } from "../library/controls";
import { StartConversation } from "../messaging/start-conversation";
import { CartMutationButton } from "../buyer-cart/mutation-button";
import { variantCaption } from "../inventory/model";
import type { ToolListing } from "../shopping-tools/model";
import { money } from "../shopping-tools/copy";
import { readAssistantListingAction } from "./actions";
import { assistantCopy } from "./copy";
import { useAssistantLocale } from "./common-ui";
import s from "./assistant-tools.module.css";
/** Existing commands own saves/contact/cart. A compatibility result cannot
 * grant downstream authority; read current facts before offering the handoff. */
export function AssistantListingActions({
  listingId,
  subject,
}: {
  listingId: string;
  subject: string;
}) {
  const locale = useAssistantLocale(),
    t = assistantCopy[locale],
    life = useRef({ alive: false, ticket: 0 }),
    [item, setItem] = useState<ToolListing | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    const current = life.current;
    current.alive = true;
    return () => {
      current.alive = false;
      ++current.ticket;
    };
  }, []);
  async function review() {
    const ticket = ++life.current.ticket;
    setBusy(true);
    setItem(null);
    setError(false);
    try {
      const result = await readAssistantListingAction(listingId);
      if (!life.current.alive || ticket !== life.current.ticket) return;
      if (result.ok && result.data.subject === subject)
        setItem(result.data.value);
      else setError(true);
    } catch {
      if (life.current.alive) setError(true);
    } finally {
      if (life.current.alive) setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className={s.button}
        disabled={busy}
        onClick={() =>
          startTransition(() => {
            void review();
          })
        }
      >
        {t.actions}
      </button>
      {error && <p role="alert">{t.NOT_FOUND}</p>}
      {item && (
        <div className={s.feedback}>
          <p>
            {item.card.title} · {money(item.card.price.amount, locale)}
          </p>
          <p>{item.variant ? variantCaption(item.variant.options) : t.noSku}</p>
          <nav className={s.actions}>
            <SourceLink
              preserveDiscoveryContext={false}
              href={"/products/" + listingId + "?lang=" + locale}
            >
              {t.details}
            </SourceLink>
            <SourceLink
              preserveDiscoveryContext={false}
              href={"/stores/" + item.card.seller.id + "?lang=" + locale}
            >
              {t.store}
            </SourceLink>
            <SourceLink
              preserveDiscoveryContext={false}
              href={"/cart?lang=" + locale}
            >
              {t.cart}
            </SourceLink>
          </nav>
          <StartConversation listingId={listingId} />
          {item.variant && item.inventory.state === "available" && (
            <CartMutationButton
              className={s.button}
              label={t.addCart}
              operation={{
                kind: "add",
                listingId,
                skuId: item.variant.id,
                publicationRevision: item.revision,
                quantity: 1,
              }}
            />
          )}
          <ListingCollectionButton id={listingId} />
        </div>
      )}
    </div>
  );
}
