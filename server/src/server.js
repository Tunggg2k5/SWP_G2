import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";

const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/das";

try {
  await connectDB(mongoUri);
  console.log("MongoDB connected");

  app.listen(port, () => {
    console.log(`DAS API running on http://localhost:${port}`);
  });
} catch (error) {
  console.error("Failed to start server:", error.message);
  process.exit(1);
}
