import mongoose from "mongoose";

const consultationRequestSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "DentalService" },
    message: { type: String, trim: true },
    preferredDate: Date,
    preferredTime: { type: String, trim: true },
    status: {
      type: String,
      enum: ["new", "contacted", "scheduled", "closed"],
      default: "new"
    },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("ConsultationRequest", consultationRequestSchema);
