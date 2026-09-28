import Link from "next/link";
import { SourceLink } from "../discovery/return-navigation";
import { AccountIcon } from "./icons";

/** Display-only source app version; never the version of Treido's services. */
export function ProfileFooter({ native = false }: { native?: boolean }) {
  return (
    <footer className="profile-footer">
      <p>
        {native ? "Version 3.4.0 (493466)" : "Version 2.266.0-release.377556"}
      </p>
      <p>
        <Link href="https://shop.app/terms-of-service">
          Terms and conditions
        </Link>
        <SourceLink href="/about">Licenses</SourceLink>
      </p>
      <p className="profile-powered">
        Powered by{" "}
        <b>
          <AccountIcon name="clipboard" />
          shopify
        </b>
        <span aria-hidden="true">|</span>
        <Link href="https://www.shopify.com">Start selling for free</Link>
      </p>
    </footer>
  );
}
