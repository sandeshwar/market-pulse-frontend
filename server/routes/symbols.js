const express = require('express');
const router = express.Router();
const symbolCache = require('../services/symbolCache');

// GET /api/symbols/search?q=AAPL
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q?.trim();
        
        if (!query || query.length < 2) {
            return res.json({ results: [] });
        }

        const results = await symbolCache.searchSymbols(query);

        // Ensure we always return an array
        if (!Array.isArray(results)) {
            console.error('Invalid results from symbolCache:', results);
            return res.json({ results: [] });
        }

        res.json({ results });
    } catch (error) {
        console.error('Error in symbol search:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            results: [] 
        });
    }
});

module.exports = router;