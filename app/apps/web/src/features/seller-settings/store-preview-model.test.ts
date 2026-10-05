import { describe, expect, it } from "vitest";
import {
  projectSavedStorePreview,
  storePreviewPaths,
  type SavedStorePreviewFields,
} from "./store-preview-model";
import { emptyContact, emptyDelivery } from "./model";

const sellerId = "10000000-0000-4000-8000-000000000001";
const saved: SavedStorePreviewFields = {
  name: "Запазен магазин",
  description: "Ръчно изработени артикули\nБез промяна на съдържанието.",
  locality: "София",
  rawContact: null,
  rawDelivery: null,
  publicStoreAvailable: false,
};

describe("saved business preview projection", () => {
  it("keeps only saved profile facts and explicit public service choices", () => {
    const input = {
      ...saved,
      declaration: { legalName: "PRIVATE_LEGAL", address: "PRIVATE_ADDRESS" },
      membership: { userId: "PRIVATE_ACTOR", grants: ["billing.manage"] },
      rawContact: { ...emptyContact, publicEmail: "private@example.test" },
      rawDelivery: { ...emptyDelivery, pickupArea: "PRIVATE_LOCATION" },
      draft: { title: "PRIVATE_DRAFT", priceMinor: 100 },
    };
    const view = projectSavedStorePreview(sellerId, input);
    expect(Object.keys(view).sort()).toEqual([
      "description",
      "locality",
      "name",
      "publicStoreAvailable",
      "sellerId",
      "services",
    ]);
    expect(view.services).toEqual({ contact: null, delivery: null });
    expect(view.name).toBe(saved.name);
    expect(view.description).toBe(saved.description);
    expect(JSON.stringify(view)).not.toMatch(
      /PRIVATE_|private@example|billing\.manage/,
    );
  });

  it("uses the existing public allowlist and excludes disabled delivery details", () => {
    const view = projectSavedStorePreview(sellerId, {
      ...saved,
      rawContact: {
        ...emptyContact,
        published: true,
        publicEmail: "PUBLIC@EXAMPLE.TEST",
      },
      rawDelivery: {
        ...emptyDelivery,
        published: true,
        pickupArea: "PRIVATE_UNUSED",
        pickupNote: "PRIVATE_UNUSED",
        deliveryNote: "PRIVATE_UNUSED",
        returnsNote: "Уточнете условията на обявата.",
      },
    });
    expect(view.services.contact?.publicEmail).toBe("public@example.test");
    expect(view.services.delivery?.returnsNote).toBe(
      "Уточнете условията на обявата.",
    );
    expect(JSON.stringify(view)).not.toContain("PRIVATE_UNUSED");
    expect(view.services.contact).not.toHaveProperty("published");
    expect(view.services.delivery).not.toHaveProperty("published");
  });

  it("does not project an invalid published service object containing private fields", () => {
    const view = projectSavedStorePreview(sellerId, {
      ...saved,
      rawContact: {
        ...emptyContact,
        published: true,
        legalName: "PRIVATE_LEGAL",
      },
    });
    expect(view.services.contact).toBeNull();
    expect(JSON.stringify(view)).not.toContain("PRIVATE_LEGAL");
  });

  it("distinguishes a valid zero-inventory state from missing or malformed saved data", () => {
    expect(projectSavedStorePreview(sellerId, saved).publicStoreAvailable).toBe(
      false,
    );
    for (const changed of [
      { publicStoreAvailable: undefined },
      { publicStoreAvailable: "false" },
      { name: "x" },
      { name: "x".repeat(81) },
      { description: "x".repeat(1201) },
      { locality: "x".repeat(101) },
      { description: "invalid\u0000text" },
    ])
      expect(() =>
        projectSavedStorePreview(sellerId, { ...saved, ...changed }),
      ).toThrow("NOT_AVAILABLE");
  });

  it("binds preview, public link and return to the same bounded seller and language", () => {
    for (const language of ["bg", "en"] as const) {
      const paths = storePreviewPaths(sellerId, language);
      expect(paths.preview).toBe(
        `/app/sellers/${sellerId}/settings/store/preview?lang=${language}`,
      );
      expect(paths.settings).toBe(
        `/app/sellers/${sellerId}/settings/store?lang=${language}`,
      );
      expect(paths.publicStore).toBe(`/stores/${sellerId}?lang=${language}`);
    }
    for (const id of [
      "",
      "//foreign.example",
      sellerId + "/other",
      "x".repeat(1000),
    ])
      expect(() => storePreviewPaths(id, "en")).toThrow("INVALID_INPUT");
    expect(() =>
      storePreviewPaths(sellerId, "en&seller=other" as "en"),
    ).toThrow("INVALID_INPUT");
  });
});
