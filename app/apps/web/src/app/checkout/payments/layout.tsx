import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export { PaymentSessionLayout as default } from "@/features/payments/session.server";
