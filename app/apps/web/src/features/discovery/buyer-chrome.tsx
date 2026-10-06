import type { ComponentProps } from "react";

// Presentation only: reference and real discovery retain their own state,
// handlers and data. These seams add no DOM wrappers or reference assets.
export function HomeShortcuts({
  className,
  ...props
}: ComponentProps<"header">) {
  return (
    <header
      {...props}
      className={"home-shortcuts" + (className ? " " + className : "")}
    />
  );
}

export function SearchComposer(props: ComponentProps<"form">) {
  return <form {...props} />;
}

export function SearchFilterStrip({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={"filter-chips" + (className ? " " + className : "")}
    />
  );
}
