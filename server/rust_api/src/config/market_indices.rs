use std::collections::HashMap;
use chrono::NaiveTime;
use lazy_static::lazy_static;
use crate::models::market_index::{MarketIndex, MarketStatus, MarketHours, MarketIndicesConfig};

// Define the static variables using lazy_static
lazy_static! {
    /// Defines all supported market indices with their symbols and display names
    pub static ref MARKET_INDICES: HashMap<&'static str, &'static str> = create_market_indices();

    /// Market hours for different exchanges
    pub static ref MARKET_HOURS: HashMap<&'static str, MarketHours> = create_market_hours();
}

/// Creates the market indices map
fn create_market_indices() -> HashMap<&'static str, &'static str> {
    let mut indices = HashMap::new();

    // US Indices
    indices.insert("SPX", "S&P 500");
    indices.insert("DJI", "Dow Jones");
    indices.insert("IXIC", "NASDAQ Composite");
    indices.insert("NDX", "NASDAQ 100");
    indices.insert("RUT", "Russell 2000");
    indices.insert("VIX", "CBOE Volatility Index");

    // European Indices
    indices.insert("FTSE", "FTSE 100");
    indices.insert("DAX", "DAX");
    indices.insert("CAC", "CAC 40");
    indices.insert("STOXX50E", "Euro Stoxx 50");

    // Asian Indices
    indices.insert("N225", "Nikkei 225");
    indices.insert("HSI", "Hang Seng");
    indices.insert("SSEC", "Shanghai Composite");
    indices.insert("SENSEX", "BSE SENSEX");
    indices.insert("NIFTY", "NIFTY 50");

    indices
}

/// Creates the market hours map
fn create_market_hours() -> HashMap<&'static str, MarketHours> {
    let mut hours = HashMap::new();

    // US Markets (Eastern Time)
    let us_hours = MarketHours {
        open: NaiveTime::from_hms_opt(9, 30, 0).unwrap(),
        close: NaiveTime::from_hms_opt(16, 0, 0).unwrap(),
        pre_market_open: Some(NaiveTime::from_hms_opt(4, 0, 0).unwrap()),
        after_hours_close: Some(NaiveTime::from_hms_opt(20, 0, 0).unwrap()),
        timezone: "America/New_York".to_string(),
    };

    // Apply US hours to US indices
    hours.insert("SPX", us_hours.clone());
    hours.insert("DJI", us_hours.clone());
    hours.insert("IXIC", us_hours.clone());
    hours.insert("NDX", us_hours.clone());
    hours.insert("RUT", us_hours.clone());
    hours.insert("VIX", us_hours.clone());

    // UK Market (London)
    let uk_hours = MarketHours {
        open: NaiveTime::from_hms_opt(8, 0, 0).unwrap(),
        close: NaiveTime::from_hms_opt(16, 30, 0).unwrap(),
        pre_market_open: None,
        after_hours_close: None,
        timezone: "Europe/London".to_string(),
    };
    hours.insert("FTSE", uk_hours);

    // European Markets
    let eu_hours = MarketHours {
        open: NaiveTime::from_hms_opt(9, 0, 0).unwrap(),
        close: NaiveTime::from_hms_opt(17, 30, 0).unwrap(),
        pre_market_open: None,
        after_hours_close: None,
        timezone: "Europe/Paris".to_string(),
    };
    hours.insert("DAX", eu_hours.clone());
    hours.insert("CAC", eu_hours.clone());
    hours.insert("STOXX50E", eu_hours);

    // Japanese Market (Tokyo)
    let jp_hours = MarketHours {
        open: NaiveTime::from_hms_opt(9, 0, 0).unwrap(),
        close: NaiveTime::from_hms_opt(15, 0, 0).unwrap(),
        pre_market_open: None,
        after_hours_close: None,
        timezone: "Asia/Tokyo".to_string(),
    };
    hours.insert("N225", jp_hours);

    // Hong Kong Market
    let hk_hours = MarketHours {
        open: NaiveTime::from_hms_opt(9, 30, 0).unwrap(),
        close: NaiveTime::from_hms_opt(16, 0, 0).unwrap(),
        pre_market_open: None,
        after_hours_close: None,
        timezone: "Asia/Hong_Kong".to_string(),
    };
    hours.insert("HSI", hk_hours);

    // China Market (Shanghai)
    let cn_hours = MarketHours {
        open: NaiveTime::from_hms_opt(9, 30, 0).unwrap(),
        close: NaiveTime::from_hms_opt(15, 0, 0).unwrap(),
        pre_market_open: None,
        after_hours_close: None,
        timezone: "Asia/Shanghai".to_string(),
    };
    hours.insert("SSEC", cn_hours);

    // Indian Markets
    let in_hours = MarketHours {
        open: NaiveTime::from_hms_opt(9, 15, 0).unwrap(),
        close: NaiveTime::from_hms_opt(15, 30, 0).unwrap(),
        pre_market_open: None,
        after_hours_close: None,
        timezone: "Asia/Kolkata".to_string(),
    };
    hours.insert("SENSEX", in_hours.clone());
    hours.insert("NIFTY", in_hours);

    hours
}

/// Returns a market indices configuration object
pub fn get_market_indices_config() -> MarketIndicesConfig {
    let indices = MARKET_INDICES
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();

    let market_hours = MARKET_HOURS
        .iter()
        .map(|(k, v)| (k.to_string(), v.clone()))
        .collect();

    MarketIndicesConfig {
        indices,
        market_hours,
    }
}

/// Creates default market indices with placeholder values
pub fn create_default_indices() -> HashMap<String, MarketIndex> {
    let mut indices_map = HashMap::new();

    // Add default indices with placeholder values
    for (symbol, name) in MARKET_INDICES.iter() {
        indices_map.insert(
            symbol.to_string(),
            MarketIndex::new(
                symbol.to_string(),
                name.to_string(),
                0.0,  // Default value
                0.0,  // Default change
                0.0,  // Default percent change
                MarketStatus::Closed,
            ),
        );
    }

    // Add some sample values for common indices
    if let Some(spx) = indices_map.get_mut("SPX") {
        spx.value = 4532.12;
        spx.change = 45.23;
        spx.percent_change = 1.01;
    }

    if let Some(dji) = indices_map.get_mut("DJI") {
        dji.value = 35721.34;
        dji.change = 324.56;
        dji.percent_change = 0.92;
    }

    if let Some(ixic) = indices_map.get_mut("IXIC") {
        ixic.value = 14897.23;
        ixic.change = 178.91;
        ixic.percent_change = 1.21;
    }

    if let Some(ndx) = indices_map.get_mut("NDX") {
        ndx.value = 15632.45;
        ndx.change = 203.67;
        ndx.percent_change = 1.32;
    }

    if let Some(vix) = indices_map.get_mut("VIX") {
        vix.value = 18.45;
        vix.change = -0.87;
        vix.percent_change = -4.51;
    }

    indices_map
}

/// Returns a list of all supported market index symbols
pub fn get_all_index_symbols() -> Vec<String> {
    MARKET_INDICES.keys().map(|k| k.to_string()).collect()
}

/// Returns a list of default index symbols to display
pub fn get_default_display_indices() -> Vec<String> {
    vec![
        "SPX".to_string(),
        "DJI".to_string(),
        "IXIC".to_string(),
        "NDX".to_string(),
        "VIX".to_string(),
    ]
}

/// Returns the display name for a given index symbol
pub fn get_index_display_name(symbol: &str) -> Option<String> {
    MARKET_INDICES.get(symbol).map(|name| name.to_string())
}