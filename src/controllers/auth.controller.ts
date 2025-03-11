import { Request, Response, NextFunction, RequestHandler } from "express";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import User from "../models/user.model";

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: This endpoint is used to register a new user with the provided username, email, password, and optional phone number.
 *     parameters:
 *       - in: body
 *         name: user
 *         description: User data to register.
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             username:
 *               type: string
 *               example: "testuser"
 *             email:
 *               type: string
 *               example: "testuser@example.com"
 *             password:
 *               type: string
 *               example: "password123"
 *             phone:
 *               type: string
 *               example: "1234567890"
 *     responses:
 *       201:
 *         description: User successfully registered
 *       400:
 *         description: Invalid input data
 */
export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name: username, email, password, phone } = req.body;

    // 🔍 Check if the user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      // 🔍 Check if the user registered via Google
      if (existingUser.googleId) {
        console.log("🔑 User exists via Google. Adding password...");

        // Hash and update the password
        const hashedPassword = await bcrypt.hash(password, 10);
        existingUser.password = hashedPassword;
        await existingUser.save();

        res.status(200).json({
          message: "Password added to Google account",
          user: existingUser,
        });
        return;
      }

      res.status(400).json({ error: "User already exists with this email." });
      return;
    }

    // 🔒 Hash the password for new users
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🆕 Create a new user
    const newUserData: any = {
      username,
      email,
      password: hashedPassword,
    };

    if (phone) {
      newUserData.phone = phone;
    }

    const newUser = await User.create(newUserData);

    res
      .status(201)
      .json({ message: "User registered successfully", user: newUser });
    return;
  } catch (error) {
    console.error("❌ Error in registerUser:", error);
    next(error);
  }
};

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login a user
 *     description: This endpoint is used to login a user with email and password and generate an access token.
 *     parameters:
 *       - in: body
 *         name: credentials
 *         description: User credentials for login.
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *               example: "testuser@example.com"
 *             password:
 *               type: string
 *               example: "password123"
 *     responses:
 *       200:
 *         description: Login successful, returns access token and role.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 role:
 *                   type: string
 *                   example: "user"
 *       401:
 *         description: Invalid credentials
 *       404:
 *         description: User not found
 */
export const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const role = user.role;

    // Compare password
    const isPasswordValid = user.password
      ? await bcrypt.compare(password, user.password)
      : false; // If no password (Google OAuth user), fail login
    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "", {
      expiresIn: "1h",
    });

    res.status(200).json({ message: "Login successful", token, role });
  } catch (error) {
    next(error); // Pass errors to error-handling middleware
  }
};

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh the access token
 *     description: This endpoint is used to refresh the user's access token by providing a valid refresh token.
 *     parameters:
 *       - in: body
 *         name: token
 *         description: Refresh token to get a new access token.
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             token:
 *               type: string
 *               example: "refresh_token_example"
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Token refreshed successfully"
 *                 token:
 *                   type: string
 *                   example: "new_access_token"
 *       400:
 *         description: Refresh token is required
 *       403:
 *         description: Invalid or expired refresh token
 */
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.body;

    // Validate token existence
    if (!token) {
      res.status(400).json({ message: "Refresh token is required" });
      return;
    }

    // Verify the token
    const secret = process.env.JWT_SECRET || "";
    let decodedToken: JwtPayload;

    try {
      decodedToken = jwt.verify(token, secret) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(403).json({ message: "Refresh token has expired" });
        return;
      }
      res.status(403).json({ message: "Invalid refresh token" });
      return;
    }

    // Ensure payload is valid
    if (!decodedToken || !decodedToken.id) {
      res.status(403).json({ message: "Invalid refresh token payload" });
      return;
    }

    // Generate a new access token
    const newToken = jwt.sign({ id: decodedToken.id }, secret, {
      expiresIn: "1h", // Adjust the expiry time as needed
    });

    // Respond with the new token
    res.status(200).json({
      message: "Token refreshed successfully",
      token: newToken,
    });
  } catch (error) {
    next(error); // Pass unexpected errors to the global error handler
  }
};
