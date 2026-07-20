// @ts-nocheck — simplewebauthn types are complex; verify at runtime
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

const RP_NAME = "Neo ID";
const RP_ID = process.env.RP_ID || "id.neome.uk";
const ORIGIN = process.env.ORIGIN || "https://id.neome.uk";

export async function generateRegistrationOpts(
  _userId: string,
  email: string,
  existingCredentials: Array<{ credentialId: string; transports?: string }>
): Promise<any> {
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: email,
    userDisplayName: email,
    attestationType: "none",
    excludeCredentials: existingCredentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports as any,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
}

export async function verifyRegistration(
  response: any,
  expectedChallenge: string,
  _userId: string
): Promise<{ verified: boolean; credentialId?: string; credentialPublicKey?: string; counter?: number; transports?: any }> {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { verified: false };
  }

  const { credential } = verification.registrationInfo;

  return {
    verified: true,
    credentialId: credential.id,
    credentialPublicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: response.response.transports,
  };
}

export async function generateAuthenticationOpts(
  credentials: Array<{ credentialId: string; transports?: string }>
): Promise<any> {
  return generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports as any,
    })),
    userVerification: "preferred",
  });
}

export async function verifyAuthentication(
  response: any,
  expectedChallenge: string,
  credential: { credentialId: string; publicKey: string; counter: number }
): Promise<{ verified: boolean; newCounter?: number }> {
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: credential.credentialId,
      publicKey: Buffer.from(credential.publicKey, "base64url"),
      counter: credential.counter,
    } as any,
  });

  return {
    verified: verification.verified,
    newCounter: verification.authenticationInfo.newCounter,
  };
}
