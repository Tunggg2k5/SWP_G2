import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    dentist: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "DentalService" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    ratingDentist: { type: Number, min: 1, max: 5 },
    ratingService: { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true }
  },
  { timestamps: true }
);

reviewSchema.index({ dentist: 1, createdAt: -1 });

export default mongoose.model("Review", reviewSchema);
