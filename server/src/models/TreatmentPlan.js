import mongoose from "mongoose";

const treatmentPlanSchema = new mongoose.Schema(
  {
    treatmentRecord: { type: mongoose.Schema.Types.ObjectId, ref: "TreatmentRecord", required: true },
    dentist: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    planDetail: { type: String, trim: true },
    estimatedCost: { type: Number, default: 0, min: 0 },
    startDate: Date,
    endDate: Date,
    status: { type: String, enum: ["draft", "active", "completed", "cancelled"], default: "draft" }
  },
  { timestamps: true }
);

treatmentPlanSchema.index({ treatmentRecord: 1 }, { unique: true });

export default mongoose.model("TreatmentPlan", treatmentPlanSchema);
