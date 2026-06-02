import mongoose from "mongoose";

const roomStatusSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "ClinicRoom", required: true },
    nurse: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    availabilityStatus: {
      type: String,
      enum: ["available", "in_use", "cleaning", "maintenance", "unavailable"],
      required: true
    },
    note: { type: String, trim: true },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

roomStatusSchema.index({ room: 1, updatedAt: -1 });

export default mongoose.model("RoomStatus", roomStatusSchema);
