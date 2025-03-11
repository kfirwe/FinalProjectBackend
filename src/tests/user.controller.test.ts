import request from 'supertest';
import mongoose from 'mongoose';
import app from '../index'; // Assuming your Express app is exported here
import User from '../models/user.model';
import Post from '../models/post.model';
import jwt from 'jsonwebtoken'; // Assuming JWT is used for authentication
import path from 'path'; // Importing path module

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
});

afterEach(async () => {
  await User.deleteMany({});
  await Post.deleteMany({});
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

describe('User Controller Tests', () => {
  let testUser: any;
  let token: string;

  beforeEach(async () => {
    const { user, token: authToken } = await createTestUser();
    testUser = user;
    token = authToken;
  });

  describe('GET /user/profile', () => {
    it('should fetch the user profile', async () => {
      const response = await request(app)
        .get('/user/profile')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.username).toBe(testUser.username);
    });

    it('should return 404 if user not found', async () => {
      const invalidToken = 'invalid_token';
      const response = await request(app)
        .get('/user/profile')
        .set('Authorization', `Bearer ${invalidToken}`);
      
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /user/update-profile', () => {
    it('should update the user profile', async () => {
      const newProfileData = { username: 'updateduser' };

      const response = await request(app)
        .put('/user/update-profile')
        .set('Authorization', `Bearer ${token}`)
        .send(newProfileData);

      expect(response.status).toBe(200);
      expect(response.body.user.username).toBe(newProfileData.username);
    });

    it('should return 400 if no data is provided', async () => {
      const response = await request(app)
        .put('/user/update-profile')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /user/posts', () => {
    it('should fetch posts by the logged-in user', async () => {
      // Create a test post with the necessary fields
      const post = await Post.create({
        author: testUser._id,  // Assuming testUser is already created
        title: 'Test Post Title',
        description: 'Test post description',
        price: 100,
        category: 'Test Category',
        likes: [],
        comments: [],
      });

      // Make the request to the API
      const response = await request(app)
        .get('/user/posts')
        .set('Authorization', `Bearer ${token}`);  // token from logged-in user

      // Assertions
      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);  // Ensure that posts are returned
      expect(response.body[0].title).toBe(post.title);  // Check that the title matches
      expect(response.body[0].description).toBe(post.description);  // Check the description
      expect(response.body[0].price).toBe(post.price);  // Ensure the price matches
      expect(response.body[0].category).toBe(post.category);  // Ensure the category matches
    });

    it('should return empty array if no posts found', async () => {
      const response = await request(app)
        .get('/user/posts')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /user/liked-posts', () => {
    it('should fetch liked posts by the logged-in user', async () => {
      // Create a test post
      const post = await Post.create({
        author: testUser._id,  // Assuming testUser is already created
        title: 'Liked Post Title',
        description: 'Liked post content',
        price: 100,
        category: 'Test Category',
        likes: [],
        comments: [],
      });
  
      // Add the post to the user's liked posts
      testUser.likes.push(post._id);
      await testUser.save();
  
      // Make the request to the API to fetch liked posts
      const response = await request(app)
        .get('/user/liked-posts')
        .set('Authorization', `Bearer ${token}`);  // token from logged-in user
  
      // Assertions
      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);  // Ensure that liked posts are returned
      expect(response.body[0].title).toBe(post.title);  // Check that the title matches
      expect(response.body[0].description).toBe(post.description);  // Check the description
      expect(response.body[0].price).toBe(post.price);  // Ensure the price matches
      expect(response.body[0].category).toBe(post.category);  // Ensure the category matches
      expect(response.body[0].isLiked).toBe(true);  // Ensure the post is liked by the user
    });
    

    it('should return empty array if no liked posts found', async () => {
      const response = await request(app)
        .get('/user/liked-posts')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /user/all-users', () => {
    it('should return a list of all users', async () => {
      const response = await request(app)
        .get('/user/all-users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBeGreaterThan(0);
    });
  });

  describe('POST /user/upload-image', () => {
    it('should upload a new profile image', async () => {
      const filePath = path.join(__dirname, 'test-image.png'); // Ensure this file exists
      
      const response = await request(app)
        .post('/user/upload-image')
        .set('Authorization', `Bearer ${token}`)
        .attach('profileImage', filePath);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Profile image updated successfully');
    });

    it('should return 400 if no image is uploaded', async () => {
      const response = await request(app)
        .post('/user/upload-image')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('No image file uploaded');
    });
  });

  describe('PATCH /user/update', () => {
    it('should update a user field', async () => {
      const updateData = { field: 'phone', value: '0987654321' };

      const response = await request(app)
        .patch('/user/update')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.user.phone).toBe(updateData.value);
    });

    it('should return 400 if the phone number is invalid', async () => {
      const updateData = { field: 'phone', value: 'invalid-phone' };

      const response = await request(app)
        .patch('/user/update')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /user/delete-user/:id', () => {
    it('should delete a user', async () => {
      const response = await request(app)
        .delete(`/user/delete-user/${testUser._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('User deleted successfully.');
    });

    it('should return 403 if attempting to delete self', async () => {
      const response = await request(app)
        .delete(`/user/delete-user/${testUser._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('You cannot delete your own account.');
    });
  });

  describe('GET /user/profile', () => {
    it('should fetch the current user profile', async () => {
      const response = await request(app)
        .get('/user/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.username).toBe(testUser.username);
    });
  });
});
