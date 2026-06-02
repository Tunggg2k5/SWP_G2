import mongoose from "mongoose";

const appointmentSlotSchema = new mongoose.Schema(
  {
    dentist: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "ClinicRoom", required: true },
    slotDate: { type: Date, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: { type: String, enum: ["available", "booked", "blocked", "cancelled"], default: "available" }
  },
  { timestamps: true }
);

appointmentSlotSchema.index({ dentist: 1, startAt: 1 });
appointmentSlotSchema.index({ room: 1, startAt: 1 });
appointmentSlotSchema.index({ status: 1, slotDate: 1 });

export default mongoose.model("AppointmentSlot", appointmentSlotSchema);
