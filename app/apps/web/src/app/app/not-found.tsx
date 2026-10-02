import { useTranslations } from "next-intl";
import { Workspace } from "@/features/sellers/workspace";
export default function SellerNotFound() {
  const ui = useTranslations("accountUI");
  return (
    <Workspace title={ui("thisSellerOrItemIsUnavailable")}>
      <p>{ui("checkYourSellerSelectionOrReturnToMySelling")}</p>
    </Workspace>
  );
}
