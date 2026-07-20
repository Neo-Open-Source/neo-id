import { AuthorizationCode } from "simple-oauth2";

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OAuthUserInfo {
  id: string;
  email: string;
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
    scope: ["user:email"],
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

export async function getGoogleUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();

  return {
    id: data.sub,
    email: data.email,
    name: data.name,
    picture: data.picture,
    provider: "google",
  };
}

export async function getGithubUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();

  return {
    id: String(data.id),
    email: data.email,
    name: data.name,
    picture: data.avatar_url,
    provider: "github",
  };
}
