import type { Locale, LocationSuggestion } from "./locale";
import { parseCountry, parseLocality } from "./regions";
export type DeviceLocationError =
  "unsupported" | "denied" | "timeout" | "unavailable";
export class LocationError extends Error {
  constructor(readonly code: DeviceLocationError) {
    super(code);
  }
}
export function parseDeviceCity(value: unknown): LocationSuggestion | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const country = parseCountry(input.countryCode);
  const city = parseLocality(input.city) || parseLocality(input.locality);
  return country && city ? { country, city } : null;
}
/** No background lookup: invoked only by the informed device-location button. */
export async function requestDeviceCity(
  locale: Locale,
  signal: AbortSignal,
): Promise<LocationSuggestion> {
  if (!globalThis.isSecureContext || !navigator.geolocation)
    throw new LocationError("unsupported");
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    navigator.geolocation.getCurrentPosition(
      (value) => {
        signal.removeEventListener("abort", abort);
        if (!signal.aborted) resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(
          new LocationError(
            error.code === 1
              ? "denied"
              : error.code === 3
                ? "timeout"
                : "unavailable",
          ),
        );
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 },
    );
  });
  signal.throwIfAborted();
  const { latitude, longitude } = position.coords;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    throw new LocationError("unavailable");
  const url = new URL(
    "https://api.bigdatacloud.net/data/reverse-geocode-client",
  );
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("localityLanguage", locale);
  try {
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    if (!response.ok) throw new LocationError("unavailable");
    const result = parseDeviceCity(await response.json());
    if (!result) throw new LocationError("unavailable");
    return result;
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError")
      throw new LocationError("timeout");
    throw new LocationError("unavailable");
  }
}
