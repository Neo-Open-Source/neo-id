import { AuthorizationCode } from "simple-oauth2";

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OAuthUserInfo {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
  provider: string;
}

export function createGoogleClient(config: OAuthProviderConfig) {
  return new AuthorizationCode({
    client: {
      id: config.clientId,
      secret: config.clientSecret,
    },
    auth: {
      tokenHost: "https://oauth2.googleapis.com",
      authorizePath: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenPath: "/token",
    },
  });
}

export function createGithubClient(config: OAuthProviderConfig) {
  return new AuthorizationCode({
    client: {
      id: config.clientId,
      secret: config.clientSecret,
    },
    auth: {
      tokenHost: "https://github.com",
      authorizePath: "/login/oauth/authorize",
      tokenPath: "/login/oauth/access_token",
    },
  });
}

export function getGoogleAuthorizationUrl(
  client: AuthorizationCode,
  redirectUri: string,
  state: string
) {
  return client.authorizeURL({
    redirect_uri: redirectUri,
    scope: ["openid", "profile", "email"],
    state,
  });
}

export function getGithubAuthorizationUrl(
  client: AuthorizationCode,
  redirectUri: string,
  state: string
) {
  return client.authorizeURL({
    redirect_uri: redirectUri,
    scope: ["read:user", "user:email"],
    state,
  });
}

export async function exchangeCode(
  client: AuthorizationCode,
  code: string,
  redirectUri: string
) {
  const tokenParams = {
    code,
    redirect_uri: redirectUri,
  };

  const accessToken = await client.getToken(tokenParams);
  return accessToken.token;
}

interface GoogleUser {
  sub: string;
  email: string;
  email_verified?: boolean;
  name: string;
  picture: string;
}

interface GitHubUser {
  id: number;
  email: string | null;
  name: string | null;
  avatar_url: string;
}

export async function getGoogleUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as GoogleUser;

  return {
    id: data.sub,
    email: data.email,
    emailVerified: data.email_verified === true,
    name: data.name,
    picture: data.picture,
    provider: "google",
  };
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

export async function getGithubUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  const [userRes, emailsRes] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  const userData = (await userRes.json()) as GitHubUser;
  let email = userData.email ?? "";
  let emailVerified = false;

  if (emailsRes.ok) {
    const emails = (await emailsRes.json()) as GitHubEmail[];
    const primary = emails.find((e) => e.primary);
    if (primary) {
      email = primary.email;
      emailVerified = primary.verified === true;
    } else if (email) {
      const match = emails.find((e) => e.email === email);
      if (match) emailVerified = match.verified === true;
    }
  }

  return {
    id: String(userData.id),
    email,
    emailVerified,
    name: userData.name ?? undefined,
    picture: userData.avatar_url,
    provider: "github",
  };
}
