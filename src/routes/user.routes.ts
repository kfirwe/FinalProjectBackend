import { Router } from "express";
import {
  deleteUser,
  getAllUsers,
  getLikedPosts,
  getProfile,
  getUserPosts,
  getUserProfile,
  updateUserField,
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
router.get("/all-users", authenticate, getAllUsers);
router.put("/upload-image", authenticate, uploadProfileImage);
router.patch("/update", authenticate, updateUserField); // Update user field
router.delete("/delete-user/:id", authenticate, deleteUser); // Delete user
router.get("/profile", authenticate, getProfile); // Fetch user profile

export default router;
