const request = require('supertest');
const app = require('../index');

describe('Trade Execution', () => {
  it('should execute a trade and update portfolio', async () => {
    const tradeResponse = await request(app)
      .post('/trade')
      .send({ userId: '12345', symbol: 'AAPL', quantity: 10, price: 150, action: 'Buy' });

    expect(tradeResponse.statusCode).toBe(201);
    expect(tradeResponse.body).toHaveProperty('_id');

    const portfolioResponse = await request(app)
      .get('/portfolio/12345');

    expect(portfolioResponse.statusCode).toBe(200);
    expect(portfolioResponse.body.positions[0].symbol).toBe('AAPL');
    expect(portfolioResponse.body.positions[0].quantity).toBe(10);
  });
});
