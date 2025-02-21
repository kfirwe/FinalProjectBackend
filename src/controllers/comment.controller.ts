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
    const userId = (req as any).user?.id;

    // Check for missing input
    if (!text?.trim()) {
      res.status(400).json({ message: "Comment text is required" });
      return;
    }

    const post = await Post.findById(postId);

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    // Create the new comment
    const newComment = await Comment.create({
      post: postId,
      author: userId,
      text: text.trim(),
    });

    // Add the comment ID to the post's comments array
    post.comments.push(newComment._id as string);
    await post.save();

    res.status(201).json({
      message: "Comment added successfully",
      comment: {
        _id: newComment._id,
        text: newComment.text,
        author: userId,
        createdAt: newComment.createdAt,
      },
    });
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

    // Find all comments for the given post and populate author details
    const comments = await Comment.find({ post: postId })
      .populate("author", "username profileImage") // Populate author data
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Comments retrieved successfully",
      comments,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { postId, commentId } = req.params;
    const userId = (req as any).user.id;

    // Find the comment
    const comment = await Comment.findById(commentId);
    if (!comment) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    // Find the post and check if the current user is the owner
    const post = await Post.findById(postId);
    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    const isCommentAuthor = comment.author.toString() === userId;
    const isPostOwner = post.author.toString() === userId;

    // Allow deletion only if the user is either the comment author or the post owner
    if (!isCommentAuthor && !isPostOwner) {
      res
        .status(403)
        .json({ message: "You are not authorized to delete this comment" });
      return;
    }

    // Remove the comment ID from the post's comments array
    await Post.findByIdAndUpdate(postId, { $pull: { comments: commentId } });

    // Delete the comment
    await comment.deleteOne();

    res.status(200).json({ message: "Comment deleted successfully" });
  } catch (error) {
    next(error);
  }
};
