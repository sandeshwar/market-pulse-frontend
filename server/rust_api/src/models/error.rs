use serde::{Serialize, Deserialize};
use thiserror::Error;
use axum::{response::{IntoResponse, Response}, Json};

/// API error types
#[derive(Error, Debug)]
#[allow(dead_code)]
pub enum ApiError {
    #[error("Internal server error: {0}")]
    InternalError(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("External service error: {0}")]
    ExternalServiceError(String),

    #[error("Redis error: {0}")]
    RedisError(String),

    #[error("Cache error: {0}")]
    CacheError(String),

    #[error("Service error: {0}")]
    ServiceError(String),
}

/// Error response structure for the API
#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    /// Error message
    pub error: String,
    
    /// Optional error code
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,

    /// Optional additional details
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

impl ErrorResponse {
    /// Creates a new error response
    #[allow(dead_code)]
    pub fn new(error: String) -> Self {
        Self {
            error,
            code: None,
            details: None,
        }
    }

    /// Creates a new error response with code
    pub fn with_code(error: String, code: String) -> Self {
        Self {
            error,
            code: Some(code),
            details: None,
        }
    }

    /// Creates a new error response with code and details
    #[allow(dead_code)]
    pub fn with_details(error: String, code: String, details: String) -> Self {
        Self {
            error,
            code: Some(code),
            details: Some(details),
        }
    }
}

impl From<ApiError> for ErrorResponse {
    fn from(error: ApiError) -> Self {
        match error {
            ApiError::InternalError(msg) => Self::with_code(
                msg,
                "INTERNAL_ERROR".to_string()
            ),
            ApiError::DatabaseError(msg) => Self::with_code(
                msg,
                "DATABASE_ERROR".to_string()
            ),
            ApiError::NotFound(msg) => Self::with_code(
                msg,
                "NOT_FOUND".to_string()
            ),
            ApiError::InvalidRequest(msg) => Self::with_code(
                msg,
                "INVALID_REQUEST".to_string()
            ),
            ApiError::RateLimitExceeded => Self::with_code(
                "Rate limit exceeded".to_string(),
                "RATE_LIMIT_EXCEEDED".to_string()
            ),
            ApiError::Unauthorized(msg) => Self::with_code(
                msg,
                "UNAUTHORIZED".to_string()
            ),
            ApiError::ExternalServiceError(msg) => Self::with_code(
                msg,
                "EXTERNAL_SERVICE_ERROR".to_string()
            ),
            ApiError::RedisError(msg) => Self::with_code(
                msg,
                "REDIS_ERROR".to_string()
            ),
            ApiError::CacheError(msg) => Self::with_code(
                msg,
                "CACHE_ERROR".to_string()
            ),
            ApiError::ServiceError(msg) => Self::with_code(
                msg,
                "SERVICE_ERROR".to_string()
            ),
        }
    }
}

// Implement From<redis::RedisError> for ApiError
impl From<redis::RedisError> for ApiError {
    fn from(error: redis::RedisError) -> Self {
        ApiError::RedisError(error.to_string())
    }
}

// Implement IntoResponse for ApiError to make it compatible with Axum 0.7
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status_code = match &self {
            ApiError::NotFound(_) => axum::http::StatusCode::NOT_FOUND,
            ApiError::InvalidRequest(_) => axum::http::StatusCode::BAD_REQUEST,
            ApiError::ServiceError(_) => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::DatabaseError(_) => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::ExternalServiceError(_) => axum::http::StatusCode::BAD_GATEWAY,
            ApiError::CacheError(_) => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::InternalError(_) => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::RedisError(_) => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::RateLimitExceeded => axum::http::StatusCode::TOO_MANY_REQUESTS,
            ApiError::Unauthorized(_) => axum::http::StatusCode::UNAUTHORIZED,
        };

        let body = Json(serde_json::json!({
            "error": self.to_string(),
            "code": status_code.as_u16()
        }));

        (status_code, body).into_response()
    }
}