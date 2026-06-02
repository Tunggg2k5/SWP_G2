import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ["male", "female", "other", "unknown"], default: "unknown" },
    address: { type: String, trim: true },
    medicalNote: { type: String, trim: true }
  },
  { timestamps: true }
);

export default mongoose.model("Patient", patientSchema);
