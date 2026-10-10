const tags = new Set([
  "p",
  "div",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "span",
  "font",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
]);

export function safeDescriptionColor(value: string) {
  const hex = /^#([a-f0-9]{6})$/i.exec(value.trim());
  if (hex) return `#${hex[1].toLowerCase()}`;
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(
    value.trim(),
  );
  return rgb && rgb.slice(1).every((channel) => Number(channel) <= 255)
    ? `#${rgb
        .slice(1)
        .map((channel) => Number(channel).toString(16).padStart(2, "0"))
        .join("")}`
    : null;
}

export function plainTextHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "<br>");
}

/** A finite, device-local description format. Never render arbitrary saved HTML. */
export function sanitizeDescriptionHtml(value: string) {
  return (
    value.slice(0, 20000).match(/<!--[^]*?-->|<[^<>]*>|[^<>]+|[<>]/g) ?? []
  )
    .map((token) => {
      if (!token.startsWith("<")) return token.replaceAll(">", "&gt;");
      const match = /^<(\/?)([a-z0-9]+)([^<>]*)>$/i.exec(token);
      if (!match || !tags.has(match[2].toLowerCase()))
        return token === "<" ? "&lt;" : "";
      const name = match[2].toLowerCase();
      if (match[1]) return name === "br" ? "" : `</${name}>`;
      if (name === "a") {
        const href = /\bhref\s*=\s*["']([^"']*)["']/i.exec(match[3])?.[1];
        if (!href || !/^https?:\/\/[^\s<>"']+$/i.test(href)) return "<a>";
        return `<a href="${href.replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g, "&amp;")}" rel="noopener noreferrer">`;
      }
      const allowedStyles: string[] = [];
      const style = /\bstyle\s*=\s*["']([^"']*)["']/i.exec(match[3])?.[1] ?? "";
      for (const declaration of style.split(";")) {
        const [property, raw] = declaration
          .split(":")
          .map((part) => part.trim().toLowerCase());
        if (
          property === "text-align" &&
          ["left", "center", "right"].includes(raw) &&
          ["p", "div", "td", "th"].includes(name)
        )
          allowedStyles.push(`text-align:${raw}`);
        if (
          ["color", "background-color"].includes(property) &&
          ["span", "font"].includes(name)
        ) {
          const color = safeDescriptionColor(raw ?? "");
          if (color) allowedStyles.push(`${property}:${color}`);
        }
      }
      if (name === "font") {
        const color = safeDescriptionColor(
          /\bcolor\s*=\s*["']([^"']*)["']/i.exec(match[3])?.[1] ?? "",
        );
        if (color && !allowedStyles.some((style) => style.startsWith("color:")))
          allowedStyles.push(`color:${color}`);
      }
      return `<${name}${allowedStyles.length ? ` style="${allowedStyles.join(";")}"` : ""}>`;
    })
    .join("");
}
