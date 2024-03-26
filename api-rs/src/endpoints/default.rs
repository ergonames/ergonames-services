use actix_web::{HttpResponse, Responder};

pub async fn default_endpoint() -> impl Responder {
    let message = "Not found";
    HttpResponse::NotFound().json(message)
}
