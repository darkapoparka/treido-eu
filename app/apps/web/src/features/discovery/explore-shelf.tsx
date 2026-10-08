import type { ReactNode } from "react";
import { SourceLink } from "./return-navigation";
import styles from "./explore.module.css";

/** Original Explore shelf DOM, independent of the source of its public data. */
export function ExploreShelf({
  title,
  href,
  children,
  seeAllLabel,
}: {
  title: string;
  href: string;
  children: ReactNode;
  seeAllLabel?: string;
}) {
  return (
    <section className="explore-shelf">
      <SourceLink href={href}>
        <h2>
          {seeAllLabel ? (
            <>
              <span className="buyer-shelf-title">{title}</span>
              <span className="buyer-shelf-all">
                {seeAllLabel}
                <span className={styles.shelfChevron} aria-hidden="true">
                  ›
                </span>
              </span>
            </>
          ) : (
            <>
              {title}{" "}
              <span className={styles.shelfChevron} aria-hidden="true">
                ›
              </span>
            </>
          )}
        </h2>
      </SourceLink>
      {children}
    </section>
  );
}
