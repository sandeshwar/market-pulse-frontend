use redis::{Client, AsyncCommands, RedisError};
use std::env;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Redis connection manager
#[derive(Clone)]
pub struct RedisManager {
    client: Arc<Client>,
    connection: Arc<Mutex<Option<redis::aio::Connection>>>,
}

impl RedisManager {
    /// Creates a new Redis manager
    pub fn new() -> Result<Self, RedisError> {
        let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
        let client = Client::open(redis_url)?;

        Ok(Self {
            client: Arc::new(client),
            connection: Arc::new(Mutex::new(None)),
        })
    }

    /// Gets a Redis connection, reusing the existing one if available and healthy
    pub async fn get_connection(&self) -> Result<redis::aio::Connection, RedisError> {
        tracing::debug!("Acquiring Redis connection...");
        let start = std::time::Instant::now();
        let mut conn_guard = self.connection.lock().await;
        tracing::debug!("Lock acquired in {:?}", start.elapsed());

        // Check if we have an existing connection
        if let Some(conn) = conn_guard.take() {
            // Check if the connection is still usable
            if self.is_connection_healthy(conn).await {
                tracing::debug!("Reusing existing Redis connection");
                let new_conn = self.client.get_async_connection().await?;
                *conn_guard = Some(new_conn);
                return Ok(self.client.get_async_connection().await?);
            }
            tracing::debug!("Existing connection was unhealthy, creating new one");
        }

        // Create a new connection
        match self.client.get_async_connection().await {
            Ok(conn) => {
                tracing::info!("New Redis connection established in {:?}", start.elapsed());
                *conn_guard = Some(conn);
                Ok(self.client.get_async_connection().await?)
            },
            Err(e) => {
                tracing::error!("Failed to establish Redis connection: {}", e);
                Err(e)
            }
        }
    }

    /// Checks if a Redis connection is still healthy
    async fn is_connection_healthy(&self, mut conn: redis::aio::Connection) -> bool {
        // Simple PING check to verify connection health
        match redis::cmd("PING").query_async::<_, String>(&mut conn).await {
            Ok(pong) => pong == "PONG",
            Err(_) => false
        }
    }
    
    /// Sets a key with a value and optional expiration
    pub async fn set<T: serde::Serialize>(
        &self,
        key: &str,
        value: &T,
        expiry_seconds: Option<usize>
    ) -> Result<(), RedisError> {
        let start = std::time::Instant::now();
        tracing::debug!("Serializing value for key: {}", key);
        
        let serialized = match serde_json::to_string(value) {
            Ok(s) => s,
            Err(e) => {
                tracing::error!("Failed to serialize value for key {}: {}", key, e);
                return Err(RedisError::from((redis::ErrorKind::IoError, "Serialization error", e.to_string())));
            }
        };
        tracing::debug!("Serialization completed in {:?}", start.elapsed());

        tracing::debug!("Getting Redis connection for SET operation");
        let mut conn = self.get_connection().await?;
        tracing::debug!("Connection obtained in {:?}", start.elapsed());

        let result: Result<(), RedisError> = if let Some(expiry) = expiry_seconds {
            tracing::debug!("Setting key {} with {}s expiry", key, expiry);
            let _: () = conn.set_ex(key, serialized, expiry as u64).await?;
            Ok(())
        } else {
            tracing::debug!("Setting key {} without expiry", key);
            let _: () = conn.set(key, serialized).await?;
            Ok(())
        };

        match result {
            Ok(()) => {
                tracing::debug!("Successfully set key {} in {:?}", key, start.elapsed());
                Ok(())
            }
            Err(e) => {
                tracing::error!("Failed to set key {}: {}", key, e);
                Err(e)
            }
        }
    }
    
    /// Gets a value for a key
    pub async fn get<T: serde::de::DeserializeOwned>(
        &self,
        key: &str
    ) -> Result<Option<T>, RedisError> {
        let start = std::time::Instant::now();
        tracing::debug!("Getting Redis connection for GET operation on key: {}", key);
        
        let mut conn = self.get_connection().await?;
        tracing::debug!("Connection obtained in {:?}", start.elapsed());

        let result: Option<String> = match conn.get(key).await {
            Ok(r) => r,
            Err(e) => {
                tracing::error!("Failed to get key {}: {}", key, e);
                return Err(e);
            }
        };

        if let Some(data) = result {
            tracing::debug!("Found value for key {}, deserializing...", key);
            match serde_json::from_str(&data) {
                Ok(deserialized) => {
                    tracing::debug!("Successfully retrieved and deserialized key {} in {:?}", key, start.elapsed());
                    Ok(Some(deserialized))
                },
                Err(e) => {
                    tracing::error!("Failed to deserialize value for key {}: {}", key, e);
                    Err(RedisError::from((redis::ErrorKind::IoError, "Deserialization error", e.to_string())))
                }
            }
        } else {
            tracing::debug!("No value found for key {} (took {:?})", key, start.elapsed());
            Ok(None)
        }
    }

    /// Deletes a key from Redis
    pub async fn delete(&self, key: &str) -> Result<bool, RedisError> {
        let mut conn = self.get_connection().await?;
        let result: i64 = conn.del(key).await?;
        Ok(result > 0)
    }
}