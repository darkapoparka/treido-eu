import { normalizeRecipient } from "../team/model";
export type ServiceSection = "contact" | "delivery";
export type ContactSettings = {
  published: boolean;
  publicEmail: string;
  publicPhone: string;
  contactNote: string;
};
export type DeliverySettings = {
  published: boolean;
  pickup: boolean;
  pickupArea: string;
  pickupNote: string;
  deliveryByArrangement: boolean;
  deliveryNote: string;
  returnsNote: string;
};
export type ServicePayload = ContactSettings | DeliverySettings;
export type ServiceView = {
  sellerId: string;
  name: string;
  section: ServiceSection;
  revision: number;
  savedAt: string | null;
  payload: ServicePayload;
};
export type ServiceCommand = {
  sellerId: string;
  section: ServiceSection;
  expectedRevision: number;
  requestId: string;
  payload: unknown;
};
export type PublicServiceSettings = {
  contact: Omit<ContactSettings, "published"> | null;
  delivery: Omit<DeliverySettings, "published"> | null;
};
export const emptyContact: ContactSettings = {
  published: false,
  publicEmail: "",
  publicPhone: "",
  contactNote: "",
};
export const emptyDelivery: DeliverySettings = {
  published: false,
  pickup: false,
  pickupArea: "",
  pickupNote: "",
  deliveryByArrangement: false,
  deliveryNote: "",
  returnsNote: "",
};
const text = (value: unknown, max: number) =>
  typeof value === "string" &&
  value.length <= max &&
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    ? value.trim()
    : null;
export function parseServicePayload(
  section: ServiceSection,
  value: unknown,
): ServicePayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.published !== "boolean") return null;
  if (section === "contact") {
    if (Object.keys(v).some((k) => !Object.hasOwn(emptyContact, k)))
      return null;
    const email = text(v.publicEmail, 254),
      phone = text(v.publicPhone, 40),
      note = text(v.contactNote, 1200);
    if (
      email === null ||
      phone === null ||
      note === null ||
      (email && !normalizeRecipient(email)) ||
      (phone &&
        (!/^\+?[0-9 ()\-.]{6,40}$/.test(phone) ||
          phone.replace(/\D/g, "").length < 6))
    )
      return null;
    return {
      published: v.published,
      publicEmail: email ? normalizeRecipient(email)! : "",
      publicPhone: phone,
      contactNote: note,
    };
  }
  if (
    section !== "delivery" ||
    Object.keys(v).some((k) => !Object.hasOwn(emptyDelivery, k)) ||
    typeof v.pickup !== "boolean" ||
    typeof v.deliveryByArrangement !== "boolean"
  )
    return null;
  const area = text(v.pickupArea, 100),
    pickupNote = text(v.pickupNote, 1200),
    deliveryNote = text(v.deliveryNote, 1200),
    returnsNote = text(v.returnsNote, 2000);
  if (
    area === null ||
    pickupNote === null ||
    deliveryNote === null ||
    returnsNote === null ||
    (v.published && v.pickup && area.length < 2) ||
    (v.published && v.deliveryByArrangement && deliveryNote.length < 5)
  )
    return null;
  return {
    published: v.published,
    pickup: v.pickup,
    pickupArea: area,
    pickupNote,
    deliveryByArrangement: v.deliveryByArrangement,
    deliveryNote,
    returnsNote,
  };
}
/** Explicit allowlist; draft service information and legal declarations never enter a public DTO. */
export function publicServiceSettings(
  contactValue: unknown,
  deliveryValue: unknown,
): PublicServiceSettings {
  const contact = parseServicePayload(
    "contact",
    contactValue,
  ) as ContactSettings | null;
  const delivery = parseServicePayload(
    "delivery",
    deliveryValue,
  ) as DeliverySettings | null;
  return {
    contact: contact?.published
      ? {
          publicEmail: contact.publicEmail,
          publicPhone: contact.publicPhone,
          contactNote: contact.contactNote,
        }
      : null,
    delivery: delivery?.published
      ? {
          pickup: delivery.pickup,
          pickupArea: delivery.pickup ? delivery.pickupArea : "",
          pickupNote: delivery.pickup ? delivery.pickupNote : "",
          deliveryByArrangement: delivery.deliveryByArrangement,
          deliveryNote: delivery.deliveryByArrangement
            ? delivery.deliveryNote
            : "",
          returnsNote: delivery.returnsNote,
        }
      : null,
  };
}
