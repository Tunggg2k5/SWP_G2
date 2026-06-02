import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true },
    paymentMethod: { type: String, enum: ["cash", "card", "bank_transfer", "online"], default: "cash" },
    amount: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "paid" },
    paymentDate: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

paymentSchema.index({ invoice: 1, paymentDate: -1 });

export default mongoose.model("Payment", paymentSchema);
