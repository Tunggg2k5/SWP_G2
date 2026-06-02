import mongoose from "mongoose";

const dentistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    specialization: { type: String, trim: true },
    qualification: { type: String, trim: true },
    experienceYears: { type: Number, default: 0 },
    description: { type: String, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" }
  },
  { timestamps: true }
);

dentistSchema.index({ status: 1, specialization: 1 });

export default mongoose.model("Dentist", dentistSchema);
