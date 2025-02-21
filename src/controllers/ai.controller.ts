import multer from "multer";
import axios from "axios";
import { Request, Response, NextFunction } from "express";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Configure multer for form-data
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware to handle form-data
export const uploadFormData = upload.fields([
  { name: "title", maxCount: 1 },
  { name: "description", maxCount: 1 },
  { name: "category", maxCount: 1 },
]);

export const generateSuggestedPrice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, description, category } = req.body;

    if (!title || !description || !category) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      res.status(500).json({ message: "AI API Key is missing" });
      return;
    }

    // 🔥 Send request to Gemini API
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
      {
        contents: [
          {
            parts: [
              {
                text: `Given the product details: \n\nTitle: "${title}"\nDescription: "${description}"\nCategory: "${category}". Suggest a reasonable price.`,
              },
            ],
          },
        ],
      },
      {
        params: { key: API_KEY },
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    //  Log the full response to inspect structure
    // console.log("Gemini API Response:", JSON.stringify(response.data, null, 2));

    //  Ensure response has candidates
    const candidates = response.data?.candidates;
    if (!candidates || candidates.length === 0) {
      res.status(500).json({ message: "No suggestions found from AI." });
      return;
    }

    //  Ensure content exists within candidates
    const content = candidates[0]?.content;
    if (!content || !content.parts || content.parts.length === 0) {
      res.status(500).json({ message: "No content returned from AI." });
      return;
    }

    //  Extract AI response text
    const aiMessage = content.parts[0]?.text || "No response from AI.";

    //  Extract numeric price from response text
    const numericPrice = parseFloat(aiMessage.replace(/[^0-9.]/g, ""));

    //  Send AI's full response along with extracted price (if available)
    res.status(200).json({
      message: aiMessage, // Full AI response
      suggestedPrice: isNaN(numericPrice) ? null : numericPrice, // Extracted price if available
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Axios error:", error.response?.data);
      res
        .status(error.response?.status || 500)
        .json({ message: error.response?.data || "An error occurred." });
    } else {
      next(error);
    }
  }
};
