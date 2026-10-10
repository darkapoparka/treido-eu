import { SupportRequestsPage } from "@/features/support/requests-page.server";
export default function Page(props: Parameters<typeof SupportRequestsPage>[0]) { return <SupportRequestsPage {...props} operator />; }
