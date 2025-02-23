import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import Post from "../models/post.model";
import User from "../models/user.model";
import Comment from "../models/comment.model";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";

//  Configure Multer for saving images locally
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/post-images/"); // Save images in this directory
  },
  filename: async (req, file, cb) => {
    try {
      const userId = (req as any).user.id;
      const user = await User.findById(userId);

      if (!user) {
        cb(new Error("User not found"), "");
        return;
      }

      const ext = path.extname(file.originalname);
      const filename = `${user._id}-${uuidv4()}${ext}`;
      cb(null, filename);
    } catch (error) {
      cb(error as Error, "");
    }
  },
});

//  File upload filter (only accept images)
const fileFilter = (req: Request, file: Express.Multer.File, cb: any) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"), false);
  }
};

//  Initialize Multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
});

//  Handle Post Creation with Image Upload
export const createPost = [
  upload.single("image"), // Handle file uploads
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { title, description, price, category } = req.body;
      const userId = (req as any).user.id;

      // Ensure user exists
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      // Construct image path if uploaded
      const imagePath = req.file
        ? `/uploads/post-images/${req.file.filename}`
        : null;

      //  Create new post
      const newPost = await Post.create({
        author: userId,
        title,
        description,
        category,
        price: Number(price),
        image: imagePath, // Save only the file path
      });

      res.status(201).json({ message: "Post created", post: newPost });
    } catch (error) {
      next(error);
    }
  },
];

export const getPostAuthor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id).populate<{
      author: { username: string; phone: string };
    }>("author", "username phone");

    if (!post || !post.author) {
      res.status(404).json({ message: "Post or author not found" });
      return;
    }

    res.status(200).json({
      authorName: post.author.username,
      authorPhone: post.author.phone,
    });
  } catch (error) {
    next(error);
  }
};

export const getPosts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      query,
      minPrice,
      maxPrice,
      category,
      likedOnly = false, // New query parameter to filter liked posts
    } = req.query;

    const userId = (req as any).user?.id; // Extract current user ID from JWT
    const skip = (Number(page) - 1) * Number(limit);

    const filters: any = {};

    // Add search filter for title
    if (query) {
      filters.title = { $regex: query, $options: "i" }; // Case-insensitive search
    }

    // Add price range filters
    if (minPrice) {
      filters.price = { ...filters.price, $gte: Number(minPrice) };
    }
    if (maxPrice) {
      filters.price = { ...filters.price, $lte: Number(maxPrice) };
    }

    // Add category filter if provided
    if (category && category !== "") {
      filters.category = category;
    }

    // If likedOnly is true, filter posts by those liked by the user
    if (likedOnly === "true" && userId) {
      const user = await User.findById(userId).populate("likes");
      if (user) {
        const likedPostIds = user.likes.map((post: any) => post._id.toString());
        filters._id = { $in: likedPostIds }; // Only include posts in user's likes list
      }
    }

    // Fetch posts with filters and populate comments and author
    const posts = await Post.find(filters)
      .populate("author", "username profileImage") // Populate author details
      .populate({ path: "comments", select: "_id" }) // Populate comments to count them
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    // Add `isLiked` and `commentsCount` fields for each post
    const user = userId ? await User.findById(userId) : null;
    const userLikes = user ? user.likes : [];

    const postsWithAdditionalFields = posts.map((post: any) => {
      let imageBase64 = "";

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

      return {
        ...post.toObject(),
        image: imageBase64, // Send base64-encoded image
        isLiked: userLikes.includes(post._id.toString()), // Check if post is liked by user
        commentsCount: post.comments.length, // Count comments
      };
    });

    const total = await Post.countDocuments(filters);

    res.status(200).json({ total, posts: postsWithAdditionalFields });
  } catch (error) {
    next(error);
  }
};

export const getPostsLanding = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      query,
      minPrice,
      maxPrice,
      category,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const filters: any = {};

    // Add search filter for title
    if (query) {
      filters.title = { $regex: query, $options: "i" }; // Case-insensitive search
    }

    // Add price range filters
    if (minPrice) {
      filters.price = { ...filters.price, $gte: Number(minPrice) };
    }
    if (maxPrice) {
      filters.price = { ...filters.price, $lte: Number(maxPrice) };
    }

    // Add category filter if provided
    if (category && category !== "") {
      filters.category = category;
    }

    // Fetch posts with filters and populate comments and author
    const posts = await Post.find(filters)
      .populate("author", "username profileImage") // Populate author details
      .populate({ path: "comments", select: "_id" }) // Populate comments to count them
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    // Process posts and convert images to base64 if stored locally
    const postsWithImages = posts.map((post: any) => {
      let imageBase64 = "";

      if (post.image) {
        const imagePath = path.join(__dirname, `../../${post.image}`);
        if (fs.existsSync(imagePath)) {
          const imageBuffer = fs.readFileSync(imagePath);
          imageBase64 = imageBuffer.toString("base64");
        } else {
          console.warn(`⚠️ Image file not found: ${imagePath}`);
        }
      }

      return {
        ...post.toObject(),
        image: imageBase64, // Convert to base64 for frontend
        commentsCount: post.comments.length, // Count comments
      };
    });

    const total = await Post.countDocuments(filters);

    res.status(200).json({ total, posts: postsWithImages });
  } catch (error) {
    next(error);
  }
};

