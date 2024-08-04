const request = require('supertest');
const app = require('../index'); 

describe('User Login', () => {
  it('should login an existing user', async () => {
    await request(app)
      .post('/register')
      .send({ email: 'testlogin@example.com', password: 'password123' });

    const response = await request(app)
      .post('/login')
      .send({ email: 'testlogin@example.com', password: 'password123' });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('Success');
  });

  it('should not login with wrong password', async () => {
    await request(app)
      .post('/register')
      .send({ email: 'wrongpassword@example.com', password: 'password123' });

    const response = await request(app)
      .post('/login')
      .send({ email: 'wrongpassword@example.com', password: 'wrongpassword' });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('Wrong password');
  });
});
s