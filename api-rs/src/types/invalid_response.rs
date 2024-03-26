use serde::Serialize;

#[derive(Serialize)]
pub struct InvalidResponse {
    pub is_valid: bool,
}
