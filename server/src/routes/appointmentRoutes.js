import { Router } from "express";
import { z } from "zod";
import Appointment from "../models/Appointment.js";
import AppointmentSlot from "../models/AppointmentSlot.js";
import DentalService from "../models/DentalService.js";
import Invoice from "../models/Invoice.js";
import Notification from "../models/Notification.js";
import Payment from "../models/Payment.js";
import { authorize, requireAuth } from "../middlewares/auth.js";
import { assertTwelveHourRule, endOfLocalDay, startOfLocalDay } from "../utils/time.js";
import {
  futureDateInputSchema,
  noteSchema,
  objectIdSchema,
  optionalIsoDateTimeSchema,
  optionalObjectIdSchema
} from "../utils/validation.js";
import {
  createAppointmentFromSlot,
  rescheduleAppointmentFromSlot
} from "../services/schedulingService.js";

const router = Router();

const populateAppointment = [
  { path: "patient", select: "fullName email phone" },
  { path: "createdBy", select: "fullName role" },
  { path: "receptionist", select: "fullName role" },
  { path: "confirmationBy", select: "fullName role" },
  { path: "dentist", select: "fullName specialty phone" },
  { path: "nurse", select: "fullName phone" },
  { path: "room", select: "name status equipment" },
  { path: "service", select: "name durationMinutes transitionTime price requiresPrepayment isConsultation" },
  { path: "appointmentSlot", select: "slotDate startAt endAt status" }
];

function appointmentQueryForUser(user) {
  if (user.role === "patient") return { patient: user._id };
  if (user.role === "dentist") return { dentist: user._id };
  if (user.role === "nurse") return { nurse: user._id };
  return {};
}

