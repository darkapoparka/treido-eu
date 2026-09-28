import { z } from "zod";

/** Language is independent of market, currency, and time zone. */
export const localeSchema = z.enum(["bg", "en"]);
export type Locale = z.infer<typeof localeSchema>;
