import { Router } from "express";
import { z } from "zod";
import Appointment from "../models/Appointment.js";
import ClinicRoom from "../models/ClinicRoom.js";
import ConsultationRequest from "../models/ConsultationRequest.js";
import DentalService from "../models/DentalService.js";
import Patient from "../models/Patient.js";
import Role from "../models/Role.js";
import RoomStatus from "../models/RoomStatus.js";
import { getInheritanceChain } from "../config/roleHierarchy.js";
import User from "../models/User.js";
import { authorize, requireAuth } from "../middlewares/auth.js";
import { hashPassword } from "../utils/password.js";
import { combineDateAndTime, endOfLocalDay, startOfLocalDay, toDateInputValue } from "../utils/time.js";
import {
  futureDateInputSchema,
  nameSchema,
  noteSchema,
  optionalTimeSchema,
  passwordSchema,
  phoneSchema
} from "../utils/validation.js";

const router = Router();

router.use(requireAuth, authorize("receptionist", "admin"));

function phoneEmail(phone) {
  return `${phone.replace(/\D/g, "")}@phone.das.local`;
}

async function autoCancelAfterClinicClose(dateText) {
  const now = new Date();
  const targetDate = dateText || toDateInputValue(now);
  if (now <= combineDateAndTime(targetDate, "17:30")) {
    return;
  }

  const query = {
    status: { $in: ["pending", "scheduled", "confirmed", "waitlisted"] },
    checkedInAt: { $exists: false },
    cancelledAt: { $exists: false },
    startAt: {
      $gte: startOfLocalDay(targetDate),
      $lte: endOfLocalDay(targetDate)
    }
  };

  await Appointment.updateMany(query, {
    $set: {
      status: "cancelled",
      cancelledAt: now,
      cancellationReason: "Hệ thống tự hủy vì bệnh nhân chưa check-in trước 17:30.",
      receptionistNote: "Hệ thống tự hủy vì bệnh nhân chưa có trạng thái Có mặt trước 17:30."
    }
  });
}

