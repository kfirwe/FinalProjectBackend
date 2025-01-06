import { Request, Response, NextFunction, RequestHandler } from "express";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import User from "../models/user.model";

export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, email, password } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    res.status(201).json({ message: "User registered successfully", newUser });
  } catch (error) {
    next(error); // Pass errors to error-handling middleware
  }
};

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

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "", {
      expiresIn: "1h",
    });

    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    next(error); // Pass errors to error-handling middleware
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.body;

    // Validate token existence
    if (!token) {
      res.status(400).json({ message: "Token is required" });
      return;
    }

    // Verify token
    const user = jwt.verify(token, process.env.JWT_SECRET || "") as JwtPayload;

    if (!user || typeof user === "string") {
      res.status(403).json({ message: "Invalid token" });
      return;
    }

    // Generate new token
    const newToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET || "", {
      expiresIn: "1h",
    });

    // Respond with new token
    res.status(200).json({ message: "Token refreshed", token: newToken });
  } catch (error) {
    // Handle errors during token verification
    if (error instanceof Error && error.name === "TokenExpiredError") {
      res.status(403).json({ message: "Token expired" });
      return;
    }
    res.status(403).json({ message: "Invalid token" });
    next(error); // Pass other errors to the error handler
  }
};
