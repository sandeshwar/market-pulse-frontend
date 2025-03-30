use crate::models::symbol::SymbolPrice;
use crate::models::error::ApiError;
use serde::{Serialize, Deserialize};
use tokio::sync::mpsc::{self, Sender, Receiver};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::Utc;
use std::time::Duration;
use tokio::time::interval;
use tracing::{info, error, debug};
use url::Url;

/// Paytm Money WebSocket client for real-time market data
pub struct PaytmWebSocketClient {
    api_key: String,
    access_token: String,
    #[allow(dead_code)]
    public_access_token: String,
    ws_url: String,
    subscriptions: Arc<RwLock<HashMap<String, SubscriptionInfo>>>,
    data_channel: Option<Sender<SymbolPrice>>,
}

/// Subscription information for a symbol
#[derive(Debug, Clone)]
struct SubscriptionInfo {
    #[allow(dead_code)]
    symbol: String,
    exchange_type: String,
    scrip_type: String,
    scrip_id: String,
}

/// WebSocket connection message for authentication
#[derive(Debug, Serialize, Deserialize)]
struct AuthMessage {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(rename = "apiKey")]
    api_key: String,
    #[serde(rename = "accessToken")]
    access_token: String,
}

/// WebSocket connection message for subscribing to market data
#[derive(Debug, Serialize, Deserialize)]
struct SubscribeMessage {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(rename = "preferences")]
    preferences: Vec<SubscribePreference>,
}

/// Market data preference for WebSocket subscription
#[derive(Debug, Serialize, Deserialize)]
struct SubscribePreference {
    #[serde(rename = "mode")]
    mode: String,
    #[serde(rename = "exchangeType")]
    exchange_type: String,
    #[serde(rename = "scripType")]
    scrip_type: String,
    #[serde(rename = "scripId")]
    scrip_id: String,
}

/// WebSocket market data response
#[derive(Debug, Serialize, Deserialize)]
struct WebSocketResponse {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(rename = "status")]
    status: Option<String>,
    #[serde(rename = "message")]
    message: Option<String>,
    #[serde(rename = "data")]
    data: Option<Vec<WebSocketMarketData>>,
}

/// Market data structure from WebSocket
#[derive(Debug, Serialize, Deserialize)]
struct WebSocketMarketData {
    #[serde(rename = "scripId")]
    scrip_id: String,
    #[serde(rename = "exchangeType")]
    exchange_type: String,
    #[serde(rename = "scripType")]
    scrip_type: String,
    #[serde(rename = "lastPrice")]
    last_price: f64,
    #[serde(rename = "change")]
    change: Option<f64>,
    #[serde(rename = "pChange")]
    percent_change: Option<f64>,
    #[serde(rename = "totalTradedQty")]
    total_traded_qty: Option<u64>,
    // Additional fields
    #[serde(flatten)]
    additional_data: HashMap<String, serde_json::Value>,
}

impl PaytmWebSocketClient {
    /// Creates a new Paytm Money WebSocket client
    pub fn new(api_key: String, access_token: String, public_access_token: String) -> Self {
        Self {
            api_key,
            access_token,
            public_access_token,
            ws_url: "wss://developer.paytmmoney.com/ws/v1/market-data".to_string(),
            subscriptions: Arc::new(RwLock::new(HashMap::new())),
            data_channel: None,
        }
    }

    /// Starts the WebSocket connection and returns a channel for receiving market data
    pub async fn start(&mut self) -> Result<Receiver<SymbolPrice>, ApiError> {
        // Create a channel for sending market data updates
        let (tx, rx) = mpsc::channel(100);
        self.data_channel = Some(tx.clone());

        // Clone necessary data for the WebSocket task
        let api_key = self.api_key.clone();
        let access_token = self.access_token.clone();
        let ws_url = self.ws_url.clone();
        let subscriptions = self.subscriptions.clone();

        // Start the WebSocket connection in a separate task
        tokio::spawn(async move {
            let mut reconnect_delay = Duration::from_secs(1);
            let max_reconnect_delay = Duration::from_secs(60);

            loop {
                match Self::run_websocket(
                    api_key.clone(),
                    access_token.clone(),
                    ws_url.clone(),
                    subscriptions.clone(),
                    tx.clone(),
                ).await {
                    Ok(_) => {
                        // Connection closed normally, reset reconnect delay
                        reconnect_delay = Duration::from_secs(1);
                    },
                    Err(e) => {
                        error!("WebSocket error: {}", e);
                        // Exponential backoff for reconnection
                        tokio::time::sleep(reconnect_delay).await;
                        reconnect_delay = std::cmp::min(
                            reconnect_delay.mul_f32(1.5),
                            max_reconnect_delay
                        );
                    }
                }

                info!("Reconnecting to WebSocket in {:?}...", reconnect_delay);
            }
        });

        Ok(rx)
    }

