import { Router } from "express";
import { z } from "zod";
import Appointment from "../models/Appointment.js";
import ClinicRoom from "../models/ClinicRoom.js";
import ConsultationRequest from "../models/ConsultationRequest.js";
import DentalService from "../models/DentalService.js";
import Patient from "../models/Patient.js";
import Role from "../models/Role.js";
import RoomStatus from "../models/RoomStatus.js";
import WaitlistEntry from "../models/WaitlistEntry.js";
import { getInheritanceChain } from "../config/roleHierarchy.js";
import User from "../models/User.js";
import { authorize, requireAuth } from "../middlewares/auth.js";
import { hashPassword } from "../utils/password.js";
import { endOfLocalDay, startOfLocalDay } from "../utils/time.js";
import {
  emailSchema,
  futureDateInputSchema,
  nameSchema,
  noteSchema,
  optionalTimeSchema,
  passwordSchema,
  phoneSchema
} from "../utils/validation.js";

const router = Router();

router.use(requireAuth, authorize("receptionist", "admin"));

router.get("/dashboard", async (req, res) => {
  const patientFilter = { role: "patient" };
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

  const [appointments, patients, services, waitlist, consultations, rooms] = await Promise.all([
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
    WaitlistEntry.find({})
      .populate("patient", "fullName email phone")
      .populate("service", "name durationMinutes")
      .populate("handledBy", "fullName")
      .sort({ preferredDate: 1, createdAt: 1 })
      .limit(100)
      .lean(),
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

  res.json({ appointments, patients, services, waitlist, consultations, rooms });
});

router.get("/patients", async (req, res) => {
  const filter = { role: "patient" };
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

router.post("/patients", async (req, res, next) => {
  try {
    const schema = z.object({
      fullName: nameSchema,
      email: emailSchema,
      phone: phoneSchema,
      password: passwordSchema.default("Password123!")
    });
    const data = schema.parse(req.body);

    const role = await Role.findOneAndUpdate(
      { roleName: "patient" },
      {
        roleName: "patient",
        parentRoleName: "user",
        isAbstract: false,
        inheritanceChain: getInheritanceChain("patient"),
        description: "Bệnh nhân kế thừa từ Người dùng."
      },
      { new: true, upsert: true }
    );
    const patient = await User.create({
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      roleRef: role._id,
      role: "patient",
      passwordHash: await hashPassword(data.password)
    });
    await Patient.create({ user: patient._id });

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
