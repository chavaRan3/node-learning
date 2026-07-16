const request = require('supertest');
const mongoose = require('mongoose');
// 1. Destructure your imports at the top of app.test.js
const { app, server } = require('./app'); 
require('dotenv').config();

// Before running tests, ensure the database is connected
beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URI);
    }
});

// 2. Update your afterAll hook to close the server
afterAll(async () => {
    await mongoose.connection.close();
    await server.close(); // 🔥 This shuts down the server/sockets loop cleanly
});

// 🧪 TEST GROUP 1: Authentication Endpoints
describe('Auth API Endpoints', () => {
    
    it('should fail to register a user if password or username is missing', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: "testuser" }); // Missing password on purpose

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('should return a 401 Unauthorized when accessing logs without a token', async () => {
        const res = await request(app).get('/api/logs');
        
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toContain("Access denied");
    });
});
