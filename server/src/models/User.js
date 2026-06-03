import mongoose from "mongoose";
import { getInheritanceChain, ROLE_HIERARCHY } from "../config/roleHierarchy.js";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, unique: true, lowercase: true, trim: true, sparse: true },
    phone: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    roleRef: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
    role: {
      type: String,
      enum: ["patient", "receptionist", "dentist", "nurse", "admin"],
      required: true,
      default: "patient"
    },
    status: {
      type: String,
      enum: ["active", "inactive", "locked"],
      default: "active"
    },
    avatar: { type: String, trim: true },
    specialty: { type: String, trim: true },
    bio: { type: String, trim: true },
    gender: {
      type: String,
      enum: ["male", "female", "other", "unknown"],
      default: "unknown"
    },
    address: { type: String, trim: true },
    yearsOfExperience: { type: Number, default: 0 },
    licenseNo: { type: String, trim: true },
    avatarUrl: { type: String, trim: true }
  },
  { timestamps: true }
);

userSchema.index({ role: 1, status: 1 });

userSchema.virtual("inheritanceChain").get(function inheritanceChain() {
  return getInheritanceChain(this.role);
});

userSchema.virtual("parentRole").get(function parentRole() {
  return ROLE_HIERARCHY[this.role]?.parent || null;
});

userSchema.virtual("profileCollection").get(function profileCollection() {
  return ROLE_HIERARCHY[this.role]?.profileCollection || null;
});

userSchema.virtual("isClinicalStaff").get(function isClinicalStaff() {
  return ["dentist", "nurse"].includes(this.role);
});

userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

export default mongoose.model("User", userSchema);
