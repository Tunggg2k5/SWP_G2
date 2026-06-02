import { Router } from "express";
import { z } from "zod";
import Appointment from "../models/Appointment.js";
import Invoice from "../models/Invoice.js";
import Notification from "../models/Notification.js";
import Payment from "../models/Payment.js";
import Review from "../models/Review.js";
import TreatmentRecord from "../models/TreatmentRecord.js";
import WaitlistEntry from "../models/WaitlistEntry.js";
import { authorize, requireAuth } from "../middleware/auth.js";
import { noteSchema, objectIdSchema } from "../utils/validation.js";

const router = Router();

router.use(requireAuth, authorize("patient"));

router.get("/dashboard", async (req, res) => {
  const [appointments, waitlist, records, invoices, notifications] = await Promise.all([
    Appointment.find({ patient: req.user._id })
      .populate([
        { path: "createdBy", select: "fullName role" },
        { path: "receptionist", select: "fullName role" },
        { path: "dentist", select: "fullName specialty phone" },
        { path: "nurse", select: "fullName phone" },
        { path: "room", select: "name status equipment" },
        { path: "service", select: "name durationMinutes transitionTime price requiresPrepayment isConsultation" },
        { path: "appointmentSlot", select: "slotDate startAt endAt status" }
      ])
      .sort({ startAt: 1 })
      .limit(120)
      .lean(),
    WaitlistEntry.find({ patient: req.user._id })
      .populate("patient", "fullName email phone")
      .populate("service", "name durationMinutes")
      .populate("handledBy", "fullName")
      .sort({ preferredDate: 1, createdAt: 1 })
      .limit(80)
      .lean(),
    TreatmentRecord.find({ patient: req.user._id })
      .populate([
        { path: "appointment", populate: [{ path: "service", select: "name" }, { path: "room", select: "name" }] },
        { path: "dentist", select: "fullName specialty" },
        { path: "nurse", select: "fullName" }
      ])
      .sort({ updatedAt: -1 })
      .limit(80)
      .lean(),
    Invoice.find({ patient: req.user._id })
      .populate({
        path: "appointment",
        populate: [{ path: "service", select: "name" }, { path: "dentist", select: "fullName" }]
      })
      .sort({ createdAt: -1 })
      .limit(80)
      .lean(),
    buildPatientNotifications(req.user._id)
  ]);

  res.json({ appointments, waitlist, records, invoices, notifications });
});

router.get("/invoices", async (req, res) => {
  const invoices = await Invoice.find({ patient: req.user._id })
    .populate({
      path: "appointment",
      populate: [{ path: "service", select: "name" }, { path: "dentist", select: "fullName" }]
    })
    .sort({ createdAt: -1 });
  res.json({ invoices });
});

router.patch("/invoices/:id/pay", async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, patient: req.user._id });
    if (!invoice) {
      const err = new Error("Không tìm thấy hóa đơn.");
      err.statusCode = 404;
      throw err;
    }

    invoice.status = "paid";
    invoice.paidAt = new Date();
    await invoice.save();
    await Payment.create({
      invoice: invoice._id,
      amount: invoice.total,
      paymentStatus: "paid",
      paymentMethod: "online"
    });
    res.json({ invoice });
  } catch (error) {
    next(error);
  }
});

router.get("/treatment-records", async (req, res) => {
  const records = await TreatmentRecord.find({ patient: req.user._id })
    .populate([
      { path: "appointment", populate: [{ path: "service", select: "name" }, { path: "room", select: "name" }] },
      { path: "dentist", select: "fullName specialty" },
      { path: "nurse", select: "fullName" }
    ])
    .sort({ updatedAt: -1 });
  res.json({ records });
});

router.post("/reviews", async (req, res, next) => {
  try {
    const schema = z.object({
      appointmentId: objectIdSchema,
      rating: z.coerce.number().min(1).max(5),
      comment: noteSchema
    });
    const data = schema.parse(req.body);
    const appointment = await Appointment.findOne({
      _id: data.appointmentId,
      patient: req.user._id,
      status: "completed"
    });

    if (!appointment) {
      const err = new Error("Không tìm thấy lịch hẹn đã hoàn tất.");
      err.statusCode = 404;
      throw err;
    }

    const review = await Review.findOneAndUpdate(
      { appointment: appointment._id },
      {
        patient: req.user._id,
        dentist: appointment.dentist,
        service: appointment.service,
        rating: data.rating,
        ratingDentist: data.rating,
        ratingService: data.rating,
        comment: data.comment
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ review });
  } catch (error) {
    next(error);
  }
});

router.get("/notifications", async (req, res) => {
  const [appointments, waitlist, storedNotifications] = await Promise.all([
    Appointment.find({
      patient: req.user._id,
      status: { $in: ["scheduled", "confirmed"] },
      startAt: { $gte: new Date() }
    })
      .populate("service", "name")
      .sort({ startAt: 1 })
      .limit(5),
    WaitlistEntry.find({ patient: req.user._id, status: { $in: ["waiting", "contacted"] } })
      .populate("service", "name")
      .sort({ createdAt: -1 })
      .limit(5),
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10)
  ]);

  res.json({
    notifications: [
      ...storedNotifications.map((item) => ({
        id: item._id,
        type: "notification",
        title: item.title,
        message: `${item.title}: ${item.message}`,
        isRead: item.isRead,
        createdAt: item.createdAt
      })),
      ...appointments.map((item) => ({
        type: "appointment",
        message: `Lịch ${item.service?.name || "khám"} lúc ${item.startAt.toLocaleString()}`
      })),
      ...waitlist.map((item) => ({
        type: "waitlist",
        message: `Danh sách chờ ${item.service?.name || "dịch vụ"} đang ở trạng thái ${formatWaitlistStatus(item.status)}`
      }))
    ]
  });
});

router.patch("/notifications/:id/read", async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      const err = new Error("Không tìm thấy thông báo.");
      err.statusCode = 404;
      throw err;
    }

    res.json({ notification });
  } catch (error) {
    next(error);
  }
});

export default router;

async function buildPatientNotifications(userId) {
  const [appointments, waitlist, storedNotifications] = await Promise.all([
    Appointment.find({
      patient: userId,
      status: { $in: ["scheduled", "confirmed"] },
      startAt: { $gte: new Date() }
    })
      .populate("service", "name")
      .sort({ startAt: 1 })
      .limit(5)
      .lean(),
    WaitlistEntry.find({ patient: userId, status: { $in: ["waiting", "contacted"] } })
      .populate("service", "name")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(10).lean()
  ]);

  return [
    ...storedNotifications.map((item) => ({
      id: item._id,
      type: "notification",
      title: item.title,
      message: `${item.title}: ${item.message}`,
      isRead: item.isRead,
      createdAt: item.createdAt
    })),
    ...appointments.map((item) => ({
      type: "appointment",
      message: `Lịch ${item.service?.name || "khám"} lúc ${item.startAt.toLocaleString()}`
    })),
    ...waitlist.map((item) => ({
      type: "waitlist",
      message: `Danh sách chờ ${item.service?.name || "dịch vụ"} đang ở trạng thái ${formatWaitlistStatus(item.status)}`
    }))
  ];
}

function formatWaitlistStatus(status) {
  const labels = {
    waiting: "đang chờ",
    contacted: "đã liên hệ",
    booked: "đã đặt lịch",
    expired: "quá hạn",
    cancelled: "đã hủy"
  };
  return labels[status] || status;
}
