import { Router } from "express";
import {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
} from "../controllers/post.controller";
import { authenticate } from "../middlewares/authMiddleware";

const router = Router();

// Post Routes
router.post("/", authenticate, createPost); // Create a post
router.get("/", getPosts); // Get all posts (with pagination)
router.get("/:id", getPostById); // Get a single post by ID
router.put("/:id", authenticate, updatePost); // Update a post
router.delete("/:id", authenticate, deletePost); // Delete a post
router.post("/:id/like", authenticate, likePost); // Like a post
router.delete("/:id/like", authenticate, unlikePost); // Unlike a post

export default router;
