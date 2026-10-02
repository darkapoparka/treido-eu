import { InboxPage } from "@/features/messaging/page";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <InboxPage
      scope={{ sellerId: null }}
      threadId={(await params).threadId}
      searchParams={searchParams}
    />
  );
}
