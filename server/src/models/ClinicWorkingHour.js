import mongoose from "mongoose";

const clinicWorkingHourSchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 1, max: 6 },
    shiftName: { type: String, required: true, trim: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" }
  },
  { timestamps: true }
);

clinicWorkingHourSchema.index({ dayOfWeek: 1, shiftName: 1 }, { unique: true });

export default mongoose.model("ClinicWorkingHour", clinicWorkingHourSchema);
