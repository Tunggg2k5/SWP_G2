import mongoose from "mongoose";

const treatmentRecordSchema = new mongoose.Schema(
  {
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true, unique: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    dentist: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    nurse: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    vitalSigns: {
      bloodPressure: String,
      spo2: String,
      temperature: String,
      respiratoryRate: String
    },
    diagnosis: { type: String, trim: true },
    treatmentResult: { type: String, trim: true },
    treatmentNote: { type: String, trim: true },
    treatmentPlan: { type: String, trim: true },
    prescription: { type: String, trim: true },
    treatmentDate: { type: Date, default: Date.now },
    status: { type: String, enum: ["draft", "active", "completed"], default: "draft" }
  },
  { timestamps: true }
);

export default mongoose.model("TreatmentRecord", treatmentRecordSchema);
