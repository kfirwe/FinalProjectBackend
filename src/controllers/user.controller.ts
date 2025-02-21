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
          role: updatedUser.role,
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

    // Add `isLiked` and `commentsCount` fields for each post
    const user = userId ? await User.findById(userId) : null;
    const userLikes = user ? user.likes : [];

    const postsWithAdditionalFields = posts.map((post: any) => ({
      ...post.toObject(),
      isLiked: userLikes.includes(post._id.toString()), // Check if post is liked by user
      commentsCount: post.comments.length, // Count comments for the post
    }));

    res.status(200).json(postsWithAdditionalFields);
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
    const limit = parseInt(req.query.limit as string) || 2; // Default limit to 2
    const page = parseInt(req.query.page as string) || 1; // Default page to 1
    const skip = (page - 1) * limit;

    const user = await User.findById(userId).populate("likes");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Fetch the Post objects for the liked post IDs with pagination
    const likedPosts = await Post.find({ _id: { $in: user.likes } })
      .skip(skip)
      .limit(limit);

    // Add `isLiked: true` and `commentsCount` to each post
    const postsWithAdditionalFields = likedPosts.map((post: any) => ({
      ...post.toObject(),
      isLiked: true, // All posts in likedPosts are liked by the user
      commentsCount: post.comments.length, // Count comments for the post
    }));

    res.status(200).json(postsWithAdditionalFields);
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user.id; // Extract user ID from JWT
    const user = await User.findById(userId).select("username email phone");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      _id: (user._id as string).toString(),
      username: user.username,
      email: user.email,
      phone: user.phone,
    });
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

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 10, query } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filters: any = {};

    // Optional query for searching by username or email
    if (query) {
      filters.$or = [
        { username: { $regex: query, $options: "i" } }, // Case-insensitive match
        { email: { $regex: query, $options: "i" } },
      ];
    }

    const users = await User.find(filters)
      .select("-password") // Exclude password from the response
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 }); // Sort by newest users first

    const total = await User.countDocuments(filters);

    res.status(200).json({ total, users });
  } catch (error) {
    next(error);
  }
};

// Update a user's specific field
export const updateUserField = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, field } = req.body;
    let { value } = req.body;

    // Validate input
    if (!id || !field) {
      res.status(400).json({ message: "User ID and field are required." });
      return;
    }

    // Validate Phone Number
    if (field === "phone") {
      if (!/^\d{10}$/.test(value)) {
        res.status(400).json({
          message: "Invalid phone number. only digits and maximum 10 digits",
        });
        return;
      }
    }

    // trim field value if it's a string
    if (typeof value === "string") {
      value = value.trim();
    }

    // Update the specific field in the user document
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { [field]: value },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    res
      .status(200)
      .json({ message: "User updated successfully.", user: updatedUser });
  } catch (error) {
    next(error);
  }
};

// Delete a user
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    // Prevent deleting the currently authenticated user
    const authenticatedUserId = (req as any).user.id;
    if (id === authenticatedUserId) {
      res.status(404).json({ message: "You cannot delete your own account." });
      return;
    }

    // Delete the user
    await User.findByIdAndDelete(id);

    res.status(200).json({ message: "User deleted successfully." });
  } catch (error) {
    next(error);
  }
};
