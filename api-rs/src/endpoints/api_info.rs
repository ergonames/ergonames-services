use crate::types::api_info::ApiInfo;

use actix_web::{get, HttpResponse, Responder};

#[get("/info")]
async fn info_endpoint() -> impl Responder {
    let info = ApiInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        pending_registrations: 0,
        total_registrations: 0,
        last_24h_registrations: 0,
        last_7d_registrations: 0,
    };
    HttpResponse::Ok().json(info)
}
