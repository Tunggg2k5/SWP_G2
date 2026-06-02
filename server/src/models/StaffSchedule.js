import mongoose from "mongoose";

const staffScheduleSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    timeSlot: { type: mongoose.Schema.Types.ObjectId, ref: "TimeSlot", required: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "ClinicRoom" },
    workDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: { type: String, enum: ["scheduled", "off", "completed", "cancelled"], default: "scheduled" }
  },
  { timestamps: true }
);

staffScheduleSchema.index({ user: 1, workDate: 1, timeSlot: 1 }, { unique: true });
staffScheduleSchema.index({ user: 1, workDate: 1, startTime: 1, endTime: 1 });
staffScheduleSchema.index({ room: 1, workDate: 1 });
staffScheduleSchema.index({ room: 1, workDate: 1, startTime: 1, endTime: 1 });

export default mongoose.model("StaffSchedule", staffScheduleSchema);
