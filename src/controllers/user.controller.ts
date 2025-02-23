import fs from "fs";
import path from "path";
import { Request, Response, NextFunction } from "express";
import User from "../models/user.model";
import Post from "../models/post.model";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";

// Ensure the `uploads/user-images` directory exists
const userImagesDir = path.join(__dirname, "../../uploads/user-images");

// Ensure the `uploads/post-images` directory exists
const postImagesDir = path.join(__dirname, "../../uploads/post-images");
if (!fs.existsSync(userImagesDir)) {
  fs.mkdirSync(userImagesDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: userImagesDir,
  filename: (req, file, cb) => {
    const userId = (req as any).user.id;
    const uniqueFilename = `${userId}-${uuidv4()}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueFilename);
  },
});

const upload = multer({ storage });

export const uploadProfileImage = [
  upload.single("profileImage"), // Middleware to handle the image upload
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user.id;

      if (!req.file) {
        res.status(400).json({ message: "No image file uploaded" });
        return;
      }

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      // Remove old profile image if it exists
      if (user.profileImage) {
        const oldImagePath = path.join(userImagesDir, user.profileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Save new profile image filename in DB
      user.profileImage = req.file.filename;
      const updatedUser = await user.save();

      // Convert the image to Base64
      const imagePath = updatedUser.profileImage
        ? path.join(userImagesDir, updatedUser.profileImage)
        : "";
      const imageBase64 = fs.existsSync(imagePath)
        ? fs.readFileSync(imagePath, { encoding: "base64" })
        : null;

      res.status(200).json({
        message: "Profile image updated successfully",
        user: {
          id: updatedUser._id,
          email: updatedUser.email,
          username: updatedUser.username,
          phone: updatedUser.phone,
          profileImage: imageBase64, //  Return Base64 image
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

    // Convert post images to Base64
    const postsWithBase64Images = posts.map((post: any) => {
      let imageBase64: string | null = null;
      if (post.image) {
        const postImagesDir = path.join(__dirname, "../../uploads/post-images");
        const imagePath = path.join(postImagesDir, post.image);
        if (fs.existsSync(imagePath)) {
          imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });
        }
      }

      return {
        ...post.toObject(),
        isLiked: userLikes.includes(post._id.toString()), // Check if post is liked by user
        commentsCount: post.comments.length, // Count comments for the post
        image: imageBase64, //  Return post image as Base64
      };
    });

    res.status(200).json(postsWithBase64Images);
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
    const userId = (req as any).user.id;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Convert the profile image to Base64 if it exists
    const imagePath = user.profileImage
      ? path.join(userImagesDir, user.profileImage)
      : null;
    const imageBase64 =
      imagePath && fs.existsSync(imagePath)
        ? fs.readFileSync(imagePath, { encoding: "base64" })
        : null;

    res.status(200).json({
      ...user.toObject(),
      profileImage: imageBase64, //  Return Base64 image
    });
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

    // Convert post images to Base64
    const postsWithBase64Images = likedPosts.map((post: any) => {
      let imageBase64: string | null = null;
      if (post.image) {
        const imagePath = path.join(postImagesDir, post.image);
        if (fs.existsSync(imagePath)) {
          imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });
        }
      }

      return {
        ...post.toObject(),
        isLiked: true, // All posts in likedPosts are liked by the user
        commentsCount: post.comments.length, // Count comments for the post
        image: imageBase64, //  Return post image as Base64
      };
    });

    res.status(200).json(postsWithBase64Images);
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

export const updateUserProfile = [
  upload.single("profileImage"), // Middleware to handle file upload
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const { username } = req.body;

      const user = await User.findById(userId);

      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      // Delete old profile image if a new one is uploaded
      if (req.file && user.profileImage) {
        const oldImagePath = path.join(userImagesDir, user.profileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Update username if provided
      user.username = username || user.username;

      // Update profile image if a new file is uploaded
      if (req.file) {
        user.profileImage = req.file.filename;
      }

      const updatedUser = await user.save();

      // Convert the new image to Base64
      const imagePath = updatedUser.profileImage
        ? path.join(userImagesDir, updatedUser.profileImage)
        : null;
      const imageBase64 =
        imagePath && fs.existsSync(imagePath)
          ? fs.readFileSync(imagePath, { encoding: "base64" })
          : null;

      res.status(200).json({
        message: "Profile updated",
        user: {
          id: updatedUser._id,
          username: updatedUser.username,
          email: updatedUser.email,
          phone: updatedUser.phone,
          profileImage: imageBase64, //  Return Base64 image
        },
      });
    } catch (error) {
      next(error);
    }
  },
];

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

    // Convert profile images to Base64
    const usersWithBase64Images = users.map((user) => {
      let imageBase64: string | null = null;
      if (user.profileImage) {
        const imagePath = path.join(userImagesDir, user.profileImage);
        if (fs.existsSync(imagePath)) {
          imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });
        }
      }

      return {
        ...user.toObject(),
        profileImage: imageBase64, //  Return profile image as Base64
      };
    });

    const total = await User.countDocuments(filters);

    res.status(200).json({ total, users: usersWithBase64Images });
  } catch (error) {
    next(error);
  }
};

// Update a user field
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
          message: "Invalid phone number. Only digits, max 10 digits allowed.",
        });
        return;
      }
    }

    // Trim field value if it's a string
    if (typeof value === "string") {
      value = value.trim();
    }

    // If the field is `profileImage`, delete the old image before updating
    if (field === "profileImage") {
      const user = await User.findById(id);
      if (!user) {
        res.status(404).json({ message: "User not found." });
        return;
      }

      // Delete old profile image if exists
      if (user.profileImage) {
        const oldImagePath = path.join(userImagesDir, user.profileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
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

    // Convert profile image to Base64 if it exists
    let imageBase64: string | null = null;
    if (updatedUser.profileImage) {
      const imagePath = path.join(userImagesDir, updatedUser.profileImage);
      if (fs.existsSync(imagePath)) {
        imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });
      }
    }

    res.status(200).json({
      message: "User updated successfully.",
      user: {
        ...updatedUser.toObject(),
        profileImage: imageBase64, //  Return profile image as Base64
      },
    });
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
      res.status(403).json({ message: "You cannot delete your own account." });
      return;
    }

    // Delete profile image if exists
    if (user.profileImage) {
      const imagePath = path.join(userImagesDir, user.profileImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete the user
    await User.findByIdAndDelete(id);

    res.status(200).json({ message: "User deleted successfully." });
  } catch (error) {
    next(error);
  }
};
