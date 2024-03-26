use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
pub struct ApiInfo {
    pub version: String,
    pub pending_registrations: i32,
    pub total_registrations: i32,
    pub last_24h_registrations: i32,
    pub last_7d_registrations: i32,
}
