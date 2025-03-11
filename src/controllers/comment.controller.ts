import { Request, Response, NextFunction } from "express";
import Comment from "../models/comment.model";
import Post from "../models/post.model";

/**
 * @swagger
 * /api/comments/{postId}:
 *   post:
 *     summary: Add a comment to a post
 *     description: Adds a new comment to the specified post by the logged-in user.
 *     parameters:
 *       - in: path
 *         name: postId
 *         description: ID of the post to add a comment to.
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: comment
 *         description: The text content of the comment.
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             text:
 *               type: string
 *               example: "This is a test comment."
 *     responses:
 *       201:
 *         description: Comment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Comment added successfully"
 *                 comment:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "607c72ef1f7d0e4b98d06d98"
 *                     text:
 *                       type: string
 *                       example: "This is a test comment."
 *                     author:
 *                       type: string
 *                       example: "607c72ef1f7d0e4b98d06d99"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2021-04-14T10:00:00.000Z"
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: Post not found
 */
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

/**
 * @swagger
 * /api/comments/{postId}:
 *   get:
 *     summary: Get all comments for a post
 *     description: Retrieves all comments for a given post.
 *     parameters:
 *       - in: path
 *         name: postId
 *         description: ID of the post to fetch comments for.
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Comments retrieved successfully"
 *                 comments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "607c72ef1f7d0e4b98d06d98"
 *                       text:
 *                         type: string
 *                         example: "This is a test comment."
 *                       author:
 *                         type: string
 *                         example: "607c72ef1f7d0e4b98d06d99"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2021-04-14T10:00:00.000Z"
 *       404:
 *         description: Post not found
 */
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

/**
 * @swagger
 * /api/comments/{postId}/{commentId}:
 *   delete:
 *     summary: Delete a comment
 *     description: Deletes a comment for a post by the comment's author or the post's owner.
 *     parameters:
 *       - in: path
 *         name: postId
 *         description: ID of the post to which the comment belongs.
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: commentId
 *         description: ID of the comment to delete.
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *       403:
 *         description: Not authorized to delete the comment
 *       404:
 *         description: Comment or Post not found
 */
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
