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
    const { name: username, email, password, phone } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUserData: any = {
      username,
      email,
      password: hashedPassword,
    };

    if (phone) {
      newUserData.phone = phone;
    }

    const newUser = await User.create(newUserData);

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
