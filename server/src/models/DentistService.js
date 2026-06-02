import mongoose from "mongoose";

const dentistServiceSchema = new mongoose.Schema(
  {
    dentist: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "DentalService", required: true }
  },
  { timestamps: true }
);

dentistServiceSchema.index({ dentist: 1, service: 1 }, { unique: true });

export default mongoose.model("DentistService", dentistServiceSchema);
