const express = require('express');
const router = express.Router();
const symbolCache = require('../services/symbolCache');

// GET /api/symbols/search?q=AAPL
router.get('/search', async (req, res) => {
    const query = req.query.q?.trim();
    if (!query || query.length < 2) {
        return res.json({ results: [] });
    }
    const results = await symbolCache.searchSymbols(query);
    res.json({ results });
});

module.exports = router;