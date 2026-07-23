import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { WEBAUTHN } from "@neo-id/shared";

const RP_NAME = WEBAUTHN.RP_NAME;
const RP_ID = process.env.RP_ID || "id.neome.uk";
const ORIGIN = process.env.ORIGIN || "https://id.neome.uk";

export interface CredentialDescriptor {
  credentialId: string;
  transports?: string;
}

export interface RegistrationResult {
  verified: boolean;
  credentialId?: string;
  credentialPublicKey?: string;
  counter?: number;
  transports?: string[];
}

export interface AuthenticationResult {
  verified: boolean;
  newCounter?: number;
}

export async function generateRegistrationOpts(
  _userId: string,
  email: string,
  existingCredentials: CredentialDescriptor[],
) {
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: email,
    userDisplayName: email,
    attestationType: "none",
    excludeCredentials: existingCredentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? [c.transports as any] : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
}

export async function verifyRegistration(
  response: Record<string, unknown>,
  expectedChallenge: string,
  _userId: string,
): Promise<RegistrationResult> {
  const verification = await verifyRegistrationResponse({
    response: response as any,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { verified: false };
  }

  const { credential } = verification.registrationInfo;
  if (!credential) {
    return { verified: false };
  }

  return {
    verified: true,
    credentialId: credential.id,
    credentialPublicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: (response.response as Record<string, unknown>)?.transports as string[] | undefined,
  };
}

export async function generateAuthenticationOpts(
  credentials: CredentialDescriptor[],
) {
  return generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? [c.transports as any] : undefined,
    })),
    userVerification: "preferred",
  });
}

export async function verifyAuthentication(
  response: Record<string, unknown>,
  expectedChallenge: string,
  credential: { credentialId: string; publicKey: string; counter: number },
): Promise<AuthenticationResult> {
  const pubKeyBuffer = Buffer.from(credential.publicKey, "base64url");

  const verification = await verifyAuthenticationResponse({
    response: response as any,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: false,
    credential: {
      id: credential.credentialId,
      publicKey: new Uint8Array(pubKeyBuffer),
      counter: credential.counter,
    },
  });

  return {
    verified: verification.verified,
    newCounter: verification.authenticationInfo?.newCounter,
  };
}
