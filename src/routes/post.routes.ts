import { Router } from "express";
import {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  updatePostField,
  deletePostByType,
  getPostAuthor,
  getCommentCount,
  getPostsLanding,
  getCommentsForPost,
  getPostOwner,
  getMyPosts,
  getNotMyPosts,
} from "../controllers/post.controller";
import { authenticate } from "../middlewares/authMiddleware";

const router = Router();

// Post Routes
router.post("/", authenticate, createPost); // Create a post
router.get("/", authenticate, getPosts); // Get all posts (with pagination)
router.get("/notmy", authenticate, getNotMyPosts); // Get not my posts (with pagination)
router.get("/my", authenticate, getMyPosts); // Get my posts (with pagination)
router.get("/landingPosts", getPostsLanding); // Get all posts to Landing Page
router.get("/:id", getPostById); // Get a single post by ID
router.put("/:id", authenticate, updatePost); // Now supports FormData! Update a post
router.patch("/update", authenticate, updatePostField); // Update specific field
router.delete("/:id", authenticate, deletePostByType); // Delete by type
router.get("/:id/author", authenticate, getPostAuthor); // Get post author
router.delete("/:id", authenticate, deletePost); // Delete a post
router.post("/:id/like", authenticate, likePost); // Like a post
router.delete("/:id/like", authenticate, unlikePost); // Unlike a post
router.get("/:id/comments/count", getCommentCount); // Get comment count
router.get("/:postId/comments", getCommentsForPost); // Get comments for a post
router.get("/:postId/owner", authenticate, getPostOwner); // Fetch post owner

export default router;
