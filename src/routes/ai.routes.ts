import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import {
  generateSuggestedPrice,
  uploadFormData,
} from "../controllers/ai.controller"; // Import aiSuggest function

const router = Router();

// AI Routes
router.post("/", authenticate, uploadFormData, generateSuggestedPrice); // Suggest price from Gemini AI

export default router;
