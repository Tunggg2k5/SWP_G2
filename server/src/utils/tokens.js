import jwt from "jsonwebtoken";

export function getJwtSecret() {
  return process.env.JWT_SECRET || "das-local-development-secret";
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      email: user.email
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}
