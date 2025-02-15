const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');

const csvFilePath = path.join(__dirname, '../data', 'symbols.csv');
const jsonFilePath = path.join(__dirname, '../data', 'symbols.json');

async function csvToJson() {
    const symbols = [];
    
    return new Promise((resolve, reject) => {
        fs.createReadStream(csvFilePath)
            .pipe(csvParser())
            .on('data', (row) => {
                if (row.symbol && row.name && row.exchange && row.assetType) {
                    symbols.push({
                        symbol: row.symbol,
                        name: row.name,
                        exchange: row.exchange,
                        type: row.assetType,
                    });
                }
            })
            .on('end', () => {
                const jsonData = {
                    timestamp: Date.now(),
                    symbols: symbols,
                };

                fs.promises.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2))
                    .then(() => {
                        console.log(`Successfully converted ${symbols.length} symbols from CSV to symbols.json`);
                        resolve(jsonData);
                    })
                    .catch(reject);
            })
            .on('error', reject);
    });
}

module.exports = csvToJson;