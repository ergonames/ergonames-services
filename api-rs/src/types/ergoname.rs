use serde::Serialize;

#[derive(Debug, PartialEq, Serialize)]
pub struct Ergoname {
    pub name: String,
    pub token_id: String,
    pub mint_transaction_id: String,
    pub mint_box_id: String,
    pub spent_transaction_id: Option<String>,
    pub registered_address: String,
    pub owner_address: String,
    pub block_registered: i32,
    pub timestamp_registered: i64,
    pub registration_number: i32,
}
