import request from 'supertest';
import mongoose from 'mongoose';
import app from '../index'; // Your Express app
import User from '../models/user.model';
import jwt from 'jsonwebtoken';
import axios from 'axios';

// MongoDB connection setup for tests
beforeAll(async () => {
  // Use a separate test database URI to avoid conflicts with production
  const mongoUri = process.env.MONGO_URI_TEST || "mongodb://localhost:27017/test-db";
  
  // Make sure that mongoose.connect is only called once, before any tests
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
    console.log('Connected to test database');
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await User.deleteMany({});
});

afterEach(async () => {
  await User.deleteMany({});
});

// Utility function to create a test user
const createTestUser = async () => {
  const user = await User.create({
    username: 'testuser',
    email: 'testuser@example.com',
    password: 'password',
    phone: '1234567890',
  });

  return user;
};

describe('AI Controller Tests', () => {
  let testUser: any;
  let token: string;

  beforeEach(async () => {
    testUser = await createTestUser();
    token = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET || ""); // Generate a JWT token for authentication
  });

  // 1. POST /ai - Generate suggested price from Gemini AI
  describe('POST /ai', () => {
    it('should generate suggested price successfully from Gemini AI', async () => {
      const response = await request(app)
        .post('/ai')
        .set('Authorization', `Bearer ${token}`)
        .field('title', 'Test Product')
        .field('description', 'This is a test product.')
        .field('category', 'Test Category');

      expect(response.status).toBe(200);
      expect(response.body.message).toBeDefined(); // Check if the AI response is present
      expect(response.body.suggestedPrice).toBeDefined(); // Check if suggested price exists
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/ai')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Missing required fields');
    });

    it('should return 500 if AI API response has no suggestions', async () => {
      const response = await request(app)
        .post('/ai')
        .set('Authorization', `Bearer ${token}`)
        .field('title', 'Test Product')
        .field('description', 'This is a test product.')
        .field('category', 'Test Category');

      // Simulating a response with no suggestions
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('No suggestions found from AI.');
    });

    it('should return 500 if AI API response does not contain content', async () => {
      const response = await request(app)
        .post('/ai')
        .set('Authorization', `Bearer ${token}`)
        .field('title', 'Test Product')
        .field('description', 'This is a test product.')
        .field('category', 'Test Category');

      // Simulating a response with no content
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('No content returned from AI.');
    });

    it('should return 500 if AI API key is missing', async () => {
      process.env.GEMINI_API_KEY = ''; // Simulate missing API key
      const response = await request(app)
        .post('/ai')
        .set('Authorization', `Bearer ${token}`)
        .field('title', 'Test Product')
        .field('description', 'This is a test product.')
        .field('category', 'Test Category');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('AI API Key is missing');
    });

    it('should return 500 if there is an Axios error', async () => {
      // Simulate an actual Axios error (network issue, server down, etc.)
      // You can simulate the failure by disconnecting the network or using an incorrect endpoint

      // This is a real test, so we are not mocking it here.
      // If you want to simulate a failure, you'd use a non-existent endpoint or make a bad request.

      // Here we use a dummy endpoint to simulate an Axios error:
      const response = await request(app)
        .post('/ai')
        .set('Authorization', `Bearer ${token}`)
        .field('title', 'Test Product')
        .field('description', 'This is a test product.')
        .field('category', 'Test Category')
        .send();

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('An error occurred.');
    });
  });
});
