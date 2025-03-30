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

    /// Gets a Redis connection, creating one if it doesn't exist
    pub async fn get_connection(&self) -> Result<redis::aio::Connection, RedisError> {
        let mut conn_guard = self.connection.lock().await;

        if conn_guard.is_none() {
            let conn = self.client.get_async_connection().await?;
            *conn_guard = Some(conn);
        }

        // Create a new connection instead of trying to clone the existing one
        self.client.get_async_connection().await
    }
    
    /// Sets a key with a value and optional expiration
    pub async fn set<T: serde::Serialize>(
        &self,
        key: &str,
        value: &T,
        expiry_seconds: Option<usize>
    ) -> Result<(), RedisError> {
        let serialized = serde_json::to_string(value)
            .map_err(|e| RedisError::from((redis::ErrorKind::IoError, "Serialization error", e.to_string())))?;

        let mut conn = self.get_connection().await?;

        if let Some(expiry) = expiry_seconds {
            let _: () = conn.set_ex(key, serialized, expiry as u64).await?;
        } else {
            let _: () = conn.set(key, serialized).await?;
        }

        Ok(())
    }
    
    /// Gets a value for a key
    pub async fn get<T: serde::de::DeserializeOwned>(
        &self,
        key: &str
    ) -> Result<Option<T>, RedisError> {
        let mut conn = self.get_connection().await?;

        let result: Option<String> = conn.get(key).await?;

        if let Some(data) = result {
            let deserialized: T = serde_json::from_str(&data)
                .map_err(|e| RedisError::from((redis::ErrorKind::IoError, "Deserialization error", e.to_string())))?;
            Ok(Some(deserialized))
        } else {
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