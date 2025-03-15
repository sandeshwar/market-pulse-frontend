use std::path::Path;
use std::fs::File;
use std::io::BufReader;
use csv::Reader;
use crate::models::symbol::{Symbol, SymbolCollection, AssetType};
use crate::models::error::ApiError;
use chrono::Utc;

/// Reads symbols from a CSV file
pub fn read_symbols_from_csv<P: AsRef<Path>>(path: P) -> Result<SymbolCollection, ApiError> {
    let file = File::open(path)
        .map_err(|e| ApiError::InternalError(format!("Failed to open CSV file: {}", e)))?;
    
    let reader = BufReader::new(file);
    let mut csv_reader = Reader::from_reader(reader);
    
    let mut symbols = Vec::new();
    
    for result in csv_reader.records() {
        let record = result
            .map_err(|e| ApiError::InternalError(format!("Failed to read CSV record: {}", e)))?;
        
        if record.len() >= 4 {
            let symbol = record.get(0).unwrap_or("").to_string();
            let name = record.get(1).unwrap_or("").to_string();
            let exchange = record.get(2).unwrap_or("").to_string();
            let asset_type_str = record.get(3).unwrap_or("").to_string();
            
            // Skip empty records
            if symbol.is_empty() || name.is_empty() {
                continue;
            }
            
            // Parse asset type
            let asset_type = match asset_type_str.to_uppercase().as_str() {
                "EQUITY" => AssetType::Equity,
                "ETF" => AssetType::Etf,
                "INDEX" => AssetType::Index,
                "FOREX" => AssetType::Forex,
                "CRYPTO" => AssetType::Crypto,
                "FUTURE" => AssetType::Future,
                "OPTION" => AssetType::Option,
                "BOND" => AssetType::Bond,
                _ => AssetType::Other,
            };
            
            // Create symbol and add to collection
            let symbol = Symbol::new(symbol, name, exchange, asset_type);
            symbols.push(symbol);
        }
    }
    
    Ok(SymbolCollection {
        timestamp: Utc::now(),
        symbols,
    })
}