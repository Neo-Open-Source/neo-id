use auth_core::{
    ACCESS_TOKEN_TTL, AccessInput, IdInput, RefreshDecision, SecretCheck, client_secret_check,
    encode_error, enforce_pkce, generate_id, generate_token, hash_token, refresh_decision,
    refresh_expiry, session_expiry, sign_access, sign_id,
};
use auth_db::{
    Executor, create_refresh, create_session, delete_code, find_client, find_code, find_refresh,
    find_session, find_user_by_id, parse_refresh, revoke_refresh, touch_login, touch_session,
};
use serde_json::Value;

use crate::authorize::{WireError, epoch, field, flag, optional};

#[derive(Debug, Clone)]
pub enum Grant {
    Code {
        code: String,
        redirect_uri: String,
        client_id: String,
        client_secret: Option<String>,
        code_verifier: Option<String>,
        nonce: Option<String>,
    },
    Refresh {
        refresh_token: String,
        client_id: String,
        client_secret: Option<String>,
    },
}

#[derive(Debug, Clone)]
pub struct TokenRequest {
    pub grant: Grant,
    pub device: Option<String>,
    pub ip: Option<String>,
}

#[derive(Clone, PartialEq, Eq)]
pub struct Tokens {
    pub access_token: String,
    pub refresh_token: String,
    pub id_token: String,
    pub session_id: String,
    pub expires_in: u64,
}

impl core::fmt::Debug for Tokens {
    fn fmt(&self, formatter: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        formatter
            .debug_struct("Tokens")
            .field("session_id", &self.session_id)
            .field("expires_in", &self.expires_in)
            .finish_non_exhaustive()
    }
}

pub async fn token<E: Executor, R: rand::RngCore + rand::CryptoRng>(
    db: &E,
    rng: &mut R,
    now: u64,
    private_pem: &[u8],
    issuer: &str,
    req: TokenRequest,
) -> Result<Tokens, WireError> {
    let TokenRequest { grant, device, ip } = req;
    let mut call = TokenCall {
        db,
        rng,
        now,
        private_pem,
        issuer,
        device: device.as_deref(),
        ip: ip.as_deref(),
    };
    match grant {
        Grant::Code {
            code,
            redirect_uri,
            client_id,
            client_secret,
            code_verifier,
            nonce,
        } => {
            call.exchange_code(
                &code,
                &redirect_uri,
                &client_id,
                client_secret.as_deref(),
                code_verifier.as_deref(),
                nonce.as_deref(),
            )
            .await
        }
        Grant::Refresh {
            refresh_token,
            client_id,
            client_secret,
        } => {
            call.redeem_refresh(&refresh_token, &client_id, client_secret.as_deref())
                .await
        }
    }
}

struct TokenCall<'a, E, R> {
    db: &'a E,
    rng: &'a mut R,
    now: u64,
    private_pem: &'a [u8],
    issuer: &'a str,
    device: Option<&'a str>,
    ip: Option<&'a str>,
}

struct Subject {
    user_id: String,
    email: String,
    role: String,
}

struct Client {
    app_id: String,
    secret_hash: Option<String>,
}

