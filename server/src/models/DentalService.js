import mongoose from "mongoose";

const dentalServiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    durationMinutes: { type: Number, required: true, min: 10 },
    transitionTime: { type: Number, default: 10, min: 0 },
    price: { type: Number, default: 0, min: 0 },
    requiresPrepayment: { type: Boolean, default: true },
    isConsultation: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model("DentalService", dentalServiceSchema);
