import express from 'express';

const router = express.Router();

/**
 * Create indices routes
 * @param {IndexManager} indexManager - Index manager instance
 * @returns {Router} Express router
 */
export default function createIndicesRoutes(indexManager) {
  
  /**
   * GET /api/market-data/indices/all
   * Get all available indices with current data
   */
  router.get('/indices/all', (req, res) => {
    try {
      const data = indexManager.getAllIndices();
      const status = indexManager.getStatus();
      
      // Add appropriate headers for caching
      res.set({
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
      });
      
      // Check if we have any live data
      if (!data?.metadata || data.metadata.count === 0) {
        return res.status(503).json({
          error: 'Live data unavailable',
          message: 'Unable to fetch market data at this time. Please try again later.',
          request_id: req.id
        });
      }
      
      // If data is stale, add warning header
      if (indexManager.isDataStale()) {
        res.set('X-Data-Status', 'stale');
      }
      
      res.json(data);
    } catch (error) {
      console.error('Error in /indices/all:', error);
      res.status(500).json({
        error: 'Failed to retrieve indices data',
        message: error.message,
        request_id: req.id
      });
    }
  });

  /**
   * GET /api/market-data/indices/search
   * Search indices by symbol or name
   * Query params: q (search query)
   */
  router.get('/indices/search', (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q) {
        return res.status(400).json({
          error: 'Missing search query',
          message: 'Query parameter "q" is required',
          request_id: req.id
        });
      }
      
      const results = indexManager.searchIndices(q);
      
      res.json({
        query: q,
        results,
        count: results.length
      });
    } catch (error) {
      console.error('Error in /indices/search:', error);
      res.status(500).json({
        error: 'Search failed',
        message: error.message,
        request_id: req.id
      });
    }
  });

  /**
   * GET /api/market-data/indices/:symbol
   * Get specific index data by symbol
   */
  router.get('/indices/:symbol', (req, res) => {
    try {
      const { symbol } = req.params;
      
      if (!symbol) {
        return res.status(400).json({
          error: 'Missing symbol',
          message: 'Symbol parameter is required',
          request_id: req.id
        });
      }
      
      const indexData = indexManager.getIndex(symbol);
      
      if (!indexData) {
        return res.status(404).json({
          error: 'Index not found',
          message: `Index with symbol "${symbol}" not found`,
          request_id: req.id
        });
      }
      
      res.json({
        symbol,
        ...indexData
      });
    } catch (error) {
      console.error('Error in /indices/:symbol:', error);
      res.status(500).json({
        error: 'Failed to retrieve index data',
        message: error.message,
        request_id: req.id
      });
    }
  });

  /**
   * GET /api/market-data/indices/status
   * Get scraper status and metadata
   */
  router.get('/indices/status', (req, res) => {
    try {
      const status = indexManager.getStatus();
      
      res.json({
        status: 'ok',
        scraper: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error in /indices/status:', error);
      res.status(500).json({
        error: 'Failed to retrieve status',
        message: error.message,
        request_id: req.id
      });
    }
  });

  return router;
}
