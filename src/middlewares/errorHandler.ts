import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // console.error(err.stack);
  // console.error(err.message);
  res
    .status(500)
    .json({ message: "An unexpected error occurred", error: err.message });
};
