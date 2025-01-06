import { Router } from "express";
import { addComment, getComments } from "../controllers/comment.controller";
import { authenticate } from "../middlewares/authMiddleware";

const router = Router();

// Comment Routes
router.post("/:postId", authenticate, addComment); // Add a comment to a post
router.get("/:postId", getComments); // Get comments for a post

export default router;
