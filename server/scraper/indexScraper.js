import { chromium } from 'playwright';

export class IndexScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isInitialized = false;
    this.scrapeCount = 0;
    this.maxScrapesBeforeRestart = 20;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.lastScrapeAt = 0;
    this.minIntervalMs = Number(process.env.SCRAPE_MIN_INTERVAL_MS || 2000);
    this._scraping = false;
  }

  /**
   * Initialize Playwright browser
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('🚀 Launching Playwright browser...');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--enable-features=NetworkService',
          '--disable-background-networking'
        ]
      });
      this.browser.on('disconnected', () => {
        console.error('🛑 Playwright browser disconnected');
        this.isInitialized = false;
      });
      
      this.page = await this.browser.newPage({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
      });
      
      // Block ads and tracking scripts to speed up page load
      await this.page.route('**/*', (route) => {
        const url = route.request().url();
        const resourceType = route.request().resourceType();
        
        // Block ads, analytics, and unnecessary resources
        const blockedDomains = [
          'doubleclick.net',
          'googlesyndication.com',
          'googletagmanager.com',
          'google-analytics.com',
          'adnxs.com',
          'pubmatic.com',
          'casalemedia.com',
          'richaudience.com',
          'seedtag.com',
          'nexx360.io',
          'ingage.tech',
          'media.net',
          'sparteo.com',
          'bqstreamer.com',
          '3lift.com',
          '4dex.io'
        ];
        
        const shouldBlock = blockedDomains.some(domain => url.includes(domain)) ||
                           resourceType === 'image' ||
                           resourceType === 'font' ||
                           resourceType === 'media';
        
        if (shouldBlock) {
          route.abort();
        } else {
          route.continue();
        }
      });
      
      await this.page.setDefaultTimeout(30000); // Reduced timeout
      this.page.on('pageerror', err => console.error('⚠️ Playwright page error:', err));
      // Reduce noise - only log critical request failures
      this.page.on('requestfailed', req => {
        const url = req.url();
        // Only log if it's the main page or data endpoints
        if (url.includes('investing.com') && !url.includes('gcode') && !url.includes('tag/js')) {
          console.error('❌ Critical request failed:', url, req.failure());
        }
      });
      
      this.isInitialized = true;
      console.log('✅ Playwright browser initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Playwright:', error);
      throw error;
    }
  }

  /**
   * Scrape indices from investing.com
   * @param {IndexManager} indexManager - Index manager instance to update
   */
  async scrapeIndices(indexManager) {
    if (this._scraping) {
      console.log('⏭️  Scrape already in progress, skipping...');
      return;
    }
    this._scraping = true;
    try {
      const now = Date.now();
      const elapsed = now - (this.lastScrapeAt || 0);
      if (elapsed < this.minIntervalMs) {
        await this.delay(this.minIntervalMs - elapsed);
      }
      await this.initialize();
      
      console.log('📊 Scraping indices from investing.com...');
      
      // Navigate to the indices page
      await this.page.goto('https://in.investing.com/indices/major-indices', {
        waitUntil: 'domcontentloaded', // Don't wait for all resources
        timeout: 30000 // Reduced timeout
      });

      console.log('✅ Page loaded, waiting for table...');

      // Wait a bit for dynamic content to load (reduced from 3s to 2s)
      await this.delay(2000);

      // Try multiple selector strategies - prioritize stable selectors without CSS module hashes
      const selectors = [
        'table tbody tr',                    // Most stable, generic table selector
        '[data-test="instrument-table"] tbody tr',  // Data-test attribute if available
        '.genTbl tbody tr',                  // Legacy class name
        'table[aria-label*="Indices"] tbody tr',   // Aria label selector
        '[data-test="dynamic-table"] tbody tr',    // Dynamic table data-test
        'tbody.datatable-v2_body__8TXQk tr'       // CSS module class - last resort
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

          // Extract data using this selector with new HTML structure
          indicesData = await this.page.evaluate((sel) => {
            const rows = document.querySelectorAll(sel);
            const indices = [];

            // Symbol mapping from display names to internal symbols
            const nameToSymbolMap = {
              'Nifty 50': 'NIFTY',
              'BSE Sensex': 'SENSEX', 
              'Nifty Bank': 'BANKNIFTY',
              'India VIX': 'INDIAVIX',
              'Dow Jones': 'DJI',
              'S&P 500': 'S&P-500',
              'Nasdaq': 'IXIC',
              'Small Cap 2000': 'RUSSELL2000',
              'S&P 500 VIX': 'VIX',
              'S&P/TSX': 'TSX',
              'Bovespa': 'BOVESPA',
              'S&P/BMV IPC': 'BMVIPC',
              'DAX': 'DAX',
              'FTSE 100': 'UKX',
              'CAC 40': 'CAC-40',
              'Euro Stoxx 50': 'EUROSTOXX50',
              'AEX': 'AEX',
              'IBEX 35': 'IBEX35',
              'FTSE MIB': 'FTSEMIB',
              'SMI': 'SMI'
            };

            // Helpers: normalize display name and produce symbol
            const cleanDisplayName = (n) => {
              return (n || '')
                .replace(/[-\s]*\(CFD\)\s*$/i, '') // Remove " - (CFD)" suffix
                .replace(/\s*Futures\s*$/i, '') // Remove trailing "Futures"
                .replace(/\s*Index\s*$/i, '') // Remove trailing "Index"
                .replace(/\s+/g, ' ') // collapse whitespace
                .trim();
            };

            const toSymbol = (n) => {
              return (n || '')
                .replace(/[^a-zA-Z0-9&]/g, '-') // keep '&', dash others
                .replace(/-+/g, '-') // collapse multiple dashes
                .replace(/^-|-$/g, '') // trim edge dashes
                .toUpperCase();
            };

            // Track duplicates after normalization/mapping
            const seenSymbols = new Set();

            rows.forEach((row, index) => {
              try {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 7) {
                  // Extract data based on new table structure
                  // Column order: checkbox, Name, Last, High, Low, Chg., Chg. %, Time
                  
                  let name = '';
                  let price = 0;
                  let change = 0;
                  let percentChange = 0;
                  let highPrice = 0;
                  let lowPrice = 0;
                  let exchange = 'Unknown';
                  let lastUpdated = Date.now();

                  // Extract name from the link's title attribute in second cell
                  if (cells[1]) {
                    const link = cells[1].querySelector('a');
                    name = link?.getAttribute('title')?.trim() || 
                           link?.textContent?.trim() || 
                           cells[1].textContent?.trim() || '';
                  }

                  // Extract price from third cell (Last)
                  if (cells[2]) {
                    const priceText = cells[2].textContent?.trim() || '';
                    price = parseFloat(priceText.replace(/[,]/g, '')) || 0;
                  }

                  // Extract high and low prices
                  if (cells[3]) {
                    const highText = cells[3].textContent?.trim() || '';
                    highPrice = parseFloat(highText.replace(/[,]/g, '')) || 0;
                  }
                  
                  if (cells[4]) {
                    const lowText = cells[4].textContent?.trim() || '';
                    lowPrice = parseFloat(lowText.replace(/[,]/g, '')) || 0;
                  }

                  // Extract change from fifth cell
                  if (cells[5]) {
                    const changeText = cells[5].textContent?.trim() || '';
                    change = parseFloat(changeText.replace(/[,]/g, '')) || 0;
                  }

                  // Extract percent change from sixth cell
                  if (cells[6]) {
                    const percentText = cells[6].textContent?.trim() || '';
                    percentChange = parseFloat(percentText.replace(/[%,]/g, '')) || 0;
                  }

                  // Extract time from seventh cell
                  if (cells[7]) {
                    const timeElement = cells[7].querySelector('time');
                    if (timeElement) {
                      const timeStr = timeElement.getAttribute('datetime');
                      if (timeStr) {
                        // Parse time like "15:29:59" or "21:27:07"
                        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
                        const now = new Date();
                        now.setHours(hours, minutes, seconds || 0, 0);
                        lastUpdated = now.getTime();
                      }
                    }
                  }

                  // Map display name to internal symbol with improved normalization
                  const baseName = cleanDisplayName(name);
                  let symbol = nameToSymbolMap[baseName] || toSymbol(baseName);

                  // Data validation - ensure reasonable market values
                  const isValidPrice = price > 0 && price < 1000000; // Most indices won't exceed 1M
                  const isValidChange = Math.abs(change) < price * 0.5; // Change shouldn't be more than 50% of price
                  const isValidPercent = Math.abs(percentChange) < 50; // Percent change shouldn't exceed 50%
                  const hasValidName = name && name.length > 0 && name.length < 100;

                  if (name && !isNaN(price) && isValidPrice && isValidChange && isValidPercent && hasValidName) {
                    if (!seenSymbols.has(symbol)) {
                      indices.push({
                        symbol,
                        name: baseName,
                        price,
                        change,
                        percent_change: percentChange,
                        exchange,
                        additional_data: {
                          highPrice,
                          lowPrice,
                          lastUpdated,
                          exchange
                        }
                      });
                      seenSymbols.add(symbol);
                    }
                  } else {
                    console.warn(`⚠️  Invalid data filtered out: ${name} - Price: ${price}, Change: ${change}, Percent: ${percentChange}`);
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
    } finally {
      // Always reset the scraping flag
      this._scraping = false;
      this.lastScrapeAt = Date.now();
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
