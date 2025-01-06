import { Request, Response, NextFunction } from "express";
import Comment from "../models/comment.model";
import Post from "../models/post.model";

export const addComment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = (req as any).user.id;

    const post = await Post.findById(postId);

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    const newComment = await Comment.create({
      post: postId,
      author: userId,
      text,
    });

    post.comments.push(newComment._id as string);
    await post.save();

    res.status(201).json({ message: "Comment added", comment: newComment });
  } catch (error) {
    next(error);
  }
};

export const getComments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { postId } = req.params;

    const comments = await Comment.find({ post: postId })
      .populate("author", "username profileImage")
      .sort({ createdAt: -1 });

    res.status(200).json(comments);
  } catch (error) {
    next(error);
  }
};
