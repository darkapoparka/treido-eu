import { InvitationPage } from "@/features/team/invitation-page.server";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  return <InvitationPage searchParams={searchParams} />;
}
