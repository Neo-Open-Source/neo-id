export interface GeoLocation {
  city?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
}

export function locationFromCountry(countryCode: string | null | undefined): GeoLocation | null {
  const code = countryCode?.trim().toUpperCase();
  if (!code) return null;
  return { country: code, countryCode: code };
}

export function formatLocation(geo: GeoLocation | null): string {
  if (!geo) return "Unknown";
  const parts: string[] = [];
  if (geo.city) parts.push(geo.city);
  if (geo.country) parts.push(geo.country);
  return parts.join(", ") || "Unknown";
}
