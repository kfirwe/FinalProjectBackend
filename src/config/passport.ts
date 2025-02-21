import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import User from "../models/user.model"; // Adjust based on your project structure
import jwt from "jsonwebtoken";

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: "http://localhost:5000/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          user = new User({
            googleId: profile.id,
            username: profile.displayName,
            email: profile.emails?.[0]?.value,
            profileImage: profile.photos?.[0]?.value,
          });

          await user.save();
        }

        const token = jwt.sign(
          { id: user._id },
          process.env.JWT_SECRET as string,
          {
            expiresIn: "7d",
          }
        );

        done(null, { user, token });
      } catch (err) {
        done(err, false);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

export default passport;
