import "server-only";
import { connection } from "next/server";
import { backendConfigured } from "../sellers/backend-status.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { pageLocale } from "../locale/page-locale.server";
import { ToolUnavailable } from "../shopping-tools/tool-ui";
import { inputCopy } from "../assistant-runs/copy";
import { parseAssistantInputContinuation } from "./continuation";
import { InputScreen } from "./screen";
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
async function InputPage(
  { searchParams }: Props,
  inputMode: "photo" | "voice",
) {
  await connection();
  const source = await searchParams,
    locale = await pageLocale(source.lang),
    params = new URLSearchParams();
  for (const [key, value] of Object.entries(source))
    for (const item of Array.isArray(value) ? value : [value])
      if (item !== undefined) params.append(key, item);
  if (!params.has("lang")) params.set("lang", locale);
  const path =
      inputMode === "photo" ? "/minis/photo-match" : "/minis/find-for-me/voice",
    continuation = parseAssistantInputContinuation(path + "?" + params);
  if (!continuation || referencePreviewEnabled() || !backendConfigured())
    return (
      <ToolUnavailable
        title={inputCopy[locale].titles[inputMode]}
        error={continuation ? "unavailable" : "invalid"}
      />
    );
  return (
    <InputScreen
      inputMode={inputMode}
      locale={locale}
      continuation={continuation}
    />
  );
}
export function PhotoMatchPage(props: Props) {
  return InputPage(props, "photo");
}
export function VoiceFindPage(props: Props) {
  return InputPage(props, "voice");
}
