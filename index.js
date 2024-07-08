const cors = require('cors');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const Alpaca = require('@alpacahq/alpaca-trade-api');
const WebSocket = require('ws');
const bodyParser = require('body-parser');

require('dotenv').config();

const FormDataModel = require('./models/FormData');
const TradeModel = require('./models/Trade');
const PortfolioModel = require('./models/Portfolio');

const app = express();
app.use(bodyParser.json());

const allowedOrigins = [
    'https://frontend-two-rho-60.vercel.app'
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
    preflightContinue: false,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

const alpaca = new Alpaca({
    keyId: process.env.APCA_API_KEY_ID,
    secretKey: process.env.APCA_API_SECRET_KEY,
});

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('Could not connect to MongoDB Atlas', err));

const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

let alpacaSocket;
let currentSymbol = '';
let isAuthenticated = false;

function connectAlpacaWebSocket() {
    alpacaSocket = new WebSocket(`wss://stream.data.alpaca.markets/v2/iex`);

    alpacaSocket.onopen = () => {
        console.log('Connected to Alpaca WebSocket');
        const authMsg = {
            action: 'auth',
            key: process.env.APCA_API_KEY_ID,
            secret: process.env.APCA_API_SECRET_KEY
        };
        alpacaSocket.send(JSON.stringify(authMsg));
    };

    alpacaSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received data from Alpaca:', data);
        if (data && data[0] && data[0].T === 'success' && data[0].msg === 'authenticated') {
            isAuthenticated = true;
            console.log('Alpaca WebSocket authenticated and ready to subscribe.');
        }
        if (data && data.bars) {
            console.log(`Data received for symbol ${currentSymbol}:`, data.bars);
            data.bars.forEach(bar => {
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(bar));
                    }
                });
            });
        }
    };

    alpacaSocket.onerror = (error) => {
        console.log('WebSocket error:', error);
    };

    alpacaSocket.onclose = () => {
        console.log('WebSocket connection closed. Reconnecting...');
        isAuthenticated = false;
        setTimeout(connectAlpacaWebSocket, 1000);
    };
}

function subscribeToSymbol(symbol) {
    if (alpacaSocket && isAuthenticated && alpacaSocket.readyState === WebSocket.OPEN) {
        if (currentSymbol) {
            const unsubscribeMsg = {
                action: 'unsubscribe',
                bars: [currentSymbol]
            };
            alpacaSocket.send(JSON.stringify(unsubscribeMsg));
            console.log(`Unsubscribed from ${currentSymbol}`);
        }

        const subscribeMsg = {
            action: 'subscribe',
            bars: [symbol]
        };
        alpacaSocket.send(JSON.stringify(subscribeMsg));
        currentSymbol = symbol;
        console.log(`Subscribed to ${symbol}`);
    } else {
        console.log('WebSocket is not ready. Retry subscribing in 1 second.');
        setTimeout(() => subscribeToSymbol(symbol), 10000);
    }
}

app.post('/subscribe', (req, res) => {
    const { symbol } = req.body;
    console.log(`Subscribe request received for symbol: ${symbol}`);
    subscribeToSymbol(symbol);
    res.json({ message: `Subscribed to ${symbol}` });
});

connectAlpacaWebSocket();

wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('message', (message) => {
        console.log(`Received message => ${message}`);
    });
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

app.post('/trade', async (req, res) => {
    const { userId, symbol, quantity, price, type } = req.body;
    console.log(`Trade request received: userId=${userId}, symbol=${symbol}, quantity=${quantity}, price=${price}, type=${type}`);
    try {
        const trade = new TradeModel({ userId, symbol, quantity, price, type });
        await trade.save();

        let portfolio = await PortfolioModel.findOne({ userId });
        if (!portfolio) {
            portfolio = new PortfolioModel({ userId, positions: [] });
        }

        const position = portfolio.positions.find(pos => pos.symbol === symbol);
        if (position) {
            if (type === 'buy') {
                position.quantity += quantity;
                position.averagePrice = ((position.averagePrice * position.quantity) + (price * quantity)) / (position.quantity + quantity);
            } else if (type === 'sell') {
                position.quantity -= quantity;
                if (position.quantity < 0) position.quantity = 0;
            }
        } else {
            portfolio.positions.push({ symbol, quantity, averagePrice: price });
        }

        await portfolio.save();
        res.status(201).json(trade);
    } catch (err) {
        console.error('Error processing trade request:', err);
        res.status(500).json(err.message);
    }
});

app.get('/portfolio/:userId', async (req, res) => {
    const { userId } = req.params;
    console.log(`Portfolio request received for userId: ${userId}`);
    try {
        const portfolio = await PortfolioModel.findOne({ userId });
        if (portfolio) {
            res.json(portfolio);
        } else {
            res.status(404).json("Portfolio not found");
        }
    } catch (err) {
        console.error('Error fetching portfolio:', err);
        res.status(500).json(err.message);
    }
});

app.get('/market-status', async (req, res) => {
    console.log('Market status request received');
    try {
        const response = await alpaca.getClock();
        res.json(response);
    } catch (error) {
        console.error('Error fetching market status:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/historical/:symbol', async (req, res) => {
    const { symbol } = req.params;
    console.log(`Historical data request received for symbol: ${symbol}`);
    const endDate = new Date().toISOString();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 3);
    const startISO = startDate.toISOString();

    const options = {
        method: 'GET',
        url: `https://data.alpaca.markets/v2/stocks/bars`,
        params: {
            symbols: symbol,
            timeframe: '1Day',
            start: startISO,
            end: endDate,
            limit: 1000,
            adjustment: 'raw',
            feed: 'iex',
            currency: 'USD',
            sort: 'asc'
        },
        headers: {
            accept: 'application/json',
            'APCA-API-KEY-ID': process.env.APCA_API_KEY_ID,
            'APCA-API-SECRET-KEY': process.env.APCA_API_SECRET_KEY
        }
    };

    try {
        const response = await axios.request(options);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching historical data:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    console.log(`Register request received for email: ${email}`);
    try {
        console.log('Searching for existing user...');
        const user = await FormDataModel.findOne({ email: email });
        if (user) {
            console.log(`User already registered: ${email}`);
            return res.json("Already registered");
        }
        console.log('Creating new user...');
        const newUser = new FormDataModel(req.body);
        await newUser.save();
        console.log(`User registered successfully: ${email}`);
        res.json(newUser);
    } catch (err) {
        console.error('Error during registration:', err.message);
        res.status(500).json(err.message);
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(`Login request received for email: ${email}`);
    try {
        const user = await FormDataModel.findOne({ email: email });
        if (user) {
            if (user.password === password) {
                console.log(`Login successful for email: ${email}`);
                res.json("Success");
            } else {
                console.log(`Wrong password for email: ${email}`);
                res.json("Wrong password");
            }
        } else {
            console.log(`No records found for email: ${email}`);
            res.json("No records found!");
        }
    } catch (err) {
        console.error('Error during login:', err.message);
        res.status(500).json(err.message);
    }
});

app.listen(3001, () => {
    console.log("Server listening on http://127.0.0.1:3001");
});
