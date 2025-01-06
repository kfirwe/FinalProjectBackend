import mongoose, { Schema, Document } from "mongoose";

export interface IPost extends Document {
  author: string;
  text: string;
  image?: string;
  likes: string[];
  comments: string[];
}

const PostSchema: Schema = new Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: { type: String, required: true },
    image: { type: String },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  },
  { timestamps: true }
);

export default mongoose.model<IPost>("Post", PostSchema);
