use serde::Serialize;

#[derive(Serialize)]
pub struct AvailableResponse {
    pub is_valid: bool,
    pub is_available: bool,
    pub ergoname: String,
    pub cost: u16,
}
