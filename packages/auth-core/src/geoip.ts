export interface GeoLocation {
  city?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
}

const LOCAL_IPS = new Set(["127.0.0.1", "::1", "localhost"]);
const LOCAL_RANGES = [/^192\.168\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./];

function isLocalIp(ip: string): boolean {
  if (LOCAL_IPS.has(ip)) return true;
  return LOCAL_RANGES.some((re) => re.test(ip));
}

export async function lookupIp(ip: string): Promise<GeoLocation | null> {
  if (isLocalIp(ip)) return null;

  try {
    // @ts-expect-error — geoip-lite has no type declarations
    const geoipLite = await import("geoip-lite");
    const geoip = (geoipLite.default || geoipLite) as {
      lookup: (ip: string) => { city?: string; country?: string; region?: string; timezone?: string; ll?: [number, number] } | null;
    };
    const geo = geoip.lookup(ip);
    if (!geo) return null;

    return {
      city: geo.city || undefined,
      country: geo.country || undefined,
      region: geo.region || undefined,
      timezone: geo.timezone || undefined,
      latitude: geo.ll?.[0],
      longitude: geo.ll?.[1],
    };
  } catch {
    return null;
  }
}

export function formatLocation(geo: GeoLocation | null): string {
  if (!geo) return "Unknown";
  const parts: string[] = [];
  if (geo.city) parts.push(geo.city);
  if (geo.country) parts.push(geo.country);
  return parts.join(", ") || "Unknown";
}
