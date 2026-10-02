import { InboxPage } from "@/features/messaging/page";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <InboxPage scope={{ sellerId: null }} searchParams={searchParams} />;
}
