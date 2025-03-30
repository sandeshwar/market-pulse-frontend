// Export modules for use in binary targets and tests
pub mod models;
pub mod services;
pub mod utils;
pub mod handlers;
pub mod state;

// Re-export AppState
pub use state::AppState;