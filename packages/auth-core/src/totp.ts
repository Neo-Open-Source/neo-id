import { TOTP, Secret } from "otpauth";

export interface TotpSetup {
  secret: string;
  uri: string;
}

export function generateTotpSecret(email: string, issuer = "Neo ID"): TotpSetup {
  const totp = new TOTP({
    issuer,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });

  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  };
}

export function verifyTotp(secret: string, token: string): boolean {
  const totp = new TOTP({
    secret: Secret.fromBase32(secret),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });

  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}
