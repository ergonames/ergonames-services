use anyhow::{Error, Result};
use tokio_postgres::NoTls;

use crate::types::ergoname::Ergoname;

pub async fn read_ergoname_from_db(ergoname: &str) -> Result<Ergoname> {
    let (client, connection) = tokio_postgres::connect(
        "host=localhost port=5432 user=ergonames dbname=ergonames password=ergonames",
        NoTls,
    )
    .await?;
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("connection error: {}", e);
        }
    });
    let rows = client
        .query(
            "SELECT * FROM registrations WHERE ergoname_name = $1",
            &[&ergoname],
        )
        .await?;
    let rows_count = rows.len();
    if rows_count == 0 {
        return Err(Error::msg("Ergoname not found in database"));
    }
    let ergoname_data = rows.first().unwrap();
    let ergoname = Ergoname {
        name: ergoname_data.get("ergoname_name"),
        token_id: ergoname_data.get("ergoname_token_id"),
        mint_transaction_id: ergoname_data.get("mint_transaction_id"),
        mint_box_id: ergoname_data.get("mint_box_id"),
        spent_transaction_id: ergoname_data.get("spent_transaction_id"),
        registered_address: "".to_string(),
        owner_address: "".to_string(),
        block_registered: ergoname_data.get("block_registered"),
        timestamp_registered: ergoname_data.get("timestamp_registered"),
        registration_number: ergoname_data.get("registration_number"),
    };
    Ok(ergoname)
}

#[cfg(test)]
mod tests {
    use super::{read_ergoname_from_db, Ergoname};

    #[tokio::test]
    async fn test_read_ergoname_from_db() {
        let ergoname = Ergoname {
            name: "mgpai".to_string(),
            token_id: "6770373a9dbcb235a5595b54ce0fc313f29f822c17e7c590a3aebf9ea93930ca"
                .to_string(),
            mint_transaction_id: "46927246a900356d779e6cd8b2b0c3c6e53f9ab2a1b95afb4692d03069aa44d4"
                .to_string(),
            mint_box_id: "8d8f4542ea045045b7e92387c231eed16b4200b555ad5b1952fee4298f21c4d1"
                .to_string(),
            spent_transaction_id:
                Some("1def53087039fce5e12f5aee0b5ce73320d8f0c0cee657da7ee16d8d9625f44b".to_string()),
            registered_address: "".to_string(),
            owner_address: "".to_string(),
            block_registered: 936576,
            timestamp_registered: 1705459904363,
            registration_number: 3,
        };
        let result = read_ergoname_from_db("mgpai").await.unwrap();
        assert_eq!(result, ergoname);
    }

    #[tokio::test]
    async fn test_read_ergoname_from_db_not_found() {
        let result = read_ergoname_from_db("notfound").await;
        assert!(result.is_err());
    }
}
