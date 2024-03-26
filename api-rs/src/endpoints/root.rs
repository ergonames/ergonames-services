use actix_web::{get, HttpResponse, Responder};

#[get("/")]
async fn root_endpoint() -> impl Responder {
    HttpResponse::Ok().body("ErgoNames API-RS")
}