function canAccessAppointment(user, appointment) {
  if (["admin", "receptionist"].includes(user.role)) return true;
  if (user.role === "patient") return appointment.patient.toString() === user._id.toString();
  if (user.role === "dentist") return appointment.dentist.toString() === user._id.toString();
  if (user.role === "nurse") return appointment.nurse?.toString() === user._id.toString();
  return false;
}

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const query = appointmentQueryForUser(req.user);

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.date) {
      query.startAt = {
        $gte: startOfLocalDay(req.query.date),
        $lte: endOfLocalDay(req.query.date)
      };
    }

    const appointments = await Appointment.find(query)
      .populate(populateAppointment)
      .sort({ startAt: 1 })
      .limit(200);

    res.json({ appointments });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const schema = z.object({
      patientId: optionalObjectIdSchema,
      serviceId: objectIdSchema,
      date: futureDateInputSchema,
      startAt: optionalIsoDateTimeSchema,
      roomId: optionalObjectIdSchema,
      channel: z.enum(["online", "offline"]).optional(),
      note: noteSchema
    });
    const data = schema.parse(req.body);

    if (!["patient", "receptionist", "admin"].includes(req.user.role)) {
      const err = new Error("Chỉ bệnh nhân, lễ tân hoặc quản trị viên được tạo lịch hẹn.");
      err.statusCode = 403;
      throw err;
    }

    const patientId = req.user.role === "patient" ? req.user._id : data.patientId;
    if (!patientId) {
      const err = new Error("Cần chọn bệnh nhân khi nhân sự đặt lịch hộ.");
      err.statusCode = 400;
      throw err;
    }

    const appointment = await createAppointmentFromSlot({
      requester: req.user,
      patientId,
      serviceId: data.serviceId,
      date: data.date,
      startAt: data.startAt,
      roomId: data.roomId,
      channel: req.user.role === "patient" ? "online" : data.channel || "offline",
      note: data.note
    });

    await appointment.populate(populateAppointment);
    res.status(201).json({ appointment });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/reschedule", async (req, res, next) => {
  try {
    const schema = z.object({
      serviceId: optionalObjectIdSchema,
      date: futureDateInputSchema,
      startAt: optionalIsoDateTimeSchema,
      roomId: optionalObjectIdSchema
    });
    const data = schema.parse(req.body);
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      const err = new Error("Không tìm thấy lịch hẹn.");
      err.statusCode = 404;
      throw err;
    }

    if (!canAccessAppointment(req.user, appointment)) {
      const err = new Error("Bạn không có quyền đổi lịch hẹn này.");
      err.statusCode = 403;
      throw err;
    }

    const updated = await rescheduleAppointmentFromSlot({
      appointment,
      serviceId: data.serviceId,
      date: data.date,
      startAt: data.startAt,
      roomId: data.roomId
    });

    await updated.populate(populateAppointment);
    res.json({ appointment: updated });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/cancel", async (req, res, next) => {
  try {
    const schema = z.object({ reason: noteSchema });
    const data = schema.parse(req.body);
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      const err = new Error("Không tìm thấy lịch hẹn.");
      err.statusCode = 404;
      throw err;
    }

    if (!canAccessAppointment(req.user, appointment)) {
      const err = new Error("Bạn không có quyền hủy lịch hẹn này.");
      err.statusCode = 403;
      throw err;
    }

    assertTwelveHourRule(appointment.startAt);
    appointment.status = "cancelled";
    appointment.cancelledAt = new Date();
    appointment.cancellationReason = data.reason;
    await appointment.save();
    if (appointment.appointmentSlot) {
      await AppointmentSlot.findByIdAndUpdate(appointment.appointmentSlot, { status: "cancelled" });
    }
    await appointment.populate(populateAppointment);
    res.json({ appointment });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/status", authorize("receptionist", "admin", "nurse"), async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(["scheduled", "confirmed", "checked_in", "in_treatment", "completed", "cancelled", "no_show"]),
      note: noteSchema
    });
    const data = schema.parse(req.body);
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      const err = new Error("Không tìm thấy lịch hẹn.");
      err.statusCode = 404;
      throw err;
    }

    appointment.status = data.status;
    appointment.receptionistNote = data.note ?? appointment.receptionistNote;
    if (data.status === "checked_in") {
      appointment.checkedInAt = new Date();
      appointment.checkInTime = appointment.checkedInAt;
    }
    if (data.status === "cancelled") appointment.cancelledAt = new Date();
    await appointment.save();
    await appointment.populate(populateAppointment);
    res.json({ appointment });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/confirmation-call", authorize("receptionist", "admin"), async (req, res, next) => {
  try {
    const schema = z.object({ note: noteSchema });
    const data = schema.parse(req.body || {});
    const appointment = await Appointment.findById(req.params.id).populate("service", "name");

    if (!appointment) {
      const err = new Error("Không tìm thấy lịch hẹn.");
      err.statusCode = 404;
      throw err;
    }

    if (["cancelled", "completed", "no_show"].includes(appointment.status)) {
      const err = new Error("Lịch hẹn này không còn cần gọi xác nhận.");
      err.statusCode = 409;
      throw err;
    }

    appointment.confirmationCalledAt = new Date();
    appointment.confirmationBy = req.user._id;
    appointment.confirmationNote = data.note || "Lễ tân đã gọi xác nhận lịch hẹn.";
    appointment.receptionist = req.user._id;
    if (appointment.status === "scheduled") {
      appointment.status = "confirmed";
    }

    await appointment.save();
    await Notification.create({
      user: appointment.patient,
      title: "Lịch hẹn đã được xác nhận",
      message: `Lễ tân đã gọi xác nhận lịch ${appointment.service?.name || "khám"} của bạn.`,
      isRead: false
    });
    await appointment.populate(populateAppointment);
    res.json({ appointment });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/check-in", authorize("receptionist", "admin"), async (req, res, next) => {
  try {
    const schema = z.object({ paid: z.boolean().default(false) });
    const data = schema.parse(req.body);
    const appointment = await Appointment.findById(req.params.id).populate("service");

    if (!appointment) {
      const err = new Error("Không tìm thấy lịch hẹn.");
      err.statusCode = 404;
      throw err;
    }

    appointment.status = "checked_in";
    appointment.checkedInAt = new Date();
    appointment.checkInTime = appointment.checkedInAt;

    let invoice = await Invoice.findOne({ appointment: appointment._id });
    if (!invoice) {
      invoice = await Invoice.create({
        appointment: appointment._id,
        patient: appointment.patient,
        items: [{ name: appointment.service.name, amount: appointment.service.price }],
        total: appointment.service.price,
        totalAmount: appointment.service.price,
        invoiceDate: new Date(),
        status: appointment.service.price > 0 ? "unpaid" : "paid",
        paidAt: appointment.service.price > 0 ? undefined : new Date()
      });
    }

    if (data.paid || !appointment.service.requiresPrepayment) {
      appointment.paymentStatus = appointment.service.requiresPrepayment ? "paid" : "not_required";
      invoice.status = appointment.service.price > 0 ? "paid" : "paid";
      invoice.paidAt = new Date();
      await invoice.save();
      await Payment.create({
        invoice: invoice._id,
        amount: invoice.total,
        paymentStatus: "paid",
        paymentMethod: "cash"
      });
    }

    await appointment.save();
    await Notification.create({
      user: appointment.patient,
      title: "Đã ghi nhận bệnh nhân đến",
      message: "Lịch hẹn của bạn đã được ghi nhận đến tại quầy lễ tân.",
      isRead: false
    });
    await appointment.populate(populateAppointment);
    res.json({ appointment, invoice });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/invoice", async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment || !canAccessAppointment(req.user, appointment)) {
      const err = new Error("Không tìm thấy lịch hẹn.");
      err.statusCode = 404;
      throw err;
    }
    const invoice = await Invoice.findOne({ appointment: appointment._id });
    res.json({ invoice });
  } catch (error) {
    next(error);
  }
});

router.get("/meta/services-for-payment", async (_req, res) => {
  const services = await DentalService.find({ isActive: true });
  res.json({ services });
});

export default router;
