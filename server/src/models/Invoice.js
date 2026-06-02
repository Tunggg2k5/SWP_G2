import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [
      {
        name: String,
        amount: Number
      }
    ],
    total: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, min: 0 },
    invoiceDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["draft", "unpaid", "paid", "void"],
      default: "unpaid"
    },
    paidAt: Date
  },
  { timestamps: true }
);

invoiceSchema.index({ patient: 1, createdAt: -1 });

export default mongoose.model("Invoice", invoiceSchema);
