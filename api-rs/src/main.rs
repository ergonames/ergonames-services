pub mod endpoints;
pub mod types;
pub mod utils;

use endpoints::{
    api_info::info_endpoint, default::default_endpoint,
    resolve_ergoname::resolve_ergoname_endpoint, root::root_endpoint,
};

use actix_web::{web, App, HttpServer};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .service(root_endpoint)
            .service(info_endpoint)
            .service(resolve_ergoname_endpoint)
            .default_service(web::route().to(default_endpoint))
    })
    .bind(("0.0.0.0", 3000))?
    .run()
    .await
}
