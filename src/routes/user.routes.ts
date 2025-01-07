import { Router } from "express";
import {
  getLikedPosts,
  getUserPosts,
  getUserProfile,
  updateUserProfile,
  uploadProfileImage,
} from "../controllers/user.controller";
import { authenticate } from "../middlewares/authMiddleware";

const router = Router();

// User Routes
router.get("/", authenticate, getUserProfile); // Get user profile
router.put("/", authenticate, updateUserProfile); // Update current user profile
router.get("/posts", authenticate, getUserPosts); // Fetch posts by logged-in user
router.get("/liked-posts", authenticate, getLikedPosts);
router.put("/upload-image", authenticate, uploadProfileImage);

export default router;
