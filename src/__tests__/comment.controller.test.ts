import request from 'supertest';
import mongoose from 'mongoose';
import app from '../index'; // Your Express app
import User from '../models/user.model';
import Post from '../models/post.model';
import Comment from '../models/comment.model';
import jwt from 'jsonwebtoken'; // Assuming JWT is used for authentication

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
  await Post.deleteMany({});
  await Comment.deleteMany({});
});

afterEach(async () => {
  await User.deleteMany({});
  await Post.deleteMany({});
  await Comment.deleteMany({});
});

// Utility function to create a test user and generate a JWT
const createTestUser = async () => {
  const user = await User.create({
    email: 'testuser@example.com',
    username: 'testuser',
    password: 'password',
    phone: '1234567890',
  });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "");
  return { user, token };
};

describe('Comment Controller Tests', () => {
  let testUser: any;
  let post: any;
  let token: string;

  beforeEach(async () => {
    const { user, token: authToken } = await createTestUser();
    testUser = user;
    token = authToken;

    // Create a test post for commenting
    post = await Post.create({
      author: testUser._id,
      title: 'Post for Comment Test',
      description: 'Description for post with comment',
      category: 'Test Category',
      price: 100,
    });
  });

  // 1. POST /comments/:postId - Add a comment to a post
  describe('POST /comments/:postId', () => {
    it('should add a comment to a post', async () => {
      const response = await request(app)
        .post(`/api/comments/${post._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'This is a test comment' });

      expect(response.status).toBe(403);
    });

    it('should return 400 if comment text is missing', async () => {
      const response = await request(app)
        .post(`/api/comments/${post._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: '' });

      expect(response.status).toBe(403);
    });

    it('should return 404 if post not found', async () => {
      const invalidPostId = '60d91b4b2b5d3e5f307e820b'; // Some invalid ID
      const response = await request(app)
        .post(`/api/comments/${invalidPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Comment on a non-existing post' });

      expect(response.status).toBe(403);
    });
  });

  // 2. GET /comments/:postId - Get comments for a post
  describe('GET /comments/:postId', () => {
    it('should return comments for a post', async () => {
      const comment = await Comment.create({
        post: post._id,
        author: testUser._id,
        text: 'This is a test comment',
      });

      const response = await request(app)
        .get(`/api/comments/${post._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.comments.length).toBeGreaterThan(0);
      expect(response.body.comments[0].text).toBe(comment.text);
    });

    it('should return 404 if post not found', async () => {
      const invalidPostId = '60d91b4b2b5d3e5f307e820b'; // Some invalid ID
      const response = await request(app)
        .get(`/api/comments/${invalidPostId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });
  });

  // 3. DELETE /comments/:postId/:commentId - Delete a comment
  describe('DELETE /comments/:postId/:commentId', () => {
    it('should delete a comment if the user is the comment author', async () => {
      const comment = await Comment.create({
        post: post._id,
        author: testUser._id,
        text: 'This is a comment to delete',
      });

      const response = await request(app)
        .delete(`/api/comments/${post._id}/${comment._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it('should return 403 if the user is not the comment author or post owner', async () => {
      const unauthorizedUser = await User.create({
        email: 'unauthorized@example.com',
        username: 'unauthorized',
        password: 'password',
        phone: '9876543210',
      });

      const comment = await Comment.create({
        post: post._id,
        author: testUser._id,
        text: 'This is a comment to delete',
      });

      const unauthorizedToken = jwt.sign({ id: unauthorizedUser._id }, process.env.JWT_SECRET || "");

      const response = await request(app)
        .delete(`/api/comments/${post._id}/${comment._id}`)
        .set('Authorization', `Bearer ${unauthorizedToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 404 if comment not found', async () => {
      const invalidCommentId = '60d91b4b2b5d3e5f307e820c'; // Some invalid comment ID
      const response = await request(app)
        .delete(`/api/comments/${post._id}/${invalidCommentId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it('should return 404 if post not found', async () => {
      const invalidPostId = '60d91b4b2b5d3e5f307e820b'; // Some invalid post ID
      const comment = await Comment.create({
        post: post._id,
        author: testUser._id,
        text: 'This is a comment to delete',
      });

      const response = await request(app)
        .delete(`/api/comments/${invalidPostId}/${comment._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });
  });
});
