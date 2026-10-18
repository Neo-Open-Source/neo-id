use auth_db::{Executor, find_user_by_id};
use auth_proto::auth::v1::UserInfo;
use serde_json::Value;

use crate::authorize::{WireError, field, optional};

#[derive(Debug, Clone)]
pub struct UserInfoRequest {
    pub sub: String,
    pub scope: Option<String>,
}

pub async fn userinfo<E: Executor>(db: &E, req: UserInfoRequest) -> Result<UserInfo, WireError> {
    let rows = db.run(find_user_by_id(&req.sub)).await?;
    let row = rows.first().ok_or(WireError::InvalidRequest)?;
    if field(row, "status")? == "banned" {
        return Err(WireError::AccessDenied);
    }
    let scopes: Vec<&str> = req
        .scope
        .as_deref()
        .unwrap_or_default()
        .split_whitespace()
        .collect();
    let profile = scopes.contains(&"profile");
    let email_scope = scopes.contains(&"email");
    Ok(UserInfo {
        sub: req.sub,
        email: email_scope
            .then(|| field(row, "email").map(str::to_string))
            .transpose()?,
        email_verified: email_scope.then(|| {
            row.get("emailVerified")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        }),
        name: profile.then(|| {
            optional(row, "displayName")
                .or_else(|| optional(row, "name"))
                .unwrap_or_else(|| field(row, "email").unwrap_or_default().to_string())
        }),
        given_name: profile.then(|| optional(row, "firstName")).flatten(),
        family_name: profile.then(|| optional(row, "lastName")).flatten(),
        picture: profile.then(|| optional(row, "avatar")).flatten(),
    })
}
