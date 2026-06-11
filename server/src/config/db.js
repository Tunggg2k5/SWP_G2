import mongoose from "mongoose";

export async function connectDB(uri) {
  if (!uri) {
    throw new Error("Thiếu cấu hình kết nối MongoDB.");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB || "das",
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000
  });
  return mongoose.connection;
}
