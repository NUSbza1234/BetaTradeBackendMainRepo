const request = require('supertest');
const app = require('../index');

describe('User Registration', () => {
  it('should register a new user', async () => {
    const response = await request(app)
      .post('/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('_id');
    expect(response.body.email).toBe('test@example.com');
  });

  it('should not register an already existing user', async () => {
    await request(app)
      .post('/register')
      .send({ email: 'test@example.com', password: 'password123' });

    const response = await request(app)
      .post('/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('Already registered');
  });
});