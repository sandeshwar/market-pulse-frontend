const express = require('express');
const router = express.Router();
const symbolsRouter = require('./routes/symbols');
const app = express();

app.use('/api/symbols', symbolsRouter);

const server = app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

// Handle graceful shutdown
const shutdown = () => {
    console.log('\nReceived termination signal. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
};

// Handle Ctrl+C (SIGINT)
process.on('SIGINT', shutdown);
// Handle Ctrl+Z (SIGTSTP)
process.on('SIGTSTP', shutdown);
// Handle other termination signals
process.on('SIGTERM', shutdown);

module.exports = router;



