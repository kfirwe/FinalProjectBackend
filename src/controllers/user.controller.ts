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

/**
 * @swagger
 * /api/users/uploadProfileImage:
 *   post:
 *     summary: Upload a profile image for the user
 *     description: Allows an authenticated user to upload a profile image.
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: profileImage
 *         type: file
 *         description: The profile image file to upload.
 *     responses:
 *       200:
 *         description: Profile image updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Profile image updated successfully"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: User's ID.
 *                     username:
 *                       type: string
 *                       description: User's username.
 *                     profileImage:
 *                       type: string
 *                       description: User's profile image (Base64 encoded).
 *       400:
 *         description: No image file uploaded.
 *       404:
 *         description: User not found.
 */
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

/**
 * @swagger
 * /api/users/{userId}/posts:
 *   get:
 *     summary: Get all posts of the current user
 *     description: Retrieves all posts created by the currently authenticated user.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: The ID of the user whose posts to fetch.
 *     responses:
 *       200:
 *         description: List of user posts.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                   description:
 *                     type: string
 *                   price:
 *                     type: number
 *                   image:
 *                     type: string
 *                     description: Base64 encoded image for the post.
 *       404:
 *         description: User not found.
 */
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

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get the profile of the authenticated user
 *     description: Retrieves the profile of the currently authenticated user, including their profile image.
 *     responses:
 *       200:
 *         description: User profile data with profile image (Base64 encoded).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 username:
 *                   type: string
 *                 email:
 *                   type: string
 *                 profileImage:
 *                   type: string
 *                   description: Base64 encoded profile image.
 *       404:
 *         description: User not found.
 */
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

/**
 * @swagger
 * /api/users/liked-posts:
 *   get:
 *     summary: Get posts liked by the user
 *     description: Retrieves all posts liked by the currently authenticated user.
 *     parameters:
 *       - in: query
 *         name: page
 *         type: integer
 *         description: The page number for pagination.
 *       - in: query
 *         name: limit
 *         type: integer
 *         description: The number of posts per page.
 *     responses:
 *       200:
 *         description: List of liked posts.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                   description:
 *                     type: string
 *                   price:
 *                     type: number
 *                   image:
 *                     type: string
 *                     description: Base64 encoded image for the post.
 *       404:
 *         description: User not found.
 */
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
        // If image is a file path (saved locally)
        const imagePath = path.join(__dirname, `../../${post.image}`);
        if (fs.existsSync(imagePath)) {
          const imageBuffer = fs.readFileSync(imagePath);
          imageBase64 = imageBuffer.toString("base64");
        } else {
          console.warn(`⚠️ Image file not found: ${imagePath}`);
        }
      }
      // if (post.image) {
      //   const imagePath = path.join(postImagesDir, post.image);
      //   if (fs.existsSync(imagePath)) {
      //     imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });
      //   }
      // }

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

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get the profile of the authenticated user
 *     description: Retrieve the profile details of the currently authenticated user, including their username, email, and phone number.
 *     responses:
 *       200:
 *         description: Successfully retrieved the user profile.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   description: The user's ID.
 *                   example: "60b8d48ff0c1a712a8e4c6b2"
 *                 username:
 *                   type: string
 *                   description: The user's username.
 *                   example: "john_doe"
 *                 email:
 *                   type: string
 *                   description: The user's email address.
 *                   example: "john.doe@example.com"
 *                 phone:
 *                   type: string
 *                   description: The user's phone number.
 *                   example: "1234567890"
 *       404:
 *         description: User not found.
 *       500:
 *         description: Internal server error.
 */
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

/**
 * @swagger
 * /api/users/{userId}/update:
 *   patch:
 *     summary: Update a user's profile
 *     description: Allows a user to update their profile, including the username or profile image.
 *     parameters:
 *       - in: body
 *         name: userData
 *         description: The data to update the user profile.
 *         schema:
 *           type: object
 *           properties:
 *             username:
 *               type: string
 *               description: New username to update.
 *             profileImage:
 *               type: file
 *               description: Profile image to upload.
 *     responses:
 *       200:
 *         description: Profile updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Profile updated"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: User's ID.
 *                     username:
 *                       type: string
 *                       description: User's username.
 *                     profileImage:
 *                       type: string
 *                       description: User's updated profile image (Base64 encoded).
 *       404:
 *         description: User not found.
 *       400:
 *         description: No image file uploaded.
 */
export const updateUserProfile = [
  upload.single("profileImage"), // Middleware to handle file upload
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const { username, phone } = req.body;

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

      // update phone if provided
      user.phone = phone || user.phone;

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

/**
 * @swagger
 * /api/users/all:
 *   get:
 *     summary: Get a list of all users
 *     description: Retrieve a paginated list of all users.
 *     parameters:
 *       - in: query
 *         name: page
 *         type: integer
 *         description: The page number for pagination.
 *       - in: query
 *         name: limit
 *         type: integer
 *         description: The number of users per page.
 *       - in: query
 *         name: query
 *         type: string
 *         description: The search query to search by username or email.
 *     responses:
 *       200:
 *         description: A list of all users.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   description: Total number of users.
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       username:
 *                         type: string
 *                       email:
 *                         type: string
 *                       profileImage:
 *                         type: string
 *                         description: Base64 encoded profile image for each user.
 *       404:
 *         description: No users found.
 */
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

/**
 * @swagger
 * /api/users/update:
 *   patch:
 *     summary: Update a user's field
 *     description: Allows the authenticated user to update a specific field, including their username, phone number, or profile image.
 *     parameters:
 *       - in: body
 *         name: updateUser
 *         description: The data to update the user profile.
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               description: The user's ID to update.
 *             field:
 *               type: string
 *               description: The field to update (e.g., "username", "phone", "profileImage").
 *             value:
 *               type: string
 *               description: The new value for the field to update.
 *     responses:
 *       200:
 *         description: User updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User updated successfully."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: User's ID.
 *                     username:
 *                       type: string
 *                       description: User's username.
 *                     email:
 *                       type: string
 *                       description: User's email.
 *                     profileImage:
 *                       type: string
 *                       description: User's profile image (Base64 encoded).
 *       400:
 *         description: Invalid phone number format or missing parameters.
 *       404:
 *         description: User not found.
 *       403:
 *         description: Unauthorized action.
 */
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

/**
 * @swagger
 * /api/users/{userId}/delete:
 *   delete:
 *     summary: Delete a user
 *     description: Allows an admin to delete a user. The currently authenticated user cannot delete their own account.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: The ID of the user to delete.
 *     responses:
 *       200:
 *         description: User deleted successfully.
 *       403:
 *         description: You cannot delete your own account.
 *       404:
 *         description: User not found.
 */
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
