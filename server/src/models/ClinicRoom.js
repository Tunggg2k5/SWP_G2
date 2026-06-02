import mongoose from "mongoose";

const clinicRoomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    roomType: { type: String, trim: true, default: "Phòng điều trị nha khoa" },
    description: { type: String, trim: true },
    equipment: [{ type: String, trim: true }],
    assignedDentist: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["available", "in_use", "cleaning", "maintenance", "unavailable"],
      default: "available"
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

clinicRoomSchema.index({ status: 1, isActive: 1 });

export default mongoose.model("ClinicRoom", clinicRoomSchema);
