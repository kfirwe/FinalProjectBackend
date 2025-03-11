import express, { Application } from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.routes";
import commentRoutes from "./routes/comment.routes";
import postRoutes from "./routes/post.routes";
import userRoutes from "./routes/user.routes";
import aiRoutes from "./routes/ai.routes";
import { errorHandler } from "./middlewares/errorHandler";
import cookieParser from "cookie-parser";
// import passport from "./config/passport";
import session from "express-session";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

//  Ensure "uploads/post-images" directory exists
const uploadsDir = path.join(__dirname, "../uploads/post-images");
const uploadsUserDir = path.join(__dirname, "../uploads/user-images");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true }); // Create directory if it doesn't exist
}
if (!fs.existsSync(uploadsUserDir)) {
  fs.mkdirSync(uploadsUserDir, { recursive: true }); // Create directory if it doesn't exist
}

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.JWT_SECRET as string,
    resave: false,
    saveUninitialized: true,
  })
);
// app.use(passport.initialize());
// app.use(passport.session());

// Serve static images
app.use("/uploads/post-images", express.static(uploadsDir));
app.use("/uploads/user-images", express.static(uploadsUserDir));

app.use("/api/comments", commentRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);

// Error handling middleware
app.use(errorHandler);

mongoose
  .connect(process.env.MONGO_URI || "")
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB", err);
  });

export default app;
