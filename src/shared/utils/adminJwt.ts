import jwt from "jsonwebtoken";

import { env } from "../../config/env.js";

export const generateToken = (
  id: string
) => {
  return jwt.sign(
    {
      id,
      role: "ADMIN",
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: "7d",
    }
  );
};