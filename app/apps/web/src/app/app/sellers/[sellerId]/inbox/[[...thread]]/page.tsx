import { notFound } from "next/navigation";
import { InboxPage } from "@/features/messaging/page";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string; thread?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sellerId, thread = [] } = await params;
  if (thread.length > 1) notFound();
  return (
    <InboxPage
      scope={{ sellerId }}
      threadId={thread[0]}
      searchParams={searchParams}
    />
  );
}
