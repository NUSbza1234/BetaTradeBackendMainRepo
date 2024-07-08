const mongoose = require('mongoose');

const TradeSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    symbol: String,
    quantity: Number,
    price: Number,
    type: String,
    date: { type: Date, default: Date.now }
});

const TradeModel = mongoose.model('Trade', TradeSchema);

module.exports = TradeModel;

