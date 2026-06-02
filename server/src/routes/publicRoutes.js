import { Router } from "express";
import { z } from "zod";
import ClinicRoom from "../models/ClinicRoom.js";
import ConsultationRequest from "../models/ConsultationRequest.js";
import DentalService from "../models/DentalService.js";
import Review from "../models/Review.js";
import User from "../models/User.js";
import { getRoleHierarchyList } from "../config/roleHierarchy.js";
import { findAvailableSlots } from "../services/schedulingService.js";
import {
  futureDateInputSchema,
  nameSchema,
  noteSchema,
  objectIdSchema,
  optionalEmailSchema,
  optionalFutureDateInputSchema,
  optionalObjectIdSchema,
  optionalTimeSchema,
  phoneSchema
} from "../utils/validation.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "DAS API" });
});

router.get("/role-hierarchy", (_req, res) => {
  res.json({ roles: getRoleHierarchyList() });
});

router.get("/services", async (_req, res) => {
  const services = await DentalService.find({ isActive: true }).sort({ name: 1 }).lean();
  res.json({ services });
});

router.get("/bootstrap", async (_req, res) => {
  const [services, dentists, rooms] = await Promise.all([
    DentalService.find({ isActive: true }).sort({ name: 1 }).lean(),
    User.find({ role: "dentist", status: "active" })
      .select("-passwordHash")
      .sort({ fullName: 1 })
      .lean(),
    ClinicRoom.find({ isActive: true })
      .populate("assignedDentist", "fullName specialty")
      .sort({ name: 1 })
      .lean()
  ]);

  res.json({ services, dentists, rooms });
});

router.get("/dentists", async (_req, res) => {
  const dentists = await User.find({ role: "dentist", status: "active" })
    .select("-passwordHash")
    .sort({ fullName: 1 })
    .lean();
  res.json({ dentists });
});

router.get("/dentists/:id", async (req, res, next) => {
  try {
    const dentist = await User.findOne({ _id: req.params.id, role: "dentist", status: "active" }).select("-passwordHash");

    if (!dentist) {
      const err = new Error("Không tìm thấy bác sĩ.");
      err.statusCode = 404;
      throw err;
    }

    const reviews = await Review.find({ dentist: dentist._id })
      .populate("patient", "fullName")
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ dentist, reviews });
  } catch (error) {
    next(error);
  }
});

router.get("/dentists/:id/reviews", async (req, res) => {
  const reviews = await Review.find({ dentist: req.params.id })
    .populate("patient", "fullName")
    .sort({ createdAt: -1 })
    .limit(25);
  res.json({ reviews });
});

router.get("/rooms", async (_req, res) => {
  const rooms = await ClinicRoom.find({ isActive: true })
    .populate("assignedDentist", "fullName specialty")
    .sort({ name: 1 })
    .lean();
  res.json({ rooms });
});

router.get("/availability", async (req, res, next) => {
  try {
    const schema = z.object({
      date: futureDateInputSchema,
      serviceId: objectIdSchema
    });
    const data = schema.parse(req.query);
    const slots = await findAvailableSlots(data);
    res.json({ slots });
  } catch (error) {
    next(error);
  }
});

router.post("/consultations", async (req, res, next) => {
  try {
    const schema = z.object({
      fullName: nameSchema,
      phone: phoneSchema,
      email: optionalEmailSchema,
      service: optionalObjectIdSchema,
      preferredDate: optionalFutureDateInputSchema,
      preferredTime: optionalTimeSchema,
      message: noteSchema
    });
    const data = schema.parse(req.body);
    const request = await ConsultationRequest.create({
      fullName: data.fullName,
      phone: data.phone,
      email: data.email || undefined,
      service: data.service || undefined,
      preferredDate: data.preferredDate ? new Date(data.preferredDate) : undefined,
      preferredTime: data.preferredTime,
      message: data.message
    });
    res.status(201).json({ request });
  } catch (error) {
    next(error);
  }
});

export default router;
