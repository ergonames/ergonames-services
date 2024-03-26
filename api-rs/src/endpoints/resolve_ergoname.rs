use actix_web::{get, web, HttpResponse, Responder};

use crate::{
    types::{
        available_response::AvailableResponse, invalid_response::InvalidResponse,
        resolve_response::ResolveResponse,
    },
    utils::{
        database::read_ergoname_from_db,
        ergoname::{check_ergoname_validity, get_current_mint_cost},
    },
};

#[get("/resolve/{ergoname}")]
async fn resolve_ergoname_endpoint(ergoname: web::Path<String>) -> impl Responder {
    if !check_ergoname_validity(&ergoname) {
        let response = InvalidResponse { is_valid: false };
        return HttpResponse::BadRequest().json(response);
    }
    let ergoname_response = read_ergoname_from_db(&ergoname).await;
    if ergoname_response.is_err() {
        let response = AvailableResponse {
            is_valid: true,
            is_available: true,
            ergoname: ergoname.to_string(),
            cost: get_current_mint_cost(&ergoname),
        };
        return HttpResponse::Ok().json(response);
    }
    let ergoname = ergoname_response.unwrap();
    let response = ResolveResponse {
        is_valid: true,
        is_available: false,
        ergoname,
    };
    HttpResponse::Ok().json(response)
}
