use serde::{Serialize, Deserialize};
use thiserror::Error;

/// API error types
#[derive(Error, Debug)]
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
        }
    }
}