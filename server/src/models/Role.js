import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    roleName: {
      type: String,
      enum: ["user", "clinical_staff", "patient", "receptionist", "dentist", "nurse", "admin"],
      required: true,
      unique: true,
      trim: true
    },
    parentRoleName: {
      type: String,
      enum: ["user", "clinical_staff", "patient", "receptionist", "dentist", "nurse", "admin", null],
      default: null
    },
    isAbstract: { type: Boolean, default: false },
    inheritanceChain: [{ type: String, trim: true }],
    description: { type: String, trim: true }
  },
  { timestamps: true }
);

export default mongoose.model("Role", roleSchema);
