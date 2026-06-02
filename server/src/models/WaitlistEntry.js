import mongoose from "mongoose";

const waitlistEntrySchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receptionist: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "DentalService", required: true },
    preferredDate: { type: Date, required: true },
    preferredTime: { type: String, trim: true },
    status: {
      type: String,
      enum: ["waiting", "contacted", "booked", "expired", "cancelled"],
      default: "waiting"
    },
    note: { type: String, trim: true },
    notifiedAt: Date,
    responseDeadlineAt: Date,
    resolvedAt: Date,
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

waitlistEntrySchema.index({ status: 1, preferredDate: 1 });
waitlistEntrySchema.index({ patient: 1, createdAt: -1 });

export default mongoose.model("WaitlistEntry", waitlistEntrySchema);
