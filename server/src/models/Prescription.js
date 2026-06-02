import mongoose from "mongoose";

const prescriptionSchema = new mongoose.Schema(
  {
    treatmentRecord: { type: mongoose.Schema.Types.ObjectId, ref: "TreatmentRecord", required: true },
    dentist: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    medicineName: { type: String, trim: true },
    dosage: { type: String, trim: true },
    instruction: { type: String, trim: true },
    note: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

prescriptionSchema.index({ treatmentRecord: 1, createdAt: -1 });

export default mongoose.model("Prescription", prescriptionSchema);
