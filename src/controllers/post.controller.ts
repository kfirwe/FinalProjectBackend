import { Request, Response, NextFunction } from "express";
import Post from "../models/post.model";
import User from "../models/user.model";
import Comment from "../models/comment.model";
import multer from "multer";

// Configure Multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

export const createPost = [
  upload.single("image"), // Handle file uploads
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { title, description, price, category } = req.body;
      const userId = (req as any).user.id;

      let imageBase64: string | undefined;
      if (req.file) {
        imageBase64 = req.file.buffer.toString("base64");
      }

      const newPost = await Post.create({
        author: userId,
        title,
        description,
        category,
        price: Number(price),
        image: imageBase64,
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

    const postsWithAdditionalFields = posts.map((post: any) => ({
      ...post.toObject(),
      isLiked: userLikes.includes(post._id.toString()), // Check if post is liked by user
      commentsCount: post.comments.length, // Count comments
    }));

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
      likedOnly = false, // New query parameter to filter liked posts
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

    const total = await Post.countDocuments(filters);

    res.status(200).json({ total, posts: posts });
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
    const post = await Post.findById(id).populate(
      "author",
      "username profileImage"
    );

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    res.status(200).json(post);
  } catch (error) {
    next(error);
  }
};

export const updatePost = async (
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
      res.status(403).json({ message: "Unauthorized to update this post" });
      return;
    }

    // Get text fields from `req.body`
    const { title, price, category, description } = req.body;

    // Update text fields
    post.title = title || post.title;
    post.price = price || post.price;
    post.description = description || post.description;
    post.category = category || post.category;

    // Handle image upload (if provided)
    if (req.file) {
      post.image = req.file.buffer.toString("base64"); // Convert image to Base64
    }

    const updatedPost = await post.save();
    res.status(200).json({ message: "Post updated", post: updatedPost });
  } catch (error) {
    next(error);
  }
};

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
      post.author.toString() !== userId ||
      !user ||
      user.role !== "admin"
    ) {
      res.status(403).json({ message: "Unauthorized to delete this post" });
      return;
    }

    await post.deleteOne();

    res.status(200).json({ message: "Post deleted" });
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

    // Ensure the user is the author of the post
    // if (post.author.toString() !== userId) {
    //   res.status(403).json({ message: "Unauthorized to delete this post." });
    //   return;
    // }

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
