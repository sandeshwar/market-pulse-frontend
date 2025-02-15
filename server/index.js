// use routes/symbols.js as a router
const express = require('express');
const router = express.Router();
const symbolsRouter = require('./routes/symbols');


const app = express();

app.use('/api/symbols', symbolsRouter);

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

module.exports = router;

