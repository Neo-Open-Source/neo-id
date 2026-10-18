use auth_db::{Executor, find_user_by_id};
use serde_json::Value;

use crate::authorize::{WireError, field, optional};

#[derive(Debug, Clone)]
pub struct UserInfoRequest {
    pub sub: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserInfo {
    pub sub: String,
    pub email: String,
    pub email_verified: bool,
    pub name: String,
    pub given_name: Option<String>,
    pub family_name: Option<String>,
    pub picture: Option<String>,
}

pub async fn userinfo<E: Executor>(db: &E, req: UserInfoRequest) -> Result<UserInfo, WireError> {
    let rows = db.run(find_user_by_id(&req.sub)).await?;
    let row = rows.first().ok_or(WireError::InvalidRequest)?;
    if field(row, "status")? == "banned" {
        return Err(WireError::AccessDenied);
    }
    let email = field(row, "email")?.to_string();
    Ok(UserInfo {
        sub: req.sub,
        name: optional(row, "displayName")
            .or_else(|| optional(row, "name"))
            .unwrap_or_else(|| email.clone()),
        email_verified: row
            .get("emailVerified")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        email,
        given_name: optional(row, "firstName"),
        family_name: optional(row, "lastName"),
        picture: optional(row, "avatar"),
    })
}