router.get("/dashboard", async (req, res) => {
  const patientFilter = { role: "patient", status: "active" };
  if (req.query.q) {
    const q = String(req.query.q).trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    patientFilter.$or = [
      { fullName: new RegExp(q, "i") },
      { phone: new RegExp(q, "i") },
      { email: new RegExp(q, "i") }
    ];
  }

  const appointmentQuery = {};
  if (req.query.date) {
    appointmentQuery.startAt = {
      $gte: startOfLocalDay(req.query.date),
      $lte: endOfLocalDay(req.query.date)
    };
  }

  await autoCancelAfterClinicClose(req.query.date);

  const [appointments, patients, services, consultations, rooms] = await Promise.all([
    Appointment.find(appointmentQuery)
      .populate([
        { path: "patient", select: "fullName email phone" },
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
    User.find(patientFilter).select("-passwordHash").sort({ fullName: 1 }).limit(40).lean(),
    DentalService.find({ isActive: true }).sort({ name: 1 }).lean(),
    ConsultationRequest.find({})
      .populate("service", "name")
      .populate("handledBy", "fullName")
      .sort({ createdAt: -1 })
      .limit(60)
      .lean(),
    ClinicRoom.find()
      .populate("assignedDentist", "fullName specialty")
      .sort({ name: 1 })
      .lean()
  ]);

  res.json({ appointments, patients, services, consultations, rooms });
});

router.get("/patients", async (req, res) => {
  const filter = { role: "patient", status: "active" };
  if (req.query.q) {
    const q = String(req.query.q).trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { fullName: new RegExp(q, "i") },
      { phone: new RegExp(q, "i") },
      { email: new RegExp(q, "i") }
    ];
  }

  const patients = await User.find(filter).select("-passwordHash").sort({ fullName: 1 }).limit(50);
  res.json({ patients });
});

router.patch("/patients/:id/reset-password", async (req, res, next) => {
  try {
    const schema = z.object({
      password: passwordSchema.default("Password123!")
    });
    const data = schema.parse(req.body || {});
    const patient = await User.findOne({ _id: req.params.id, role: "patient", status: "active" });

    if (!patient) {
      const err = new Error("Không tìm thấy tài khoản bệnh nhân.");
      err.statusCode = 404;
      throw err;
    }

    patient.passwordHash = await hashPassword(data.password);
    await patient.save();

    const object = patient.toObject();
    delete object.passwordHash;
    res.json({ patient: object, temporaryPassword: data.password });
  } catch (error) {
    next(error);
  }
});

router.post("/patients", async (req, res, next) => {
  try {
    const schema = z.object({
      fullName: nameSchema,
      phone: phoneSchema,
      gender: z.enum(["male", "female", "other", "unknown"]).default("unknown"),
      address: z.string().trim().max(255).optional().or(z.literal("")),
      createAccount: z.boolean().default(true),
      password: passwordSchema.default("Password123!")
    });
    const data = schema.parse(req.body);
    const duplicate = await User.findOne({ phone: data.phone });

    if (duplicate) {
      if (data.createAccount && duplicate.status !== "active" && duplicate.role === "patient") {
        duplicate.fullName = data.fullName;
        duplicate.gender = data.gender;
        duplicate.address = data.address || undefined;
        duplicate.passwordHash = await hashPassword(data.password);
        duplicate.status = "active";
        await duplicate.save();
        await Patient.findOneAndUpdate(
          { user: duplicate._id },
          { gender: data.gender, address: data.address || undefined },
          { upsert: true }
        );
        const object = duplicate.toObject();
        delete object.passwordHash;
        return res.status(200).json({ patient: object });
      }

      if (!data.createAccount && duplicate.role === "patient" && duplicate.status !== "active") {
        const object = duplicate.toObject();
        delete object.passwordHash;
        return res.status(200).json({ patient: object });
      }

      const err = new Error("Số điện thoại đã tồn tại.");
      err.statusCode = 409;
      throw err;
    }

    const role = await Role.findOneAndUpdate(
      { roleName: "patient" },
      {
        roleName: "patient",
        parentRoleName: "user",
        isAbstract: false,
        inheritanceChain: getInheritanceChain("patient"),
        description: "Bệnh nhân đặt lịch online, xem lịch sử khám, hủy/dời lịch và đánh giá dịch vụ."
      },
      { new: true, upsert: true }
    );
    const patient = await User.create({
      fullName: data.fullName,
      email: phoneEmail(data.phone),
      phone: data.phone,
      gender: data.gender,
      address: data.address || undefined,
      roleRef: role._id,
      role: "patient",
      status: data.createAccount ? "active" : "inactive",
      passwordHash: await hashPassword(data.password)
    });
    await Patient.create({ user: patient._id, gender: data.gender, address: data.address || undefined });

    const object = patient.toObject();
    delete object.passwordHash;
    res.status(201).json({ patient: object });
  } catch (error) {
    next(error);
  }
});

router.get("/consultations", async (req, res) => {
  const query = {};
  if (req.query.status) query.status = req.query.status;

  const requests = await ConsultationRequest.find(query)
    .populate("service", "name")
    .populate("handledBy", "fullName")
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ requests });
});

router.patch("/consultations/:id", async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(["new", "contacted", "scheduled", "closed"]),
      message: noteSchema,
      preferredDate: futureDateInputSchema.optional(),
      preferredTime: optionalTimeSchema
    });
    const data = schema.parse(req.body);
    const request = await ConsultationRequest.findByIdAndUpdate(
      req.params.id,
      {
        status: data.status,
        message: data.message,
        preferredDate: data.preferredDate ? new Date(data.preferredDate) : undefined,
        preferredTime: data.preferredTime,
        handledBy: req.user._id
      },
      { new: true }
    ).populate([
      { path: "service", select: "name" },
      { path: "handledBy", select: "fullName" }
    ]);

    if (!request) {
      const err = new Error("Không tìm thấy yêu cầu tư vấn.");
      err.statusCode = 404;
      throw err;
    }

    res.json({ request });
  } catch (error) {
    next(error);
  }
});

router.get("/rooms", async (_req, res) => {
  const rooms = await ClinicRoom.find()
    .populate("assignedDentist", "fullName specialty")
    .sort({ name: 1 });
  res.json({ rooms });
});

router.patch("/rooms/:id/status", async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(["available", "in_use", "cleaning", "maintenance", "unavailable"]),
      note: noteSchema
    });
    const data = schema.parse(req.body);
    const room = await ClinicRoom.findByIdAndUpdate(req.params.id, { status: data.status }, { new: true }).populate(
      "assignedDentist",
      "fullName specialty"
    );

    if (!room) {
      const err = new Error("Không tìm thấy phòng khám.");
      err.statusCode = 404;
      throw err;
    }

    await RoomStatus.create({
      room: room._id,
      availabilityStatus: data.status,
      note: data.note || "Lễ tân cập nhật trạng thái phòng."
    });

    res.json({ room });
  } catch (error) {
    next(error);
  }
});

export default router;
