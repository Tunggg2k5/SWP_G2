import { Router } from "express";
import { z } from "zod";
import Appointment from "../models/Appointment.js";
import ClinicRoom from "../models/ClinicRoom.js";
import Prescription from "../models/Prescription.js";
import RoomStatus from "../models/RoomStatus.js";
import TreatmentRecord from "../models/TreatmentRecord.js";
import TreatmentPlan from "../models/TreatmentPlan.js";
import { authorize, requireAuth } from "../middlewares/auth.js";
import { endOfLocalDay, startOfLocalDay } from "../utils/time.js";

const router = Router();

router.use(requireAuth, authorize("dentist", "nurse", "admin"));

router.get("/dashboard", async (req, res) => {
  const scheduleQuery = {};
  const recordQuery = {};

  if (req.user.role === "dentist") {
    scheduleQuery.dentist = req.user._id;
    recordQuery.dentist = req.user._id;
  }
  if (req.user.role === "nurse") {
    scheduleQuery.nurse = req.user._id;
    recordQuery.nurse = req.user._id;
  }
  if (req.query.date) {
    scheduleQuery.startAt = {
      $gte: startOfLocalDay(req.query.date),
      $lte: endOfLocalDay(req.query.date)
    };
  }

  const [appointments, records, rooms] = await Promise.all([
    Appointment.find(scheduleQuery)
      .populate([
        { path: "patient", select: "fullName phone email" },
        { path: "dentist", select: "fullName specialty" },
        { path: "nurse", select: "fullName" },
        { path: "room", select: "name status" },
        { path: "service", select: "name durationMinutes" }
      ])
      .sort({ startAt: 1 })
      .limit(120)
      .lean(),
    TreatmentRecord.find(recordQuery)
      .populate([
        { path: "appointment", populate: { path: "service", select: "name" } },
        { path: "patient", select: "fullName phone email" },
        { path: "dentist", select: "fullName" },
        { path: "nurse", select: "fullName" }
      ])
      .sort({ updatedAt: -1 })
      .limit(60)
      .lean(),
    req.user.role === "nurse"
      ? ClinicRoom.find().sort({ name: 1 }).lean()
      : Promise.resolve([])
  ]);

  res.json({ appointments, records, rooms });
});

router.get("/schedule", async (req, res) => {
  const query = {};

  if (req.user.role === "dentist") query.dentist = req.user._id;
  if (req.user.role === "nurse") query.nurse = req.user._id;
  if (req.query.date) {
    query.startAt = {
      $gte: startOfLocalDay(req.query.date),
      $lte: endOfLocalDay(req.query.date)
    };
  }

  const appointments = await Appointment.find(query)
    .populate([
      { path: "patient", select: "fullName phone email" },
      { path: "dentist", select: "fullName specialty" },
      { path: "nurse", select: "fullName" },
      { path: "room", select: "name status" },
      { path: "service", select: "name durationMinutes" }
    ])
    .sort({ startAt: 1 })
    .limit(200);

  res.json({ appointments });
});

router.get("/treatment-records", async (req, res) => {
  const query = {};
  if (req.user.role === "dentist") query.dentist = req.user._id;
  if (req.user.role === "nurse") query.nurse = req.user._id;

  const records = await TreatmentRecord.find(query)
    .populate([
      { path: "appointment", populate: { path: "service", select: "name" } },
      { path: "patient", select: "fullName phone email" },
      { path: "dentist", select: "fullName" },
      { path: "nurse", select: "fullName" }
    ])
    .sort({ updatedAt: -1 })
    .limit(100);

  res.json({ records });
});

