import { Router } from "express";
import { z } from "zod";
import WaitlistEntry from "../models/WaitlistEntry.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { authorize, requireAuth } from "../middleware/auth.js";
import { addMinutes, startOfLocalDay } from "../utils/time.js";
import {
  futureDateInputSchema,
  noteSchema,
  objectIdSchema,
  optionalObjectIdSchema,
  optionalTimeSchema
} from "../utils/validation.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const query = {};

  if (req.user.role === "patient") {
    query.patient = req.user._id;
  } else if (!["receptionist", "admin"].includes(req.user.role)) {
    query.patient = "__none__";
  }

  if (req.query.status) query.status = req.query.status;

  const entries = await WaitlistEntry.find(query)
    .populate("patient", "fullName email phone")
    .populate("service", "name durationMinutes")
    .populate("handledBy", "fullName")
    .sort({ preferredDate: 1, createdAt: 1 })
    .limit(200);

  res.json({ entries });
});

router.post("/", async (req, res, next) => {
  try {
    const schema = z.object({
      patientId: optionalObjectIdSchema,
      serviceId: objectIdSchema,
      preferredDate: futureDateInputSchema,
      preferredTime: optionalTimeSchema,
      note: noteSchema
    });
    const data = schema.parse(req.body);

    if (!["patient", "receptionist", "admin"].includes(req.user.role)) {
      const err = new Error("Chỉ bệnh nhân, lễ tân hoặc quản trị viên được tạo yêu cầu danh sách chờ.");
      err.statusCode = 403;
      throw err;
    }

    const patientId = req.user.role === "patient" ? req.user._id : data.patientId;
    const patient = await User.findById(patientId);

    if (!patient || patient.role !== "patient") {
      const err = new Error("Không tìm thấy tài khoản bệnh nhân.");
      err.statusCode = 404;
      throw err;
    }

    const entry = await WaitlistEntry.create({
      patient: patient._id,
      receptionist: ["receptionist", "admin"].includes(req.user.role) ? req.user._id : undefined,
      service: data.serviceId,
      preferredDate: startOfLocalDay(data.preferredDate),
      preferredTime: data.preferredTime,
      note: data.note
    });

    await entry.populate([
      { path: "patient", select: "fullName email phone" },
      { path: "service", select: "name durationMinutes" }
    ]);
    res.status(201).json({ entry });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", authorize("receptionist", "admin"), async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(["waiting", "contacted", "booked", "expired", "cancelled"]),
      note: noteSchema
    });
    const data = schema.parse(req.body);
    const entry = await WaitlistEntry.findById(req.params.id);

    if (!entry) {
      const err = new Error("Không tìm thấy yêu cầu danh sách chờ.");
      err.statusCode = 404;
      throw err;
    }

    entry.status = data.status;
    entry.note = data.note ?? entry.note;
    entry.handledBy = req.user._id;

    if (data.status === "contacted") {
      entry.notifiedAt = new Date();
      entry.responseDeadlineAt = addMinutes(entry.notifiedAt, 12 * 60);
      await Notification.create({
        user: entry.patient,
        title: "Có lịch trống trong danh sách chờ",
        message: "Lễ tân đã liên hệ về lịch trống trong danh sách chờ.",
        isRead: false
      });
    }

    if (["booked", "expired", "cancelled"].includes(data.status)) {
      entry.resolvedAt = new Date();
    }

    await entry.save();
    await entry.populate([
      { path: "patient", select: "fullName email phone" },
      { path: "service", select: "name durationMinutes" },
      { path: "handledBy", select: "fullName" }
    ]);
    res.json({ entry });
  } catch (error) {
    next(error);
  }
});

export default router;
