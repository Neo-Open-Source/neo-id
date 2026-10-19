import { api } from './api';

type StartPayload = { email?: string; attempt_id?: string };
type StartResponse = { options?: unknown; publicKey?: unknown; state_id?: string };

export function decodeBase64Url(input: string): Uint8Array<ArrayBuffer> {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function requestOptions(raw: unknown): PublicKeyCredentialRequestOptions | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = ((raw as Record<string, unknown>).publicKey ?? raw) as Record<string, unknown>;
  const allow = Array.isArray(source.allowCredentials) ? source.allowCredentials : [];
  const options: PublicKeyCredentialRequestOptions = {
    challenge: decodeBase64Url(String(source.challenge ?? '')),
    rpId: typeof source.rpId === 'string' ? source.rpId : undefined,
    timeout: typeof source.timeout === 'number' ? source.timeout : undefined
  };
  if (allow.length > 0) {
    options.allowCredentials = allow.map((entry) => {
      const credential = entry as Record<string, unknown>;
      return {
        id: decodeBase64Url(String(credential.id ?? '')),
        type: 'public-key' as const,
        transports: credential.transports as AuthenticatorTransport[] | undefined
      };
    });
  }
  return options;
}

function credentialToJSON(credential: PublicKeyCredential): string {
  const response = credential.response as AuthenticatorAssertionResponse;
  return JSON.stringify({
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    type: 'public-key',
    response: {
      clientDataJSON: encodeBase64Url(response.clientDataJSON),
      authenticatorData: encodeBase64Url(response.authenticatorData),
      signature: encodeBase64Url(response.signature),
      userHandle: response.userHandle ? encodeBase64Url(response.userHandle) : null
    },
    clientExtensionResults: credential.getClientExtensionResults()
  });
}

export async function signInWithPasskey(payload: StartPayload): Promise<void> {
  if (!window.PublicKeyCredential) throw new Error('webauthn unsupported');
  const started = await api<StartResponse>('/api/v1/passkeys/auth/start', {
    method: 'POST',
    body: payload
  });
  const options = requestOptions(started.options ?? started.publicKey);
  if (!options) throw new Error('webauthn options missing');
  const assertion = (await navigator.credentials.get({ publicKey: options })) as
    | PublicKeyCredential
    | null;
  if (!assertion) throw new Error('webauthn cancelled');
  await api('/api/v1/passkeys/auth/finish', {
    method: 'POST',
    body: {
      ...payload,
      state_id: started.state_id ?? '',
      response: credentialToJSON(assertion)
    }
  });
}
