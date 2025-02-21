import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  password?: string; //  Optional for Google OAuth users
  googleId?: string; //  Only for Google OAuth users
  phone?: string;
  role?: string;
  profileImage?: string;
  likes: string[];
}

const UserSchema: Schema = new Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: {
      type: String,
      required: function (this: IUser) {
        return !this.googleId; //  Required ONLY if user is not using Google OAuth
      },
      select: false, // 🔒 Hide password in queries for security
    },
    googleId: { type: String, unique: true, sparse: true }, //  Not required for non-Google users
    phone: { type: String, default: null }, //  Optional (Google users may not have a phone)
    role: { type: String, default: "user" },
    profileImage: { type: String },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);
