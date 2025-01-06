import { Router } from "express";
import {
  getUserProfile,
  updateUserProfile,
} from "../controllers/user.controller";
import { authenticate } from "../middlewares/authMiddleware";

const router = Router();

// User Routes
router.get("/:id", authenticate, getUserProfile); // Get user profile
router.put("/", authenticate, updateUserProfile); // Update current user profile

export default router;