    /// Runs the WebSocket connection
    async fn run_websocket(
        api_key: String,
        access_token: String,
        ws_url: String,
        subscriptions: Arc<RwLock<HashMap<String, SubscriptionInfo>>>,
        tx: Sender<SymbolPrice>,
    ) -> Result<(), ApiError> {
        // Connect to the WebSocket server
        let url = Url::parse(&ws_url)
            .map_err(|e| ApiError::InternalError(format!("Invalid WebSocket URL: {}", e)))?;

        let (ws_stream, _) = connect_async(url).await
            .map_err(|e| ApiError::ExternalServiceError(format!("WebSocket connection failed: {}", e)))?;

        info!("Connected to Paytm Money WebSocket");

        let (mut write, mut read) = ws_stream.split();

        // Send authentication message
        let auth_message = AuthMessage {
            msg_type: "auth".to_string(),
            api_key,
            access_token,
        };

        let auth_json = serde_json::to_string(&auth_message)
            .map_err(|e| ApiError::InternalError(format!("Failed to serialize auth message: {}", e)))?;

        write.send(Message::Text(auth_json)).await
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to send auth message: {}", e)))?;

        debug!("Sent authentication message");

        // Set up a heartbeat interval
        let mut heartbeat_interval = interval(Duration::from_secs(30));

        // Subscribe to current symbols
        let current_subscriptions = subscriptions.read().await.clone();
        if !current_subscriptions.is_empty() {
            let preferences: Vec<SubscribePreference> = current_subscriptions.values()
                .map(|info| SubscribePreference {
                    mode: "FULL".to_string(),
                    exchange_type: info.exchange_type.clone(),
                    scrip_type: info.scrip_type.clone(),
                    scrip_id: info.scrip_id.clone(),
                })
                .collect();

            let subscribe_message = SubscribeMessage {
                msg_type: "subscribe".to_string(),
                preferences,
            };

            let subscribe_json = serde_json::to_string(&subscribe_message)
                .map_err(|e| ApiError::InternalError(format!("Failed to serialize subscribe message: {}", e)))?;

            write.send(Message::Text(subscribe_json)).await
                .map_err(|e| ApiError::ExternalServiceError(format!("Failed to send subscribe message: {}", e)))?;

            debug!("Sent subscription message for {} symbols", current_subscriptions.len());
        }

        // Process incoming messages
        loop {
            tokio::select! {
                // Handle incoming WebSocket messages
                msg = read.next() => {
                    match msg {
                        Some(Ok(Message::Text(text))) => {
                            // Parse and process the market data
                            if let Err(e) = Self::process_market_data(&text, &tx).await {
                                error!("Error processing market data: {}", e);
                            }
                        },
                        Some(Ok(Message::Ping(data))) => {
                            // Respond to ping with pong
                            if let Err(e) = write.send(Message::Pong(data)).await {
                                error!("Failed to send pong: {}", e);
                                return Err(ApiError::ExternalServiceError("WebSocket ping/pong failure".to_string()));
                            }
                        },
                        Some(Ok(Message::Close(_))) => {
                            info!("WebSocket connection closed by server");
                            return Ok(());
                        },
                        Some(Err(e)) => {
                            error!("WebSocket error: {}", e);
                            return Err(ApiError::ExternalServiceError(format!("WebSocket error: {}", e)));
                        },
                        None => {
                            info!("WebSocket connection closed");
                            return Ok(());
                        },
                        _ => {} // Ignore other message types
                    }
                },
                // Send heartbeat
                _ = heartbeat_interval.tick() => {
                    if let Err(e) = write.send(Message::Ping(vec![])).await {
                        error!("Failed to send heartbeat: {}", e);
                        return Err(ApiError::ExternalServiceError("WebSocket heartbeat failure".to_string()));
                    }
                    debug!("Sent heartbeat ping");
                }
            }
        }
    }

    /// Processes market data from WebSocket
    async fn process_market_data(text: &str, tx: &Sender<SymbolPrice>) -> Result<(), ApiError> {
        // Parse the WebSocket response
        let response: WebSocketResponse = serde_json::from_str(text)
            .map_err(|e| ApiError::InternalError(format!("Failed to parse WebSocket response: {}", e)))?;

        // Check if it's a data message
        if response.msg_type == "data" && response.status.as_deref() == Some("success") {
            if let Some(data_list) = response.data {
                for data in data_list {
                    // Construct the symbol from the response data
                    let symbol = format!("{}.{}", data.scrip_id, data.exchange_type);

                    // Convert to SymbolPrice
                    let symbol_price = SymbolPrice {
                        symbol,
                        price: data.last_price,
                        change: data.change.unwrap_or(0.0),
                        percent_change: data.percent_change.unwrap_or(0.0),
                        volume: data.total_traded_qty.unwrap_or(0),
                        timestamp: Some(Utc::now()),
                        additional_data: data.additional_data,
                    };

                    // Send the price update through the channel
                    if let Err(e) = tx.send(symbol_price).await {
                        error!("Failed to send price update: {}", e);
                    }
                }
            }
        } else if response.msg_type == "error" {
            error!("WebSocket error: {:?}", response.message);
        }

        Ok(())
    }