router.get("/patients/:patientId/history", async (req, res, next) => {
  try {
    if (req.user.role === "dentist") {
      const relatedAppointment = await Appointment.exists({
        patient: req.params.patientId,
        dentist: req.user._id
      });

      if (!relatedAppointment) {
        const err = new Error("Bạn không có quyền xem lịch sử điều trị của bệnh nhân này.");
        err.statusCode = 403;
        throw err;
      }
    }

    const records = await TreatmentRecord.find({ patient: req.params.patientId })
      .populate([
        { path: "appointment", populate: [{ path: "service", select: "name" }, { path: "room", select: "name" }] },
        { path: "patient", select: "fullName phone email" },
        { path: "dentist", select: "fullName specialty" },
        { path: "nurse", select: "fullName" }
      ])
      .sort({ treatmentDate: -1, updatedAt: -1 })
      .limit(50);

    res.json({ records });
  } catch (error) {
    next(error);
  }
});

router.put("/appointments/:appointmentId/treatment-record", authorize("nurse", "admin"), async (req, res, next) => {
  try {
    const schema = z.object({
      vitalSigns: z
        .object({
          bloodPressure: z.string().optional(),
          spo2: z.string().optional(),
          temperature: z.string().optional(),
          respiratoryRate: z.string().optional()
        })
        .optional(),
      diagnosis: z.string().max(2000).optional(),
      treatmentResult: z.string().max(2000).optional(),
      treatmentNote: z.string().max(4000).optional(),
      treatmentPlan: z.string().max(4000).optional(),
      estimatedCost: z.coerce.number().optional(),
      prescription: z.string().max(4000).optional()
    });
    const data = schema.parse(req.body);
    const appointment = await Appointment.findById(req.params.appointmentId);

    if (!appointment) {
      const err = new Error("Không tìm thấy lịch hẹn.");
      err.statusCode = 404;
      throw err;
    }

    const canEdit = req.user.role === "admin" || appointment.nurse?.toString() === req.user._id.toString();

    if (!canEdit) {
      const err = new Error("Chỉ y tá được phân công mới được cập nhật hồ sơ điều trị.");
      err.statusCode = 403;
      throw err;
    }

    const record = await TreatmentRecord.findOneAndUpdate(
      { appointment: appointment._id },
      {
        $set: {
          patient: appointment.patient,
          dentist: appointment.dentist,
          nurse: appointment.nurse,
          vitalSigns: data.vitalSigns,
          diagnosis: data.diagnosis,
          treatmentResult: data.treatmentResult,
          treatmentNote: data.treatmentNote,
          treatmentPlan: data.treatmentPlan,
          prescription: data.prescription,
          treatmentDate: new Date(),
          status: "active"
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate([
      { path: "appointment", populate: { path: "service", select: "name" } },
      { path: "patient", select: "fullName phone email" }
    ]);

    if (data.treatmentPlan) {
      await TreatmentPlan.findOneAndUpdate(
        { treatmentRecord: record._id },
        {
          treatmentRecord: record._id,
          dentist: appointment.dentist,
          planDetail: data.treatmentPlan,
          estimatedCost: data.estimatedCost || 0,
          startDate: new Date(),
          status: "active"
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    if (data.prescription) {
      await Prescription.create({
        treatmentRecord: record._id,
        dentist: appointment.dentist,
        medicineName: "Theo đơn điều trị",
        instruction: data.prescription,
        note: data.prescription
      });
    }

    res.json({ record });
  } catch (error) {
    next(error);
  }
});

router.patch("/rooms/:id/status", authorize("nurse", "admin"), async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(["available", "in_use", "cleaning", "maintenance", "unavailable"])
    });
    const data = schema.parse(req.body);
    const room = await ClinicRoom.findByIdAndUpdate(req.params.id, data, { new: true });

    if (!room) {
      const err = new Error("Không tìm thấy phòng khám.");
      err.statusCode = 404;
      throw err;
    }

    await RoomStatus.create({
      room: room._id,
      nurse: req.user.role === "nurse" ? req.user._id : undefined,
      availabilityStatus: data.status,
      note: "Cập nhật trạng thái phòng từ bảng điều khiển lâm sàng."
    });

    res.json({ room });
  } catch (error) {
    next(error);
  }
});

export default router;
