const paths = {
  code: "M5 2h14a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm5 6-4 4 4 4m4-8 4 4-4 4",
  logout: "M9 3H4v18h5m5-15 6 6-6 6m-7-6h13",
  bolt: "m14 2-10 12h7l-1 8 10-12h-7Z",
  cloud: "M6 18a5 5 0 0 1 0-10 6 6 0 0 1 11-2 5 5 0 1 1 1 12Z",
  passkey:
    "M8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM1 22v-3a7 7 0 0 1 10-6m7-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 6v6m0-2h3",
  clipboard: "M8 4H4v18h16V4h-4M8 2h8v5H8Z",
  instagram:
    "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm6-2h.01",
  twitter:
    "M22 4a9 9 0 0 1-3 1 4 4 0 0 0-7 3v1A11 11 0 0 1 3 4s-4 9 5 13a12 12 0 0 1-7 2c9 5 20-1 19-13Z",
  help: "M12 3a8 8 0 0 0-8 8v6l-2 4 5-2a8 8 0 1 0 5-16Zm-2 5a2 2 0 1 1 3 2c-1 1-1 1-1 3m0 3h.01",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 7v7m0-10h.01",
  location:
    "M12 22S4 14 4 9a8 8 0 1 1 16 0c0 5-8 13-8 13Zm0-16a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  shield: "M12 2 3 6v7c0 5 9 9 9 9s9-4 9-9V6ZM8 12l3 3 5-6",
  link: "m10 7 3-3a5 5 0 0 1 7 7l-3 3M14 17l-3 3a5 5 0 0 1-7-7l3-3M8 16l8-8",
  "truck-check":
    "M9 17V6a2 2 0 0 1 2-2h9a1 1 0 0 1 1 1v12h-1M9 8H6l-3 4v5h1m5 0h6M3 12h6m-1 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm11 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM12 10l2 2 4-4",
  unlink:
    "m14 5 1-1a4.2 4.2 0 0 1 6 6l-3 3M10 19l-1 1a4.2 4.2 0 0 1-6-6l3-3M6 3l1 2M2 7l2 1M11 2v2M18 21l-1-2m5-2-2-1m-7 6v-2",
  lock: "M5 10h14v12H5ZM8 10V6a4 4 0 0 1 8 0v4",
  bell: "M5 17h14l-2-4V9A5 5 0 0 0 7 9v4ZM10 21h4",
  person: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 22v-3a8 8 0 0 1 16 0v3",
  "person-question":
    "M9 3a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM11 20H3v-2a6 6 0 0 1 10-4.5m2-1a2.5 2.5 0 1 1 4 2c-1.5.8-2 1.5-2 3m0 3h.01",
  "support-chat":
    "M12 3c5.5 0 10 3.6 10 8s-4.5 8-10 8c-1.6 0-3.2-.3-4.5-.9L3 20l1.1-4.2A7.1 7.1 0 0 1 2 11c0-4.4 4.5-8 10-8Zm-2.4 5a2.5 2.5 0 1 1 4 2c-1.1.7-1.6 1.2-1.6 2.5m0 3h.01",
  document: "M5 2h10l4 4v16H5ZM14 2v5h5M8 12h8M8 16h8",
  receipt: "M5 3h14v19l-3-2-4 2-4-2-3 2ZM9 8h6M9 12h6",
  "document-check": "M5 2h9l5 5v15H5ZM14 2v6h5M8 15l3 3 5-6",
} as const;
const solidPaths: Partial<Record<keyof typeof paths, string>> = {
  code: "M5 2h14a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm4 5-4 5 4 5 1.5-1.2L7.5 12l3-3.8Zm6 0-1.5 1.2 3 3.8-3 3.8L15 17l4-5Z",
  receipt:
    "M6 2h12a1 1 0 0 1 1 1v19l-3-2-4 2-4-2-3 2V3a1 1 0 0 1 1-1Zm3 6v2h6V8Zm0 5v2h6v-2Z",
  location:
    "M12 23S3 15 3 9a9 9 0 1 1 18 0c0 6-9 14-9 14Zm0-17a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  shield:
    "M12 1 2 5v8c0 6 10 10 10 10s10-4 10-10V5Zm-5 11 3 3 7-7 1 2-8 8-5-4Z",
  bell: "M3 17c2-3 2-5 2-8a7 7 0 0 1 14 0c0 3 0 5 2 8 0 3-18 3-18 0Zm6 4a3 3 0 0 0 6 0Z",
  lock: "M4 10h2V6a6 6 0 0 1 12 0v4h2v13H4Zm5 0h6V6a3 3 0 0 0-6 0Zm2 5v4h2v-4Z",
  help: "M12 1a11 10 0 0 0-11 10c0 3 1 5 3 7l-2 5 7-2a11 10 0 1 0 3-20Zm-4 7h2c0-3 5-3 5 0 0 2-4 2-4 6h2c0-2 4-3 4-6 0-6-9-6-9 0Zm3 8v3h2v-3Z",
};
export function AccountIcon({
  name,
  filled = false,
}: {
  name: keyof typeof paths;
  filled?: boolean;
}) {
  const solid = filled ? solidPaths[name] : undefined;
  return (
    <svg
      className="account-icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill={solid ? "currentColor" : "none"}
      fillRule="evenodd"
      stroke={solid ? "none" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={solid || paths[name]} />
    </svg>
  );
}
