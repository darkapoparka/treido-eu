import type { SupportState } from "./model";

export type SupportUpdate = {
  ticketId: string;
  sequence: number;
  title: string;
  state: SupportState;
  at: string;
  unread: boolean;
};
export type SupportUpdateFeed = {
  available: boolean;
  items: SupportUpdate[];
  unreadCount: number;
  hasMore: boolean;
};
