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

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Create a new post
 *     description: Creates a new post with an optional image upload.
 *     parameters:
 *       - in: formData
 *         name: title
 *         type: string
 *         description: Title of the post
 *       - in: formData
 *         name: description
 *         type: string
 *         description: Description of the post
 *       - in: formData
 *         name: price
 *         type: number
 *         description: Price of the product
 *       - in: formData
 *         name: category
 *         type: string
 *         description: Category of the product
 *       - in: formData
 *         name: image
 *         type: file
 *         description: Image of the post (optional)
 *     responses:
 *       201:
 *         description: Post created successfully
 *       400:
 *         description: Invalid file type or missing fields
 */
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

/**
 * @swagger
 * /api/posts/{id}/author:
 *   get:
 *     summary: Get the author of a post
 *     description: Retrieves the username and phone number of the post's author.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the post
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved author details
 *       404:
 *         description: Post or author not found
 */
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

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: Get all posts with filters
 *     description: Retrieves a list of posts with optional filters for search, price range, and category.
 *     parameters:
 *       - in: query
 *         name: query
 *         type: string
 *         description: Search term for post titles
 *       - in: query
 *         name: minPrice
 *         type: number
 *         description: Minimum price for filtering posts
 *       - in: query
 *         name: maxPrice
 *         type: number
 *         description: Maximum price for filtering posts
 *       - in: query
 *         name: category
 *         type: string
 *         description: Category for filtering posts
 *       - in: query
 *         name: likedOnly
 *         type: string
 *         description: Filter to return only liked posts (true/false)
 *     responses:
 *       200:
 *         description: Successfully retrieved posts
 *       400:
 *         description: Invalid query parameters
 */
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

/**
 * @swagger
 * /api/posts/landingPosts:
 *   get:
 *     summary: Get posts for the landing page with filtering options
 *     description: Retrieve posts based on filters such as search query, price range, and category.
 *     parameters:
 *       - in: query
 *         name: page
 *         type: integer
 *         default: 1
 *         description: The page number to retrieve.
 *       - in: query
 *         name: limit
 *         type: integer
 *         default: 10
 *         description: The number of posts per page.
 *       - in: query
 *         name: query
 *         type: string
 *         description: Search query to filter posts by title.
 *       - in: query
 *         name: minPrice
 *         type: number
 *         description: Minimum price filter.
 *       - in: query
 *         name: maxPrice
 *         type: number
 *         description: Maximum price filter.
 *       - in: query
 *         name: category
 *         type: string
 *         description: Category filter.
 *     responses:
 *       200:
 *         description: A list of posts with additional information like image in base64 and comments count.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   description: Total number of posts available.
 *                 posts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                         description: Title of the post.
 *                       description:
 *                         type: string
 *                         description: Description of the post.
 *                       price:
 *                         type: number
 *                         description: Price of the post.
 *                       category:
 *                         type: string
 *                         description: Category of the post.
 *                       image:
 *                         type: string
 *                         description: Base64-encoded image of the post.
 *                       commentsCount:
 *                         type: integer
 *                         description: Number of comments on the post.
 */
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

/**
 * @swagger
 * /api/posts/{postId}/comments:
 *   get:
 *     summary: Get comments for a specific post
 *     description: Retrieve all comments associated with a specific post.
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         description: The ID of the post.
 *     responses:
 *       200:
 *         description: A list of comments associated with the post.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 comments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       text:
 *                         type: string
 *                         description: The text content of the comment.
 *                       author:
 *                         type: object
 *                         properties:
 *                           username:
 *                             type: string
 *                             description: The username of the comment's author.
 *                           profileImage:
 *                             type: string
 *                             description: URL or base64 of the author's profile image.
 */
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

/**
 * @swagger
 * /api/posts/{id}/comments/count:
 *   get:
 *     summary: Get the count of comments for a post
 *     description: Retrieve the number of comments for a specific post.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the post.
 *     responses:
 *       200:
 *         description: The comment count for the post.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: The total number of comments on the post.
 */
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

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     summary: Get a post by ID
 *     description: Retrieve a post with its details, including the post image and author details.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the post.
 *     responses:
 *       200:
 *         description: A post with its author and comments count.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                   description: The title of the post.
 *                 description:
 *                   type: string
 *                   description: The description of the post.
 *                 price:
 *                   type: number
 *                   description: The price of the post.
 *                 category:
 *                   type: string
 *                   description: The category of the post.
 *                 image:
 *                   type: string
 *                   description: Base64-encoded image of the post.
 *                 author:
 *                   type: object
 *                   properties:
 *                     username:
 *                       type: string
 *                       description: The username of the post's author.
 *                     profileImage:
 *                       type: string
 *                       description: The profile image URL or base64 of the author.
 *                 commentsCount:
 *                   type: integer
 *                   description: The number of comments on the post.
 */
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

