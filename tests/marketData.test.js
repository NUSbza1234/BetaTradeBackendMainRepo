const request = require('supertest');
const app = require('../index');

describe('Market Data Retrieval', () => {
  it('should retrieve market data for a symbol', async () => {
    const response = await request(app)
      .get('/historical/AAPL');

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('bars');
    expect(response.body.bars.AAPL).toBeDefined();
  });
});
