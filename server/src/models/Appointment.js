import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    dentist: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receptionist: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    nurse: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "ClinicRoom", required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "DentalService", required: true },
    appointmentSlot: { type: mongoose.Schema.Types.ObjectId, ref: "AppointmentSlot" },
    channel: { type: String, enum: ["online", "offline"], default: "online" },
    bookingType: { type: String, enum: ["online", "offline"], default: "online" },
    bookingDate: { type: Date, default: Date.now },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    arrivalAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "scheduled", "confirmed", "waitlisted", "rejected", "checked_in", "in_treatment", "completed", "cancelled", "no_show"],
      default: "pending"
    },
    paymentStatus: {
      type: String,
      enum: ["not_required", "pending_checkin", "paid", "refunded"],
      default: "pending_checkin"
    },
    patientNote: { type: String, trim: true },
    receptionistNote: { type: String, trim: true },
    confirmationCalledAt: Date,
    confirmationBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    confirmationNote: { type: String, trim: true },
    checkedInAt: Date,
    checkInTime: Date,
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledByRole: { type: String, enum: ["patient", "receptionist", "admin", "dentist", "nurse"] },
    cancellationReason: { type: String, trim: true }
  },
  { timestamps: true }
);

appointmentSchema.index({ room: 1, startAt: 1, endAt: 1 });
appointmentSchema.index({ patient: 1, startAt: -1 });
appointmentSchema.index({ patient: 1, status: 1, startAt: 1, endAt: 1 });
appointmentSchema.index({ dentist: 1, startAt: -1 });
appointmentSchema.index({ status: 1, startAt: 1 });
appointmentSchema.index({ confirmationCalledAt: 1, startAt: 1 });

export default mongoose.model("Appointment", appointmentSchema);
