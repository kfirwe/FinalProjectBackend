import mongoose, { Schema, Document } from "mongoose";

export interface IComment extends Document {
  post: string;
  author: string;
  text: string;
}

const CommentSchema: Schema = new Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IComment>("Comment", CommentSchema);