/**
 * @swagger
 * /api/posts/{id}:
 *   put:
 *     summary: Update a post
 *     description: Allows an authenticated user to update the post's title, description, price, or image.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the post to update.
 *       - in: formData
 *         name: title
 *         type: string
 *         description: The updated title of the post.
 *       - in: formData
 *         name: description
 *         type: string
 *         description: The updated description of the post.
 *       - in: formData
 *         name: price
 *         type: number
 *         description: The updated price of the post.
 *       - in: formData
 *         name: category
 *         type: string
 *         description: The updated category of the post.
 *       - in: formData
 *         name: image
 *         type: file
 *         description: The new image to upload for the post.
 *     responses:
 *       200:
 *         description: The updated post with its new details.
 *       403:
 *         description: Unauthorized to update the post.
 */
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

/**
 * @swagger
 * /api/posts/{id}:
 *   delete:
 *     summary: Delete a post
 *     description: Allows an authenticated user to delete their post. Only the author or an admin can delete a post.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the post to delete.
 *     responses:
 *       200:
 *         description: Post deleted successfully.
 *       403:
 *         description: Unauthorized to delete the post.
 *       404:
 *         description: Post not found.
 */
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

/**
 * @swagger
 * /api/posts/{id}/like:
 *   post:
 *     summary: Like a post
 *     description: Allows an authenticated user to like a post.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the post to like.
 *     responses:
 *       200:
 *         description: Post liked successfully.
 *       404:
 *         description: Post not found.
 */
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

/**
 * @swagger
 * /api/posts/{id}/like:
 *   delete:
 *     summary: Unlike a post
 *     description: Allows an authenticated user to unlike a post.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the post to unlike.
 *     responses:
 *       200:
 *         description: Post unliked successfully.
 *       404:
 *         description: Post not found.
 */
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

/**
 * @swagger
 * /api/posts/updateField:
 *   patch:
 *     summary: Update a specific field of a post
 *     description: Allows an authenticated user to update a specific field of a post (e.g., title, description).
 *     parameters:
 *       - in: body
 *         name: postData
 *         description: The post data to update.
 *         schema:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               description: The ID of the post to update.
 *             field:
 *               type: string
 *               description: The field to update (e.g., "title", "description").
 *             value:
 *               type: string
 *               description: The new value to set for the specified field.
 *     responses:
 *       200:
 *         description: Post updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Post updated successfully."
 *                 post:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                       description: The title of the post.
 *                     description:
 *                       type: string
 *                       description: The description of the post.
 *                     price:
 *                       type: number
 *                       description: The price of the post.
 *                     category:
 *                       type: string
 *                       description: The category of the post.
 *       400:
 *         description: Post ID and field are required.
 *       404:
 *         description: Post not found.
 */
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

/**
 * @swagger
 * /api/posts/{id}/{type}:
 *   delete:
 *     summary: Delete a post by type
 *     description: Allows an authenticated user or admin to delete a post. The user cannot delete a post if the type is "user".
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the post to delete.
 *       - in: path
 *         name: type
 *         required: true
 *         description: The type of entity (e.g., "user" to prevent deleting user posts).
 *     responses:
 *       200:
 *         description: Post deleted successfully.
 *       403:
 *         description: Unauthorized to delete the post or user posts cannot be deleted.
 *       404:
 *         description: Post not found.
 */
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

/**
 * @swagger
 * /api/posts/{postId}/owner:
 *   get:
 *     summary: Get the owner of a post
 *     description: Retrieve the owner ID of a specific post.
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         description: The ID of the post.
 *     responses:
 *       200:
 *         description: The ID of the post owner.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ownerId:
 *                   type: string
 *                   description: The ID of the post's owner.
 *       404:
 *         description: Post not found.
 */
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
