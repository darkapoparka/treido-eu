import type { Product } from "../catalog/types";

/** Structured native merchant copy; preview text remains readable without links. */
export function ProductDescriptionContent({
  product,
  preview = false,
  onExternal,
}: {
  product: Product;
  preview?: boolean;
  onExternal?: () => void;
}) {
  const link = product.detail?.descriptionLink;
  const index = link ? product.description.indexOf(link.label) : -1;
  return (
    <div
      className={
        preview ? "native-description-preview" : "native-description-content"
      }
    >
      <p>
        {!preview && link && index >= 0 ? (
          <>
            {product.description.slice(0, index)}
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              onClick={onExternal}
            >
              {link.label}
            </a>
            {product.description.slice(index + link.label.length)}
          </>
        ) : (
          product.description
        )}
      </p>
      {product.detail?.descriptionSpecs && (
        <ul>
          {product.detail.descriptionSpecs.map((spec) => (
            <li key={spec}>{spec}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
