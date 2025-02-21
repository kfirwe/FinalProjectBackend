import { Router } from "express";
import passport from "../config/passport";
import {
  registerUser,
  loginUser,
  refreshToken,
} from "../controllers/auth.controller";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh", refreshToken);

// 🔥 Google OAuth Login Route
router.get(
  "/google",
  (req, res, next) => {
    console.log("🔄 Redirecting user to Google OAuth...");
    next();
  },
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// 🔥 Google OAuth Callback Route
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    if (!req.user) {
      return res.redirect("http://localhost:5173/login?error=unauthorized");
    }

    const { user, token } = req.user as { user: any; token: string };

    console.log(" Google OAuth Success, Token:", token);

    // Redirect user to frontend with the token
    res.redirect(`http://localhost:5173/oauth-success?token=${token}`);
  }
);

export default router;
