import mongoose from "mongoose";

const timeSlotSchema = new mongoose.Schema(
  {
    slotName: { type: String, required: true, trim: true },
    workingHour: { type: mongoose.Schema.Types.ObjectId, ref: "ClinicWorkingHour" },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true }
  },
  { timestamps: true }
);

timeSlotSchema.index({ slotName: 1, startTime: 1, endTime: 1 }, { unique: true });

export default mongoose.model("TimeSlot", timeSlotSchema);
