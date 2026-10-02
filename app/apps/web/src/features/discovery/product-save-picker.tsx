"use client";
/* eslint-disable @next/next/no-img-element -- Preserve collection cover crops. */
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { ProductDetailProduct } from "../catalog/product-detail-model";
import type { ProductContext } from "../catalog/product-context-model";
import { Sheet } from "./components";
import { Icon } from "./icons";
import { useDiscovery } from "./state";
import { COLLECTION_NAME_MAX_LENGTH } from "./saved-model";
import type { useProductSaving } from "./use-product-saving";

export function ProductSavePicker({
  product,
  photos,
  saving,
  covers,
  status,
}: {
  product: Pick<ProductDetailProduct, "id" | "title">;
  photos: readonly string[];
  saving: ReturnType<typeof useProductSaving>;
  covers: ProductContext["covers"];
  status?: ReactNode;
}) {
  const ui = useTranslations("discoveryUI");
  const state = useDiscovery(),
    router = useRouter();
  const {
    picker,
    name,
    setName,
    toast,
    setToast,
    pickerFlow,
    creating,
    saveTo,
  } = saving;
  return (
    <>
      <Sheet
        open={picker && pickerFlow.active}
        manageHistory={false}
        title={creating ? ui("createCollection") : ui("saveToCollection")}
        headerless={!creating}
        className={`product-save-picker ${creating ? "picker-creating" : ""}`}
        onClose={() => pickerFlow.close()}
      >
        {status ??
          (creating ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return;
                saveTo(undefined, name.trim());
              }}
            >
              <input
                aria-label={ui("collectionName")}
                maxLength={COLLECTION_NAME_MAX_LENGTH}
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                data-ui-label="collectionName"
              />
              <div className="sheet-actions">
                <button
                  type="button"
                  className="pill"
                  onClick={() => pickerFlow.back()}
                >
                  {ui("back")}
                </button>
                <button className="primary" disabled={!name.trim()}>
                  {ui("createCollection")}
                </button>
              </div>
            </form>
          ) : (
            <>
              <button className="picker-row" onClick={() => saveTo()}>
                {photos[0] ? (
                  <img src={photos[0]} alt="" />
                ) : (
                  <div
                    className="picker-collection-preview"
                    aria-hidden="true"
                  />
                )}
                <span>
                  {ui("saved")} <Icon name="lock" />
                </span>
                <span className="picker-saved-icon">
                  <Icon name="heart" filled />
                </span>
              </button>
              {state.collections.map((c) => (
                <button
                  className="picker-row"
                  key={c.id}
                  onClick={() => saveTo(c.id)}
                >
                  <div className="picker-collection-preview" aria-hidden="true">
                    {c.productIds.slice(0, 4).flatMap((id) => {
                      const item = covers.find((cover) => cover.id === id);
                      return item?.image
                        ? [<img key={id} src={item.image} alt="" />]
                        : [];
                    })}
                  </div>
                  <span>
                    {c.name}{" "}
                    {c.visibility === "Private" && <Icon name="lock" />}
                  </span>
                  <Icon
                    name={c.productIds.includes(product.id) ? "check" : "plus"}
                  />
                </button>
              ))}
              <button
                className="picker-row"
                data-picker-create
                onClick={() => pickerFlow.navigate("create")}
              >
                <b aria-hidden="true">+</b>
                {ui("createCollection")}
              </button>
            </>
          ))}
      </Sheet>
      {toast && (
        <div className="product-saved-toast" role="status">
          {photos[0] && <img src={photos[0]} alt="" />}
          <span>
            <strong>{ui("itemSaved")}</strong>
            <small>{product.title}</small>
          </span>
          <button
            onClick={() => {
              setToast(false);
              router.push("/saved");
            }}
          >
            {ui("view")}
          </button>
        </div>
      )}
    </>
  );
}