    /// Subscribes to market data for a list of symbols
    pub async fn subscribe(&self, symbols: &[String]) -> Result<(), ApiError> {
        if symbols.is_empty() {
            return Ok(());
        }

        let mut new_subscriptions = Vec::new();
        let mut new_subscription_info = HashMap::new();

        // Process each symbol
        for symbol in symbols {
            // Parse the symbol
            let (exchange_type, scrip_type, scrip_id) = self.parse_symbol(symbol);

            // Check if we're already subscribed
            let subscriptions = self.subscriptions.write().await;
            if !subscriptions.contains_key(symbol) {
                // Add to new subscriptions
                new_subscriptions.push(SubscribePreference {
                    mode: "FULL".to_string(),
                    exchange_type: exchange_type.clone(),
                    scrip_type: scrip_type.clone(),
                    scrip_id: scrip_id.clone(),
                });

                // Store subscription info
                new_subscription_info.insert(symbol.clone(), SubscriptionInfo {
                    symbol: symbol.clone(),
                    exchange_type,
                    scrip_type,
                    scrip_id,
                });
            }
        }

        // If we have new subscriptions, send a subscribe message
        if !new_subscriptions.is_empty() && self.data_channel.is_some() {
            let subscribe_message = SubscribeMessage {
                msg_type: "subscribe".to_string(),
                preferences: new_subscriptions,
            };

            // Update our subscription list
            let mut subscriptions = self.subscriptions.write().await;
            for (symbol, info) in new_subscription_info {
                subscriptions.insert(symbol, info);
            }

            // In a real implementation, we would send this message to the WebSocket
            // For now, we'll just log it
            debug!("Would subscribe to {} new symbols", subscribe_message.preferences.len());
        }

        Ok(())
    }

    /// Unsubscribes from market data for a list of symbols
    pub async fn unsubscribe(&self, symbols: &[String]) -> Result<(), ApiError> {
        if symbols.is_empty() {
            return Ok(());
        }

        let mut unsubscribe_preferences = Vec::new();

        // Process each symbol
        {
            let mut subscriptions = self.subscriptions.write().await;
            for symbol in symbols {
                if let Some(info) = subscriptions.remove(symbol) {
                    unsubscribe_preferences.push(SubscribePreference {
                        mode: "FULL".to_string(),
                        exchange_type: info.exchange_type,
                        scrip_type: info.scrip_type,
                        scrip_id: info.scrip_id,
                    });
                }
            }
        }

        // If we have symbols to unsubscribe from, send an unsubscribe message
        if !unsubscribe_preferences.is_empty() && self.data_channel.is_some() {
            let unsubscribe_message = SubscribeMessage {
                msg_type: "unsubscribe".to_string(),
                preferences: unsubscribe_preferences,
            };

            // In a real implementation, we would send this message to the WebSocket
            // For now, we'll just log it
            debug!("Would unsubscribe from {} symbols", unsubscribe_message.preferences.len());
        }

        Ok(())
    }

    /// Helper function to parse a symbol into exchange, scrip type, and scrip id
    fn parse_symbol(&self, symbol: &str) -> (String, String, String) {
        // Default values
        let mut exchange_type = "NSE".to_string();
        let mut scrip_type = "EQUITY".to_string();
        let mut scrip_id = symbol.to_string();

        // Check if the symbol contains a dot (exchange separator)
        if let Some(idx) = symbol.find('.') {
            scrip_id = symbol[0..idx].to_string();
            let exch = &symbol[idx+1..];

            if exch.eq_ignore_ascii_case("NSE") {
                exchange_type = "NSE".to_string();
            } else if exch.eq_ignore_ascii_case("BSE") {
                exchange_type = "BSE".to_string();
            }
        }

        // Determine scrip type based on symbol characteristics
        if symbol.contains("NIFTY") || symbol.contains("SENSEX") {
            scrip_type = "INDEX".to_string();
        } else if symbol.contains("ETF") {
            scrip_type = "ETF".to_string();
        }

        (exchange_type, scrip_type, scrip_id)
    }
}