import { AuthenticationPage } from "@/features/sellers/authentication-page";

export const dynamic = "force-dynamic";
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; lang?: string }>;
}) {
  return <AuthenticationPage searchParams={searchParams} mode="sign-up" />;
}
