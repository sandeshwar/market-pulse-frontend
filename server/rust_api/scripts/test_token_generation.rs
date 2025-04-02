use std::env;
use std::error::Error;
use std::io::{self, Write};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use dotenv::dotenv;

#[derive(Debug, Serialize)]
struct TokenRequest {
    api_key: String,
    request_token: String,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    public_access_token: String,
    read_access_token: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Load environment variables from .env file
    dotenv().ok();
    
    println!("=== Paytm Money Token Generation Test ===");
    
    // Get API key from environment or prompt user
    let api_key = match env::var("PAYTM_API_KEY") {
        Ok(key) => {
            println!("Using API key from environment: {}", mask_string(&key));
            key
        },
        Err(_) => {
            print!("Enter your Paytm Money API key: ");
            io::stdout().flush()?;
            let mut input = String::new();
            io::stdin().read_line(&mut input)?;
            let key = input.trim().to_string();
            println!("Using provided API key: {}", mask_string(&key));
            key
        }
    };
    
    // Generate login URL
    let login_url = format!(
        "https://login.paytmmoney.com/merchant-login?apiKey={}&state=TEST_STATE",
        api_key
    );
    
    println!("\nPlease open the following URL in your browser and complete the login process:");
    println!("{}\n", login_url);
    println!("After successful login, you will be redirected to a URL containing a 'request_token' parameter.");
    println!("Copy the entire URL after redirection.\n");
    
    // Get the redirect URL from user
    print!("Enter the redirect URL: ");
    io::stdout().flush()?;
    let mut redirect_url = String::new();
    io::stdin().read_line(&mut redirect_url)?;
    redirect_url = redirect_url.trim().to_string();
    
    // Extract request token from URL
    let request_token = extract_request_token(&redirect_url)?;
    println!("Extracted request token: {}", mask_string(&request_token));
    
    // Exchange request token for access tokens
    println!("\nExchanging request token for access tokens...");
    let client = Client::new();
    let response = client
        .post("https://developer.paytmmoney.com/api/v1/access-token")
        .json(&TokenRequest {
            api_key: api_key.clone(),
            request_token,
        })
        .send()
        .await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await?;
        return Err(format!("Failed to get access tokens: {}", error_text).into());
    }
    
    let tokens: TokenResponse = response.json().await?;
    
    println!("\nAccess tokens generated successfully!");
    println!("\nAdd these to your .env file:");
    println!("PAYTM_API_KEY={}", api_key);
    println!("PAYTM_ACCESS_TOKEN={}", tokens.access_token);
    println!("PAYTM_PUBLIC_ACCESS_TOKEN={}", tokens.public_access_token);
    if let Some(read_token) = tokens.read_access_token {
        println!("PAYTM_READ_ACCESS_TOKEN={}", read_token);
    }
    
    println!("\nToken generation test completed successfully!");
    
    Ok(())
}

fn extract_request_token(url: &str) -> Result<String, Box<dyn Error>> {
    // Simple URL parsing to extract the request_token parameter
    let parts: Vec<&str> = url.split('?').collect();
    if parts.len() < 2 {
        return Err("Invalid URL format: no query parameters found".into());
    }
    
    let query_params = parts[1];
    for param in query_params.split('&') {
        let kv: Vec<&str> = param.split('=').collect();
        if kv.len() == 2 && kv[0] == "request_token" {
            return Ok(kv[1].to_string());
        }
    }
    
    Err("No request_token found in the URL".into())
}

// Helper function to mask sensitive information
fn mask_string(s: &str) -> String {
    if s.len() <= 8 {
        return "*".repeat(s.len());
    }
    
    let visible_chars = 4;
    let prefix = &s[0..visible_chars];
    let suffix = &s[s.len() - visible_chars..];
    
    format!("{}{}{}",
        prefix,
        "*".repeat(s.len() - (visible_chars * 2)),
        suffix
    )
}