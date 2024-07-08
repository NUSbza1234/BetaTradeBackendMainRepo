const mongoose = require('mongoose');

const PortfolioSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    positions: [
        {
            symbol: String,
            quantity: Number,
            averagePrice: Number
        }
    ]
});

const PortfolioModel = mongoose.model('Portfolio', PortfolioSchema);

module.exports = PortfolioModel;