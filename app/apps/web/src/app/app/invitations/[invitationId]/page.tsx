import { notFound } from "next/navigation";
import { validId } from "@/features/selling/draft-model";
import { InvitationPage } from "@/features/team/invitation-page.server";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ invitationId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { invitationId } = await params;
  if (!validId(invitationId)) notFound();
  return (
    <InvitationPage searchParams={searchParams} selectedId={invitationId} />
  );
}