export const getCommentsForPost = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { postId } = req.params;

    const comments = await Comment.find({ post: postId }).populate(
      "author",
      "username profileImage"
    );

    res.status(200).json({ comments });
  } catch (error) {
    next(error);
  }
};

export const getCommentCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id).populate("comments");

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    const commentCount = post.comments.length;
    res.status(200).json({ count: commentCount });
  } catch (error) {
    next(error);
  }
};

export const getPostById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id).populate<{
      author: { profileImage: string };
    }>("author", "username profileImage");

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    // Handle Post Image
    let imageBase64 = "";
    if (post.image) {
      const imagePath = path.join(
        __dirname,
        `../../uploads/post-images/${post.image}`
      );
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        imageBase64 = imageBuffer.toString("base64");
      } else {
        console.warn(`⚠️ Post Image not found: ${imagePath}`);
      }
    }

    // Handle User Profile Image
    let profileImageBase64 = "";
    if (
      post.author.profileImage &&
      !post.author.profileImage.startsWith("http")
    ) {
      const profileImagePath = path.join(
        __dirname,
        `../../uploads/user-images/${post.author.profileImage}`
      );
      if (fs.existsSync(profileImagePath)) {
        const profileImageBuffer = fs.readFileSync(profileImagePath);
        profileImageBase64 = profileImageBuffer.toString("base64");
      } else {
        console.warn(`⚠️ User Profile Image not found: ${profileImagePath}`);
      }
    } else {
      profileImageBase64 = post.author.profileImage; // Keep URL if already an external link
    }

    res.status(200).json({
      ...post.toObject(),
      image: imageBase64, // Send post image as base64
      author: {
        ...post.author,
        profileImage: profileImageBase64, // Send user profile image as base64 if local
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updatePost = [
  upload.single("image"), // Middleware to handle file upload
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      const user = await User.findById(userId);
      const post = await Post.findById(id);

      if (
        !post ||
        !user ||
        (post.author.toString() !== userId && user.role !== "admin")
      ) {
        res.status(403).json({ message: "Unauthorized to update this post" });
        return;
      }

      // Get text fields from `req.body`
      const { title, price, category, description } = req.body;

      post.title = title || post.title;
      post.price = price || post.price;
      post.description = description || post.description;
      post.category = category || post.category;

      // Handle new image upload
      if (req.file) {
        // Delete old image if it exists
        if (post.image) {
          const oldImagePath = path.join(
            __dirname,
            `../../uploads/post-images/${post.image}`
          );
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }

        // Save new image filename
        post.image = req.file.filename;
      }

      const updatedPost = await post.save();

      res.status(200).json({ message: "Post updated", post: updatedPost });
    } catch (error) {
      next(error);
    }
  },
];

export const deletePost = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const user = await User.findById(userId);
    const post = await Post.findById(id);

    if (
      !post ||
      !user ||
      (post.author.toString() !== userId && user.role !== "admin")
    ) {
      res.status(403).json({ message: "Unauthorized to delete this post" });
      return;
    }

    // Delete the image file if it exists
    if (post.image) {
      const imagePath = path.join(
        __dirname,
        `../../uploads/post-images/${post.image}`
      );
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete the post from DB
    await post.deleteOne();

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    next(error);
  }
};
export const likePost = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params; // Post ID
    const userId = (req as any).user.id; // Authenticated User ID

    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Check if the post is already liked by the user
    if (!user.likes.includes(id)) {
      user.likes.push(id); // Add post ID to user's likes array
      await user.save();
    }

    res.status(200).json({ message: "Post liked", likedPosts: user.likes });
  } catch (error) {
    next(error);
  }
};

export const unlikePost = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params; // Post ID
    const userId = (req as any).user.id; // Authenticated User ID

    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Remove the post ID from the user's likes array
    user.likes = user.likes.filter(
      (likedPostId) => likedPostId.toString() !== id
    );
    await user.save();

    res.status(200).json({ message: "Post unliked", likedPosts: user.likes });
  } catch (error) {
    next(error);
  }
};

export const updatePostField = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, field } = req.body;
    let { value } = req.body;

    // Validate input
    if (!id || !field) {
      res.status(400).json({ message: "Post ID and field are required." });
      return;
    }

    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ message: "Post not found." });
      return;
    }

    // trim value field if it's a string
    if (typeof value === "string") {
      value = value.trim();
    }

    // Ensure the user is the author of the post
    // if (post.author.toString() !== userId) {
    //   res.status(403).json({ message: "Unauthorized to update this post." });
    //   return;
    // }

    // Dynamically update the field
    post.set(field, value);

    const updatedPost = await post.save();

    res
      .status(200)
      .json({ message: "Post updated successfully.", post: updatedPost });
  } catch (error) {
    next(error);
  }
};

export const deletePostByType = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, type } = req.params;

    if (type === "user") {
      res.status(403).json({ message: "Deleting a user is not allowed here." });
      return;
    }

    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ message: "Post not found." });
      return;
    }

    // Delete the image file if it exists
    if (post.image) {
      const imagePath = path.join(
        __dirname,
        `../../uploads/post-images/${post.image}`
      );
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete the post from DB
    await post.deleteOne();

    res.status(200).json({ message: "Post deleted successfully." });
  } catch (error) {
    next(error);
  }
};

export const getPostOwner = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId).select("author");

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    res.status(200).json({ ownerId: post.author });
  } catch (error) {
    next(error);
  }
};

// Middleware to use in the route
export const uploadPostImage = upload.single("image");
