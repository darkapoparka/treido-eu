import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { accountReadiness, connectAccountFacts } from "./registry.server";

function recipient(): Stripe.Account {
  return {
    id: "acct_currentRecipient",
    object: "account",
    email: null,
    type: "express",
    country: "BG",
    default_currency: "eur",
    charges_enabled: false,
    payouts_enabled: true,
    details_submitted: true,
    capabilities: { transfers: "active", card_payments: "inactive" },
    requirements: {
      alternatives: [],
      current_deadline: null,
      currently_due: [],
      disabled_reason: null,
      errors: [],
      eventually_due: [],
      past_due: [],
      pending_verification: [],
    },
  };
}

function merchant(): Stripe.Account {
  const account = recipient();
  account.charges_enabled = true;
  account.capabilities!.card_payments = "active";
  return account;
}

describe("destination-charge readiness follows the approved settlement term", () => {
  it("allows a payout-ready recipient without charge acceptance for platform settlement", () => {
    expect(accountReadiness(recipient(), "platform")).toMatchObject({
      ready: true,
      policyQualified: true,
      settlementMerchant: "platform",
      chargesEnabled: false,
      cardPayments: "inactive",
      transfers: "active",
    });
  });

  it("does not require requesting a card capability for a platform recipient", () => {
    const account = recipient();
    delete account.capabilities!.card_payments;
    expect(accountReadiness(account, "platform")).toMatchObject({
      ready: true,
      cardPayments: "unrequested",
    });
  });

  it("rejects that recipient when the seller is the settlement merchant", () => {
    expect(accountReadiness(recipient(), "seller").ready).toBe(false);
  });

  it("requires merchant charge acceptance even with an active card capability", () => {
    const account = merchant();
    account.charges_enabled = false;
    expect(accountReadiness(account, "seller").ready).toBe(false);
  });

  it.each(["inactive", "pending", undefined] as const)(
    "requires seller card capability to be active, received %s",
    (card) => {
      const account = merchant();
      if (card === undefined) delete account.capabilities!.card_payments;
      else account.capabilities!.card_payments = card;
      expect(accountReadiness(account, "seller").ready).toBe(false);
    },
  );

  it("allows a qualified seller merchant with charge, card, transfer and payout readiness", () => {
    expect(accountReadiness(merchant(), "seller")).toMatchObject({
      ready: true,
      policyQualified: true,
      settlementMerchant: "seller",
    });
  });

  it.each([undefined, null, "", "recipient", "PLATFORM", {}, true])(
    "fails closed for a missing or unknown settlement policy %s",
    (policy) => {
      expect(accountReadiness(merchant(), policy)).toMatchObject({
        ready: false,
        policyQualified: false,
        settlementMerchant: null,
      });
    },
  );
});

describe.each(["platform", "seller"] as const)(
  "%s settlement retains recipient and product gates",
  (policy) => {
    it("requires current payout eligibility", () => {
      const account = merchant();
      account.payouts_enabled = false;
      expect(accountReadiness(account, policy).ready).toBe(false);
    });

    it.each(["inactive", "pending", undefined] as const)(
      "requires active transfers, received %s",
      (transfers) => {
        const account = merchant();
        if (transfers === undefined) delete account.capabilities!.transfers;
        else account.capabilities!.transfers = transfers;
        expect(accountReadiness(account, policy).ready).toBe(false);
      },
    );

    it("requires completed onboarding details", () => {
      const account = merchant();
      account.details_submitted = false;
      expect(accountReadiness(account, policy).ready).toBe(false);
    });

    it("rejects outstanding current requirements", () => {
      const account = merchant();
      account.requirements!.currently_due = ["external_account"];
      expect(accountReadiness(account, policy).ready).toBe(false);
    });

    it("rejects past-due requirements", () => {
      const account = merchant();
      account.requirements!.past_due = ["external_account"];
      expect(accountReadiness(account, policy).ready).toBe(false);
    });

    it("rejects a disabled account", () => {
      const account = merchant();
      account.requirements!.disabled_reason = "requirements.past_due";
      expect(accountReadiness(account, policy).ready).toBe(false);
    });

    it("keeps the current Bulgaria country boundary", () => {
      const account = merchant();
      account.country = "FR";
      expect(accountReadiness(account, policy).ready).toBe(false);
    });

    it("keeps the current EUR boundary", () => {
      const account = merchant();
      account.default_currency = "usd";
      expect(accountReadiness(account, policy).ready).toBe(false);
    });
  },
);

it("keeps current Connect facts separate from any approved payment eligibility", () => {
  const account = recipient();
  account.requirements!.pending_verification = ["individual.verification"];
  expect(connectAccountFacts(account)).toMatchObject({
    chargesEnabled: false,
    payoutsEnabled: true,
    detailsSubmitted: true,
    cardPayments: "inactive",
    transfers: "active",
    currentlyDue: [],
    pastDue: [],
    pendingVerification: ["individual.verification"],
    disabledReason: null,
  });
  expect(connectAccountFacts(account)).not.toHaveProperty("ready");
  expect(connectAccountFacts(account)).not.toHaveProperty("settlementMerchant");
});
