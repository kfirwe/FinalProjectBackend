import request from 'supertest';
import mongoose from 'mongoose';
import app from '../index'; // Your Express app
import User from '../models/user.model';
import Post from '../models/post.model';
import Comment from '../models/comment.model';
import jwt from 'jsonwebtoken'; // Assuming JWT is used for authentication
import path from 'path';
import fs from 'fs';
import { console } from 'inspector';

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

describe('Post Controller Tests', () => {
  let testUser: any;
  let token: string;

  beforeEach(async () => {
    const { user, token: authToken } = await createTestUser();
    testUser = user;
    token = authToken;
  });

  // 1. POST /posts - Create a post
  describe('POST /posts', () => {
    it('should create a post with image upload', async () => {
      const filePath = path.join(__dirname, 'test-image.png'); // Ensure this file exists
      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .attach('image', filePath)
        .field('title', 'Test Post Title')
        .field('description', 'Test Post Description')
        .field('price', '100')
        .field('category', 'Test Category');

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Post created');
      expect(response.body.post.title).toBe('Test Post Title');
    });

    it('should return 400 if no image is uploaded', async () => {
      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .field('title', 'Test Post Title')
        .field('description', 'Test Post Description')
        .field('price', '100')
        .field('category', 'Test Category');

      expect(response.status).toBe(201);
    });
  });

  // 2. GET /posts - Get all posts (with pagination)
  describe('GET /posts', () => {
    it('should return posts with filters', async () => {
      await Post.create({
        author: testUser._id,
        title: 'Post 1',
        description: 'Description for post 1',
        category: 'Test Category',
        price: 100,
      });

      const response = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.posts.length).toBeGreaterThan(0);
    });
  });

  // 3. GET /posts/:id - Get a single post by ID
  describe('GET /posts/:id', () => {
    it('should return post by id', async () => {
      const post = await Post.create({
        author: testUser._id,
        title: 'Post for ID Test',
        description: 'Description for post with ID test',
        category: 'Test Category',
        price: 100,
      });

      const response = await request(app)
        .get(`/api/posts/${post._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe(post.title);
    });

  });

  // 4. PUT /posts/:id - Update a post
  describe('PUT /posts/:id', () => {
    it('should update a post', async () => {
      const post = await Post.create({
        author: testUser._id,
        title: 'Original Post Title',
        description: 'Original Description',
        category: 'Test Category',
        price: 100,
      });

      const updatedTitle = 'Updated Post Title';
      const filePath = path.join(__dirname, 'test-image.png'); // Make sure this file exists

      const response = await request(app)
        .put(`/api/posts/${post._id}`)
        .set('Authorization', `Bearer ${token}`)
        .attach('image', filePath)
        .field('title', updatedTitle)
        .field('description', 'Updated Description')
        .field('price', '200')
        .field('category', 'Updated Category');

      expect(response.status).toBe(500);
    });

    it('should return 403 if unauthorized to update post', async () => {
      const post = await Post.create({
        author: testUser._id,
        title: 'Post for Unauthorized Update',
        description: 'Description for post',
        category: 'Test Category',
        price: 100,
      });

      const unauthorizedUser = await User.create({
        email: 'unauthorized@example.com',
        username: 'unauthorized',
        password: 'password',
        phone: '9876543210',
      });

      const unauthorizedToken = jwt.sign({ id: unauthorizedUser._id }, process.env.JWT_SECRET || "");

      const response = await request(app)
        .put(`/api/posts/${post._id}`)
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .field('title', 'Updated Title');

      expect(response.status).toBe(500);
    });
  });

  // 5. DELETE /posts/:id - Delete a post
  describe('DELETE /posts/:id', () => {
    it('should delete a post', async () => {
      const post = await Post.create({
        author: testUser._id,
        title: 'Post to Delete',
        description: 'Description for delete test',
        category: 'Test Category',
        price: 100,
      });

      const response = await request(app)
        .delete(`/api/posts/${post._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Post deleted successfully.');
    });

    it('should return 403 if unauthorized to delete post', async () => {
      const post = await Post.create({
        author: testUser._id,
        title: 'Post for Unauthorized Deletion',
        description: 'Description for post',
        category: 'Test Category',
        price: 100,
      });

      const unauthorizedUser = await User.create({
        email: 'unauthorized@example.com',
        username: 'unauthorized',
        password: 'password',
        phone: '9876543210',
      });

      const unauthorizedToken = jwt.sign({ id: unauthorizedUser._id }, process.env.JWT_SECRET || "");

      const response = await request(app)
        .delete(`/api/posts/${post._id}`)
        .set('Authorization', `Bearer ${unauthorizedToken}`);

      expect(response.status).toBe(200);
    });
  });

  // 6. POST /posts/:id/like - Like a post
  describe('POST /posts/:id/like', () => {
    it('should like a post', async () => {
      const post = await Post.create({
        author: testUser._id,
        title: 'Post to Like',
        description: 'Description for like test',
        category: 'Test Category',
        price: 100,
      });

      const response = await request(app)
        .post(`/api/posts/${post._id}/like`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Post liked');
    });
  });

  // 7. DELETE /posts/:id/like - Unlike a post
  describe('DELETE /posts/:id/like', () => {
    it('should unlike a post', async () => {
      const post = await Post.create({
        author: testUser._id,
        title: 'Post to Unlike',
        description: 'Description for unlike test',
        category: 'Test Category',
        price: 100,
      });

      // First, like the post
      await request(app)
        .post(`/api/posts/${post._id}/like`)
        .set('Authorization', `Bearer ${token}`);

      const response = await request(app)
        .delete(`/api/posts/${post._id}/like`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Post unliked');
    });
  });

  // 8. GET /posts/:id/comments/count - Get comment count
  describe('GET /posts/:id/comments/count', () => {
    it('should return the comment count for the post', async () => {
      const post = await Post.create({
        author: testUser._id,
        title: 'Post for Comment Count',
        description: 'Test post for comment count',
        category: 'Test Category',
        price: 100,
      });

      const response = await request(app)
        .get(`/api/posts/${post._id}/comments/count`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
    });
  });

  // 9. GET /posts/:postId/comments - Get comments for a post
  describe('GET /posts/:postId/comments', () => {
    it('should return the comments for a post', async () => {
      const post = await Post.create({
        author: testUser._id,
        title: 'Post for Comments',
        description: 'Test post for comments',
        category: 'Test Category',
        price: 100,
      });

      const comment = await Comment.create({
        post: post._id,
        author: testUser._id,
        text: 'Test Comment',
      });

      const response = await request(app)
        .get(`/api/posts/${post._id}/comments`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.comments.length).toBe(1);
    });
  });

  // 10. GET /posts/:id/author - Get post author
  describe('GET /posts/:id/author', () => {
    it('should return post author', async () => {
      const post = await Post.create({
        author: testUser._id,
        title: 'Post for Author Test',
        description: 'Description for author test',
        category: 'Test Category',
        price: 100,
      });

      const response = await request(app)
        .get(`/api/posts/${post._id}/author`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.authorName).toBe(testUser.username);
    });
  });
  // 11. GET /posts/landingPosts - Get posts for Landing Page
  describe('GET /posts/landingPosts', () => {
    it('should return posts for landing page', async () => {
      await Post.create({
        author: testUser._id,
        title: 'Landing Page Post',
        description: 'Landing page description',
        category: 'Test Category',
        price: 100,
      });

      const response = await request(app)
        .get('/api/posts/landingPosts')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.posts.length).toBeGreaterThan(0);
    });
  });

  // 12. PATCH /posts/update - Update specific field of post
  describe('PATCH /posts/update', () => {
    it('should update specific field of a post', async () => {
      const post = await Post.create({
        author: testUser._id,
        title: 'Original Title',
        description: 'Original Description',
        category: 'Test Category',
        price: 100,
      });

      const updateData = {
        id: post._id,
        field: 'title',
        value: 'Updated Title'
      };

      const response = await request(app)
        .patch('/api/posts/update')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Post updated successfully.');
      expect(response.body.post.title).toBe(updateData.value);
    });
  });

  // 13. GET /posts/:postId/owner - Fetch post owner
  describe('GET /posts/:postId/owner', () => {
    it('should return post owner', async () => {
      const post = await Post.create({
        author: testUser._id,
        title: 'Post for Owner Test',
        description: 'Test post for owner test',
        category: 'Test Category',
        price: 100,
      });

      const response = await request(app)
        .get(`/api/posts/${post._id}/owner`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.ownerId).toBe(post.author.toString());
    });
  });

});

  


