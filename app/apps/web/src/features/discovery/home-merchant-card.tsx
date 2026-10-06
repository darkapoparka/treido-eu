import type { ReactNode } from "react";

/** Shared shelf geometry; data and interactions stay with each Home adapter. */
export function HomeMerchantCard({
  id,
  name,
  className = "",
  header,
  children,
  footer,
}: {
  id: string;
  name: string;
  className?: string;
  header: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <section
      className={`android-merchant-card ${className}`}
      data-merchant-id={id}
      aria-label={name}
    >
      {header}
      {children}
      {footer}
    </section>
  );
}
