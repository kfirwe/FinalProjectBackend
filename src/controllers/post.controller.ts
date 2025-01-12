import { Request, Response, NextFunction } from "express";
import Post from "../models/post.model";
import User from "../models/user.model";
import multer from "multer";

// Configure Multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

export const createPost = [
  upload.single("image"), // Handle file uploads
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { title, description, price } = req.body;
      const userId = (req as any).user.id;

      let imageBase64: string | undefined;
      if (req.file) {
        imageBase64 = req.file.buffer.toString("base64");
      }

      const newPost = await Post.create({
        author: userId,
        title,
        description,
        price: Number(price),
        image: imageBase64,
      });

      res.status(201).json({ message: "Post created", post: newPost });
    } catch (error) {
      next(error);
    }
  },
];

export const getPosts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 10, query, minPrice, maxPrice } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filters: any = {};

    if (query) {
      filters.title = { $regex: query, $options: "i" }; // Case-insensitive search
    }
    if (minPrice) {
      filters.price = { ...filters.price, $gte: Number(minPrice) };
    }
    if (maxPrice) {
      filters.price = { ...filters.price, $lte: Number(maxPrice) };
    }

    const posts = await Post.find(filters)
      .populate("author", "username profileImage")
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Post.countDocuments(filters);

    res.status(200).json({ total, posts });
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

    const post = await Post.findById(id);

    if (!post || post.author.toString() !== userId) {
      res.status(403).json({ message: "Unauthorized to update this post" });
      return;
    }

    const { title, image } = req.body;
    post.title = title || post.title;
    post.image = image || post.image;

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

    const post = await Post.findById(id);

    if (!post || post.author.toString() !== userId) {
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
    const { id } = req.params;
    const userId = (req as any).user.id;

    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    if (!post.likes.includes(userId)) {
      post.likes.push(userId);
      await post.save();
    }

    res.status(200).json({ message: "Post liked", likes: post.likes.length });
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
    const { id } = req.params;
    const userId = (req as any).user.id;

    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    post.likes = post.likes.filter((like) => like.toString() !== userId);
    await post.save();

    res.status(200).json({ message: "Post unliked", likes: post.likes.length });
  } catch (error) {
    next(error);
  }
};
