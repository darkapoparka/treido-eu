import {
  ServiceSettingsPage,
  type SettingsPageProps,
} from "@/features/seller-settings/pages.server";
export default function Page(props: SettingsPageProps) {
  return <ServiceSettingsPage {...props} section="contact" />;
}