impl<E: Executor, R: rand::RngCore + rand::CryptoRng> TokenCall<'_, E, R> {
    async fn exchange_code(
        &mut self,
        code: &str,
        redirect_uri: &str,
        client_id: &str,
        client_secret: Option<&str>,
        code_verifier: Option<&str>,
        nonce: Option<&str>,
    ) -> Result<Tokens, WireError> {
        let client = self.client(client_id).await?;
        match client_secret_check(client.secret_hash.as_deref(), client_secret) {
            SecretCheck::Skipped | SecretCheck::Valid => {}
            SecretCheck::Invalid => return Err(WireError::InvalidClient),
        }
        let rows = self
            .db
            .run(find_code(code, &client.app_id, redirect_uri, self.now))
            .await?;
        let row = rows.first().ok_or(WireError::InvalidGrant)?;
        let user_id = field(row, "userId")?.to_string();
        let session_id = optional(row, "sessionId");
        let challenge = optional(row, "codeChallenge").or_else(|| optional(row, "codeVerifier"));
        let public = client.secret_hash.is_none();
        enforce_pkce(challenge.as_deref(), public, code_verifier)?;
        self.db.run(delete_code(code)).await?;
        let subject = self.subject(&user_id).await?;
        let session = self.session(&user_id, session_id.as_deref()).await?;
        let (access_token, id_token) = self.mint(&subject, &session, client_id, nonce)?;
        let refresh_token = self.store_refresh(&user_id, &session, None).await?;
        self.db
            .run(touch_login(&user_id, self.ip, self.now))
            .await?;
        Ok(Tokens {
            access_token,
            refresh_token,
            id_token,
            session_id: session,
            expires_in: ACCESS_TOKEN_TTL,
        })
    }

    async fn redeem_refresh(
        &mut self,
        presented: &str,
        client_id: &str,
        client_secret: Option<&str>,
    ) -> Result<Tokens, WireError> {
        let client = self.client(client_id).await?;
        match client_secret_check(client.secret_hash.as_deref(), client_secret) {
            SecretCheck::Skipped | SecretCheck::Valid => {}
            SecretCheck::Invalid => return Err(WireError::InvalidClient),
        }
        let rows = self.db.run(find_refresh(&hash_token(presented))).await?;
        let row = rows.first().ok_or(WireError::InvalidGrant)?;
        let token_id = field(row, "id")?.to_string();
        let user_id = field(row, "userId")?.to_string();
        let session_id = optional(row, "sessionId");
        let (_, session_active) = self.session_state(&user_id, session_id.as_deref()).await?;
        let decision = refresh_decision(
            &parse_refresh(row, session_active).map_err(|_| WireError::ServerError)?,
            self.now,
        );
        match decision {
            RefreshDecision::Reissue => {
                self.db
                    .run(revoke_refresh(&token_id, "rotated", self.now))
                    .await?;
            }
            RefreshDecision::GraceReissue => {}
            RefreshDecision::Expired
            | RefreshDecision::UserBanned
            | RefreshDecision::NoSession
            | RefreshDecision::SessionInactive
            | RefreshDecision::TokenInvalid => {
                return match encode_error(&decision) {
                    "TOKEN_EXPIRED" | "TOKEN_INVALID" => Err(WireError::InvalidGrant),
                    "USER_BANNED" => Err(WireError::AccessDenied),
                    "INVALID_REQUEST" => Err(WireError::InvalidRequest),
                    _ => Err(WireError::ServerError),
                };
            }
        }
        let session = session_id.ok_or(WireError::InvalidRequest)?;
        self.db
            .run(touch_session(
                &session,
                self.device,
                self.ip,
                session_expiry(self.now),
            ))
            .await?;
        let subject = self.subject(&user_id).await?;
        let (access_token, id_token) = self.mint(&subject, &session, client_id, None)?;
        let refresh_token = self
            .store_refresh(&user_id, &session, Some(&token_id))
            .await?;
        self.db
            .run(touch_login(&user_id, self.ip, self.now))
            .await?;
        Ok(Tokens {
            access_token,
            refresh_token,
            id_token,
            session_id: session,
            expires_in: ACCESS_TOKEN_TTL,
        })
    }

    async fn client(&self, client_id: &str) -> Result<Client, WireError> {
        let rows = self.db.run(find_client(client_id)).await?;
        let row = rows.first().ok_or(WireError::InvalidClient)?;
        if !flag(row, "isActive")? {
            return Err(WireError::InvalidClient);
        }
        let app_id = row
            .get("id")
            .and_then(Value::as_str)
            .or_else(|| row.get("clientId").and_then(Value::as_str))
            .ok_or(WireError::ServerError)?
            .to_string();
        Ok(Client {
            app_id,
            secret_hash: optional(row, "clientSecretHash"),
        })
    }

    async fn subject(&self, user_id: &str) -> Result<Subject, WireError> {
        let rows = self.db.run(find_user_by_id(user_id)).await?;
        let row = rows.first().ok_or(WireError::InvalidGrant)?;
        if field(row, "status")? == "banned" {
            return Err(WireError::AccessDenied);
        }
        Ok(Subject {
            user_id: user_id.to_string(),
            email: field(row, "email")?.to_string(),
            role: field(row, "role")?.to_string(),
        })
    }

    async fn session(
        &mut self,
        user_id: &str,
        session_id: Option<&str>,
    ) -> Result<String, WireError> {
        if let Some(sid) = session_id {
            let rows = self.db.run(find_session(sid)).await?;
            if let Some(row) = rows.first() {
                let owner = field(row, "userId")?;
                let active = flag(row, "isActive")?;
                let live = match epoch(row, "expiresAt") {
                    Ok(expires) => expires > self.now,
                    Err(_) => false,
                };
                if owner == user_id && active && live {
                    self.db
                        .run(touch_session(
                            sid,
                            self.device,
                            self.ip,
                            session_expiry(self.now),
                        ))
                        .await?;
                    return Ok(sid.to_string());
                }
            }
        }
        let rows = self
            .db
            .run(create_session(
                user_id,
                self.device,
                self.ip,
                session_expiry(self.now),
            ))
            .await?;
        let row = rows.first().ok_or(WireError::ServerError)?;
        Ok(field(row, "id")?.to_string())
    }

    async fn session_state(
        &self,
        user_id: &str,
        session_id: Option<&str>,
    ) -> Result<(bool, bool), WireError> {
        let Some(sid) = session_id else {
            return Ok((false, false));
        };
        let rows = self.db.run(find_session(sid)).await?;
        let Some(row) = rows.first() else {
            return Ok((true, false));
        };
        let owner = field(row, "userId")?;
        let active = flag(row, "isActive")?;
        let live = match epoch(row, "expiresAt") {
            Ok(expires) => expires > self.now,
            Err(_) => false,
        };
        Ok((true, owner == user_id && active && live))
    }

    fn mint(
        &mut self,
        subject: &Subject,
        session_id: &str,
        audience: &str,
        nonce: Option<&str>,
    ) -> Result<(String, String), WireError> {
        let access = sign_access(
            self.private_pem,
            &AccessInput {
                sub: subject.user_id.clone(),
                email: subject.email.clone(),
                role: subject.role.clone(),
                session_id: Some(session_id.to_string()),
                issuer: self.issuer.to_string(),
                issued_at: self.now,
                auth_time: self.now,
                jti: generate_id(&mut *self.rng),
            },
        )?;
        let id = sign_id(
            self.private_pem,
            &IdInput {
                sub: subject.user_id.clone(),
                email: subject.email.clone(),
                audience: audience.to_string(),
                issuer: self.issuer.to_string(),
                issued_at: self.now,
                auth_time: self.now,
                nonce: nonce.map(String::from),
                access_token: Some(access.clone()),
                jti: generate_id(&mut *self.rng),
            },
        )?;
        Ok((access, id))
    }

    async fn store_refresh(
        &mut self,
        user_id: &str,
        session_id: &str,
        parent: Option<&str>,
    ) -> Result<String, WireError> {
        let raw = generate_token(&mut *self.rng, 64);
        self.db
            .run(create_refresh(
                user_id,
                session_id,
                &hash_token(&raw),
                parent,
                self.device,
                self.ip,
                refresh_expiry(self.now),
            ))
            .await?;
        Ok(raw)
    }
}
