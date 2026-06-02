import mongoose from "mongoose";

const adminProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    position: { type: String, trim: true },
    permissionLevel: { type: String, enum: ["standard", "super_admin"], default: "super_admin" },
    status: { type: String, enum: ["active", "inactive"], default: "active" }
  },
  { timestamps: true }
);

export default mongoose.model("AdminProfile", adminProfileSchema);
