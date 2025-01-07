import { Request, Response, NextFunction } from "express";
import User from "../models/user.model";
import Post from "../models/post.model";
import multer from "multer";

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

export const uploadProfileImage = [
  upload.single("profileImage"), // Middleware to handle the image upload
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user.id; // Extract user ID from the authenticated user (JWT)
      const file = req.file;

      if (!file) {
        res.status(400).json({ message: "No image file uploaded" });
        return;
      }

      // Assuming you save the image in Base64 format directly in the database
      const imageBase64 = file.buffer.toString("base64");

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      // Update the profile image
      user.profileImage = imageBase64;
      const updatedUser = await user.save();

      res.status(200).json({
        message: "Profile image updated successfully",
        user: {
          id: updatedUser._id,
          email: updatedUser.email,
          username: updatedUser.username,
          phone: updatedUser.phone,
          profileImage: updatedUser.profileImage,
        },
      });
    } catch (error) {
      next(error);
    }
  },
];

export const getUserPosts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user.id; // Extracted from JWT
    const posts = await Post.find({ author: userId });

    res.status(200).json(posts);
  } catch (error) {
    next(error);
  }
};

export const getUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user.id; // Extracted from JWT

    const user = await User.findById(userId).select("-password");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

export const getLikedPosts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user.id;

    const user = await User.findById(userId).populate("likes");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json(user.likes);
  } catch (error) {
    next(error);
  }
};

export const updateUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user.id; // Extracted from JWT
    const { username, profileImage } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Update fields if provided
    user.username = username || user.username;
    user.profileImage = profileImage || user.profileImage;

    const updatedUser = await user.save();

    res.status(200).json({ message: "Profile updated", user: updatedUser });
  } catch (error) {
    next(error);
  }
};
