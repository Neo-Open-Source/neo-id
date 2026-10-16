use auth_db::{http_endpoint, query_body, rows};

#[test]
fn endpoint_derives_from_pooler_url() {
    assert_eq!(
        http_endpoint("postgresql://u:p@ep-x.c-12.us-east-1.aws.neon.tech/db?sslmode=require")
            .unwrap(),
        "https://ep-x.c-12.us-east-1.aws.neon.tech/sql"
    );
}

#[test]
fn endpoint_rejects_garbage() {
    assert!(http_endpoint("not a url").is_err());
    assert!(http_endpoint("postgresql://user@/db").is_err());
}

#[test]
fn body_carries_query_and_params() {
    let body: serde_json::Value =
        serde_json::from_str(&query_body("select $1", &[1.into()])).unwrap();
    assert_eq!(body["query"], "select $1");
    assert_eq!(body["params"], serde_json::json!([1]));
}

#[test]
fn rows_extracts_live_shape() {
    let live = r#"{"fields":[{"name":"one","dataTypeID":23}],"rows":[{"one":1,"who":"neondb_owner"}],"command":"SELECT","rowCount":1,"rowAsArray":false}"#;
    let rows = rows(live).unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0]["one"], 1);
}

#[test]
fn rows_rejects_non_shape() {
    assert!(rows("{}").is_err());
    assert!(rows("not json").is_err());
    assert!(rows(r#"{"rows": {}}"#).is_err());
}
