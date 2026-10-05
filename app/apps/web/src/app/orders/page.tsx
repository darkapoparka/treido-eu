import {
  PaidOrdersPage,
  type PaymentPageProps,
} from "@/features/payments/pages.server";
export default function Page(props: Omit<PaymentPageProps, "params">) {
  return <PaidOrdersPage {...props} params={Promise.resolve({})} />;
}
