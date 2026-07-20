export interface GeoLocation {
  city?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let geoip: any = null;

async function getGeoIp() {
  if (geoip) return geoip;

  try {
    // @ts-ignore -- geoip-lite has no type declarations
    const geoipLite = await import("geoip-lite");
    geoip = geoipLite.default;
    return geoip;
  } catch {
    // geoip-lite not available
    return null;
  }
}

export async function lookupIp(ip: string): Promise<GeoLocation | null> {
  // Skip local IPs
  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "localhost" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.")
  ) {
    return null;
  }

  const gi = await getGeoIp();
  if (!gi) return null;

  const geo = gi.lookup(ip);
  if (!geo) return null;

  return {
    city: geo.city || undefined,
    country: geo.country || undefined,
    region: geo.region || undefined,
    timezone: geo.timezone || undefined,
    latitude: geo.ll?.[0],
    longitude: geo.ll?.[1],
  };
}

export function formatLocation(geo: GeoLocation | null): string {
  if (!geo) return "Unknown";

  const parts: string[] = [];
  if (geo.city) parts.push(geo.city);
  if (geo.country) parts.push(geo.country);

  return parts.join(", ") || "Unknown";
}
