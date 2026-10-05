import { describe, it, expect } from "vitest";
import {
  emptyContact,
  emptyDelivery,
  parseServicePayload,
  publicServiceSettings,
} from "./model";
import messages from "./messages.json";
describe("explicit public service settings", () => {
  it("keeps private and incomplete settings out of public projections", () => {
    expect(
      publicServiceSettings(
        { ...emptyContact, publicEmail: "private@example.test" },
        { ...emptyDelivery, pickupArea: "Private address" },
      ),
    ).toEqual({ contact: null, delivery: null });
  });
  it("requires explicit complete published arrangements", () => {
    expect(
      parseServicePayload("delivery", {
        ...emptyDelivery,
        published: true,
        pickup: true,
      }),
    ).toBeNull();
    expect(
      parseServicePayload("delivery", {
        ...emptyDelivery,
        published: true,
        deliveryByArrangement: true,
      }),
    ).toBeNull();
    expect(
      parseServicePayload("delivery", {
        ...emptyDelivery,
        published: false,
        pickup: true,
      }),
    ).not.toBeNull();
  });
  it("does not leak disabled arrangements or private declaration fields", () => {
    const publicInfo = publicServiceSettings(
      { ...emptyContact, published: true, publicEmail: "public@example.test" },
      {
        ...emptyDelivery,
        published: true,
        pickupArea: "hidden",
        pickupNote: "hidden",
        deliveryNote: "hidden",
        returnsNote: "Discuss returns",
      },
    );
    expect(publicInfo.contact).not.toHaveProperty("published");
    expect(publicInfo.delivery).toMatchObject({
      pickupArea: "",
      pickupNote: "",
      deliveryNote: "",
      returnsNote: "Discuss returns",
    });
    expect(
      publicServiceSettings(
        { ...emptyContact, published: true, legalName: "PRIVATE" },
        null,
      ).contact,
    ).toBeNull();
  });
  it("validates contact input without treating saved display information as verified identity", () => {
    expect(
      parseServicePayload("contact", {
        ...emptyContact,
        publicEmail: "UPPER@EXAMPLE.TEST",
      }),
    ).toMatchObject({ publicEmail: "upper@example.test" });
    for (const phone of ["------", "javascript:alert(1)", "123\n456"])
      expect(
        parseServicePayload("contact", { ...emptyContact, publicPhone: phone }),
      ).toBeNull();
    expect(
      parseServicePayload("contact", {
        ...emptyContact,
        publicPhone: "+359 888 123 456",
      }),
    ).not.toBeNull();
  });
  it("has matching BG and EN controls", () =>
    expect(Object.keys(messages.bg).sort()).toEqual(
      Object.keys(messages.en).sort(),
    ));
});
