use crate::types::ergoname::Ergoname;

use serde::Serialize;

#[derive(Serialize)]
pub struct ResolveResponse {
    pub is_valid: bool,
    pub is_available: bool,
    pub ergoname: Ergoname,
}
