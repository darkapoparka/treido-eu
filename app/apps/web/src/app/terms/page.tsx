import type { Metadata } from "next";
import { LegalPage, type LegalPageProps } from "@/features/legal/page.server";

export const metadata: Metadata = {
  title: "Treido — terms review",
  robots: { index: false, follow: false },
};
export default function Page(props: LegalPageProps) {
  return <LegalPage kind="terms" {...props} />;
}
