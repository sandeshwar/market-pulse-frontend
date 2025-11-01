import puppeteer from 'puppeteer';

export class IndexScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isInitialized = false;
    this.scrapeCount = 0;
    this.maxScrapesBeforeRestart = 20;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  /**
   * Initialize Puppeteer browser
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('🌐 Initializing Puppeteer browser...');
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-features=RendererCodeIntegrity', // macOS ARM compatibility fix
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      
      this.page = await this.browser.newPage();
      
      // Set user agent to avoid detection
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      
      // Set viewport
      await this.page.setViewport({ width: 1920, height: 1080 });
      
      this.isInitialized = true;
      console.log('✅ Puppeteer browser initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Puppeteer:', error);
      throw error;
    }
  }

  /**
   * Scrape indices from investing.com
   * @param {IndexManager} indexManager - Index manager instance to update
   */
  async scrapeIndices(indexManager) {
    try {
      await this.initialize();
      
      console.log('📊 Scraping indices from investing.com...');
      
      // Navigate to the indices page
      await this.page.goto('https://in.investing.com/indices/major-indices', {
        waitUntil: 'domcontentloaded', // Faster and more reliable than networkidle2
        timeout: 60000 // Increased timeout to 60 seconds
      });

      // Take screenshot for debugging immediately after page load
      await this.takeScreenshot('debug-page-loaded.png');
      console.log('📸 Screenshot saved after page load');

      // Wait a bit for dynamic content to load
      await this.delay(3000);

      // Try multiple selector strategies
      const selectors = [
        'table[data-test="instrument-table"] tbody tr',
        'table tbody tr',
        '.genTbl tbody tr',
        '[data-test="instrument-table"] tbody tr',
        'table[aria-label*="Indices"] tbody tr'
      ];

      let indicesData = [];
      let workingSelector = null;

      for (const selector of selectors) {
        try {
          console.log(`🔍 Trying selector: ${selector}`);
          
          // Wait for the table with this selector
          await this.page.waitForSelector(selector, {
            timeout: 5000
          });

          // Extract data using this selector
          indicesData = await this.page.evaluate((sel) => {
            const rows = document.querySelectorAll(sel);
            const indices = [];

            rows.forEach((row, index) => {
              try {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 3) {
                  // Try multiple approaches to extract data
                  let symbol = '';
                  let name = '';
                  let price = 0;
                  let change = 0;
                  let percentChange = 0;
                  let exchange = 'Unknown';

                  // Extract symbol (usually in second cell or first link)
                  if (cells[1]) {
                    const link = cells[1].querySelector('a');
                    symbol = link?.textContent?.trim() || cells[1].textContent?.trim() || '';
                  } else if (cells[0]) {
                    const link = cells[0].querySelector('a');
                    symbol = link?.textContent?.trim() || cells[0].textContent?.trim() || '';
                  }

                  // Extract name (usually in first cell)
                  if (cells[0]) {
                    name = cells[0].textContent?.trim() || symbol;
                  }

                  // Extract price (look for numeric values in cells)
                  for (let i = 2; i < cells.length; i++) {
                    const priceText = cells[i].textContent?.trim() || '';
                    const priceNum = parseFloat(priceText.replace(/[,]/g, ''));
                    if (!isNaN(priceNum) && priceNum > 0) {
                      price = priceNum;
                      
                      // Try to get change and percent change from adjacent cells
                      if (i + 1 < cells.length) {
                        const changeText = cells[i + 1].textContent?.trim() || '';
                        change = parseFloat(changeText.replace(/[,]/g, '')) || 0;
                      }
                      if (i + 2 < cells.length) {
                        const percentText = cells[i + 2].textContent?.trim() || '';
                        percentChange = parseFloat(percentText.replace(/[%,]/g, '')) || 0;
                      }
                      break;
                    }
                  }

                  // Extract exchange from last cells if available
                  if (cells.length >= 6) {
                    exchange = cells[cells.length - 1].textContent?.trim() || 'Unknown';
                  }

                  if (symbol && !isNaN(price) && price > 0) {
                    indices.push({
                      symbol: symbol.replaceAll('.', '-'), // Replace all dots with dashes
                      name: name || symbol,
                      price,
                      change,
                      percent_change: percentChange,
                      exchange
                    });
                  }
                }
              } catch (error) {
                console.warn(`Error parsing row ${index}:`, error);
              }
            });

            return indices;
          }, selector);

          if (indicesData.length > 0) {
            workingSelector = selector;
            console.log(`✅ Found ${indicesData.length} indices using selector: ${selector}`);
            break;
          }
        } catch (error) {
          console.log(`❌ Selector ${selector} failed:`, error.message);
          continue;
        }
      }

      if (indicesData.length === 0) {
        // Take screenshot for debugging
        await this.takeScreenshot('debug-failed-scrape.png');
        throw new Error('No indices data extracted - all selectors failed. Check debug-failed-scrape.png');
      }

      // Update the index manager with scraped data
      indexManager.updateIndices(indicesData);
      
      console.log(`✅ Successfully scraped ${indicesData.length} indices using selector: ${workingSelector}`);
      
      // Increment scrape count and check if we need to restart browser
      this.scrapeCount++;
      this.retryCount = 0; // Reset retry count on success
      
      if (this.scrapeCount >= this.maxScrapesBeforeRestart) {
        console.log('🔄 Restarting browser to prevent memory leaks...');
        await this.restart();
      }
      
      // Add random delay to avoid rate limiting
      await this.delay(Math.random() * 2000 + 1000); // 1-3 seconds
      
    } catch (error) {
      console.error('❌ Failed to scrape indices:', error);
      
      // Implement retry logic
      this.retryCount++;
      if (this.retryCount <= this.maxRetries) {
        console.log(`🔄 Retrying scrape (${this.retryCount}/${this.maxRetries})...`);
        await this.delay(this.retryCount * 2000); // 2s, 4s, 6s delays
        
        // Restart browser on retry
        await this.restart();
        
        // Use loop instead of recursion to prevent stack overflow
        return this.scrapeIndicesWithRetry(indexManager);
      }
      
      indexManager.markScrapeFailed(error);
      throw error;
    }
  }

  /**
   * Scrape indices with retry logic to prevent infinite recursion
   * @param {IndexManager} indexManager - Index manager instance to update
   */
  async scrapeIndicesWithRetry(indexManager) {
    while (this.retryCount <= this.maxRetries) {
      try {
        return await this.scrapeIndices(indexManager);
      } catch (error) {
        this.retryCount++;
        if (this.retryCount > this.maxRetries) {
          throw error;
        }
        console.log(`🔄 Retry ${this.retryCount}/${this.maxRetries} after error: ${error.message}`);
        await this.delay(this.retryCount * 2000);
        await this.restart();
      }
    }
  }

  /**
   * Alternative scraping method using different selectors
   * @param {IndexManager} indexManager - Index manager instance to update
   */
  async scrapeIndicesAlternative(indexManager) {
    try {
      await this.initialize();
      
      console.log('📊 Trying alternative scraping method...');
      
      // Try a different approach - look for any table with index data
      await this.page.goto('https://in.investing.com/indices/major-indices', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait a bit for dynamic content
      await this.delay(3000);

      const indicesData = await this.page.evaluate(() => {
        // Try multiple selectors
        const selectors = [
          'table tbody tr',
          '[data-test="instrument-table"] tbody tr',
          '.instrument-table tbody tr',
          'table[aria-label*="Indices"] tbody tr'
        ];

        for (const selector of selectors) {
          const rows = document.querySelectorAll(selector);
          if (rows.length > 0) {
            console.log(`Found ${rows.length} rows with selector: ${selector}`);
            
            const indices = [];
            rows.forEach(row => {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 3) {
                const textCells = Array.from(cells).map(cell => cell.textContent.trim());
                console.log('Row data:', textCells);
                
                // Try to extract data from the available cells
                const symbol = textCells[1] || textCells[0];
                const name = textCells[0] || symbol;
                const price = parseFloat(textCells[2].replace(/[,]/g, ''));
                
                if (symbol && !isNaN(price)) {
                  indices.push({
                    symbol: symbol.replace('.', '-'),
                    name,
                    price,
                    change: 0,
                    percent_change: 0,
                    exchange: 'Unknown'
                  });
                }
              }
            });
            
            if (indices.length > 0) return indices;
          }
        }
        
        return [];
      });

      if (indicesData.length > 0) {
        indexManager.updateIndices(indicesData);
        console.log(`✅ Alternative method scraped ${indicesData.length} indices`);
      } else {
        throw new Error('Alternative method also failed to extract data');
      }
      
    } catch (error) {
      console.error('❌ Alternative scraping method failed:', error);
      throw error;
    }
  }

  /**
   * Restart the browser to prevent memory leaks
   */
  async restart() {
    try {
      await this.close();
      this.isInitialized = false;
      this.scrapeCount = 0;
      await this.delay(1000); // Brief delay before restart
      await this.initialize();
      console.log('✅ Browser restarted successfully');
    } catch (error) {
      console.error('❌ Failed to restart browser:', error);
      throw error;
    }
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isInitialized = false;
      console.log('🔒 Puppeteer browser closed');
    }
  }

  /**
   * Utility function to add delays
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Take a screenshot for debugging
   * @param {string} filename - Screenshot filename
   */
  async takeScreenshot(filename = 'debug-screenshot.png') {
    if (this.page) {
      try {
        const path = `./${filename}`;
        await this.page.screenshot({ path, fullPage: true });
        console.log(`📸 Screenshot saved to: ${path}`);
      } catch (error) {
        console.error('❌ Failed to take screenshot:', error);
      }
    }
  }
}
