import {
  createGoogleClient,
  createGithubClient,
  exchangeCode,
  getGoogleUserInfo,
  getGithubUserInfo,
  getGoogleAuthorizationUrl,
  getGithubAuthorizationUrl,
  type OAuthUserInfo,
} from "@neo-id/auth-core";
import { generateToken } from "@neo-id/auth-core";
import type { OAuthProvider } from "@neo-id/shared";

const SOCIAL_CONFIG: Record<OAuthProvider, { clientId: string; clientSecret: string; redirectUri: string }> = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI || "",
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    redirectUri: process.env.GITHUB_REDIRECT_URI || "",
  },
};

export function getSocialOAuthConfig(provider: OAuthProvider) {
  const config = SOCIAL_CONFIG[provider];
  if (!config) throw new Error(`Unknown OAuth provider: ${provider}`);
  return config;
}

export function isSocialOAuthConfigured(provider: OAuthProvider) {
  const config = getSocialOAuthConfig(provider);
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

type SocialClient = ReturnType<typeof createGoogleClient>;
type ClientFactory = (config: ReturnType<typeof getSocialOAuthConfig>) => SocialClient;
type AuthUrlFn = (client: SocialClient, redirectUri: string, state: string) => string;
type UserInfoFn = (accessToken: string) => Promise<OAuthUserInfo>;

const CLIENT_FACTORIES: Record<OAuthProvider, ClientFactory> = {
  google: (c) => createGoogleClient(c),
  github: (c) => createGithubClient(c),
};

const AUTH_URL_FNS: Record<OAuthProvider, AuthUrlFn> = {
  google: (client, redirectUri, state) => getGoogleAuthorizationUrl(client, redirectUri, state),
  github: (client, redirectUri, state) => getGithubAuthorizationUrl(client, redirectUri, state),
};

const USER_INFO_FNS: Record<OAuthProvider, UserInfoFn> = {
  google: (token) => getGoogleUserInfo(token),
  github: (token) => getGithubUserInfo(token),
};

export function createSocialClient(provider: OAuthProvider): SocialClient {
  const fn = CLIENT_FACTORIES[provider];
  if (!fn) throw new Error(`Unknown OAuth provider: ${provider}`);
  return fn(getSocialOAuthConfig(provider));
}

export function getSocialAuthorizationUrl(provider: OAuthProvider, state: string) {
  const fn = AUTH_URL_FNS[provider];
  if (!fn) throw new Error(`Unknown OAuth provider: ${provider}`);
  const config = getSocialOAuthConfig(provider);
  return fn(createSocialClient(provider), config.redirectUri, state);
}

export async function exchangeSocialCode(
  provider: OAuthProvider,
  code: string,
): Promise<OAuthUserInfo> {
  const fn = USER_INFO_FNS[provider];
  if (!fn) throw new Error(`Unknown OAuth provider: ${provider}`);
  const config = getSocialOAuthConfig(provider);
  const client = createSocialClient(provider);
  const token = await exchangeCode(client, code, config.redirectUri);
  return fn(token.access_token as string);
}

export function createOAuthStateToken() {
  return generateToken(32);
}
