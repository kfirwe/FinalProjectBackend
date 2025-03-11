import request from 'supertest';
import mongoose from 'mongoose';
import app from '../index'; // Your Express app
import User from '../models/user.model';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

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
  const hashedPassword = await bcrypt.hash('password', 10);
  const user = await User.create({
    username: 'testuser',
    email: 'testuser@example.com',
    password: hashedPassword,
    phone: '1234567890',
  });

  return user;
};

describe('Auth Controller Tests', () => {
  let testUser: any;

  beforeEach(async () => {
    testUser = await createTestUser();
  });

  // 1. POST /register - User registration
  describe('POST /register', () => {
    it('should register a new user', async () => {
      const newUser = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password',
        phone: '9876543210',
      };

      const response = await request(app)
        .post('/register')
        .send(newUser);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.newUser.email).toBe(newUser.email);
    });

    it('should return 400 if email is missing', async () => {
      const newUser = {
        username: 'newuser',
        password: 'password',
        phone: '9876543210',
      };

      const response = await request(app)
        .post('/register')
        .send(newUser);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Email is required');
    });
  });

  // 2. POST /login - User login
  describe('POST /login', () => {
    it('should login the user and return a token', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: testUser.email, password: 'password' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.token).toBeDefined();
      expect(response.body.role).toBe(testUser.role);
    });

    it('should return 404 if user not found', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: 'nonexistent@example.com', password: 'password' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });

    it('should return 401 if invalid credentials', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: testUser.email, password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  // 3. POST /refresh - Refresh token
  describe('POST /refresh', () => {
    it('should refresh the token successfully', async () => {
      const token = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET || "", { expiresIn: '1h' });

      const response = await request(app)
        .post('/refresh')
        .send({ token });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Token refreshed successfully');
      expect(response.body.token).toBeDefined();
    });

    it('should return 400 if refresh token is missing', async () => {
      const response = await request(app)
        .post('/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Refresh token is required');
    });

    it('should return 403 if the refresh token is expired', async () => {
      const expiredToken = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET || "", {
        expiresIn: '1ms',
      });

      const response = await request(app)
        .post('/refresh')
        .send({ token: expiredToken });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Refresh token has expired');
    });

    it('should return 403 if the refresh token is invalid', async () => {
      const response = await request(app)
        .post('/refresh')
        .send({ token: 'invalidtoken' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Invalid refresh token');
    });
  });
});
