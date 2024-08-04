const request = require('supertest');
const app = require('../index');

describe('Portfolio Retrieval', () => {
  it('should retrieve the user portfolio', async () => {
    const response = await request(app)
      .get('/portfolio/12345');

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('positions');
    expect(response.body.positions).toBeInstanceOf(Array);
  });

  it('should return 404 for non-existent user portfolio', async () => {
    const response = await request(app)
      .get('/portfolio/67890');

    expect(response.statusCode).toBe(404);
    expect(response.body).toBe('Portfolio not found');
  });
});
