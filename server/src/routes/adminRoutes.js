import { Router } from "express";
import { randomBytes } from "crypto";
import { z } from "zod";
import Appointment from "../models/Appointment.js";
import AdminProfile from "../models/AdminProfile.js";
import ClinicRoom from "../models/ClinicRoom.js";
import ClinicWorkingHour from "../models/ClinicWorkingHour.js";
import DentalService from "../models/DentalService.js";
import Dentist from "../models/Dentist.js";
import Invoice from "../models/Invoice.js";
import Nurse from "../models/Nurse.js";
import Patient from "../models/Patient.js";
import Receptionist from "../models/Receptionist.js";
import Review from "../models/Review.js";
import Role from "../models/Role.js";
import StaffSchedule from "../models/StaffSchedule.js";
import TimeSlot from "../models/TimeSlot.js";
import User from "../models/User.js";
import { getInheritanceChain, getRoleHierarchyList, ROLE_HIERARCHY } from "../config/roleHierarchy.js";
import { authorize, requireAuth } from "../middleware/auth.js";
import { hashPassword } from "../utils/password.js";
import {
  emailSchema,
  futureDateInputSchema,
  nameSchema,
  noteSchema,
  objectIdSchema,
  optionalObjectIdSchema,
  optionalPhoneSchema,
  optionalShortTextSchema,
  passwordSchema
} from "../utils/validation.js";

const router = Router();
const STAFF_SCHEDULE_ROLES = ["dentist", "nurse", "receptionist"];
const BLOCKING_SCHEDULE_STATUSES = ["scheduled", "completed"];
const CLINIC_WORKING_SESSIONS = [
  { start: "07:00", end: "11:30" },
  { start: "13:30", end: "17:30" }
];

router.use(requireAuth, authorize("admin"));

function generateTemporaryPassword() {
  return `Das${randomBytes(5).toString("hex")}1`;
}

router.get("/stats", async (_req, res) => {
  res.json(await buildAdminStats());
});

router.get("/dashboard", async (_req, res) => {
  const [stats, users, services, rooms, roleHierarchy, workingHours, timeSlots] = await Promise.all([
    buildAdminStats(),
    User.find({}).select("-passwordHash").sort({ role: 1, fullName: 1 }).limit(160).lean(),
    DentalService.find({ isActive: true }).sort({ name: 1 }).lean(),
    ClinicRoom.find()
      .populate("assignedDentist", "fullName specialty")
      .sort({ name: 1 })
      .lean(),
    Promise.resolve(getRoleHierarchyList()),
    ClinicWorkingHour.find().sort({ dayOfWeek: 1, startTime: 1 }).lean(),
    TimeSlot.find().sort({ startTime: 1 }).lean()
  ]);

  res.json({ stats, users, services, rooms, roleHierarchy, workingHours, timeSlots });
});

async function buildAdminStats() {
  const [
    appointmentStats,
    revenue,
    patientCount,
    noShowCount,
    reviewStats
  ] = await Promise.all([
    Appointment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Invoice.aggregate([{ $match: { status: "paid" } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
    Patient.countDocuments({}),
    Appointment.countDocuments({ status: "no_show" }),
    Review.aggregate([{ $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } }])
  ]);

  return {
    appointmentStats,
    revenue: revenue[0]?.total || 0,
    patientCount,
    noShowCount,
    review: reviewStats[0] || { average: 0, count: 0 }
  };
}

router.get("/users", async (req, res) => {
  const query = {};
  if (req.query.role) query.role = req.query.role;

  const users = await User.find(query).select("-passwordHash").sort({ role: 1, fullName: 1 }).limit(200);
  res.json({ users });
});

router.get("/working-hours", async (_req, res) => {
  const workingHours = await ClinicWorkingHour.find().sort({ dayOfWeek: 1, startTime: 1 });
  const timeSlots = await TimeSlot.find().sort({ startTime: 1 });
  res.json({ workingHours, timeSlots });
});

router.post("/working-hours", async (req, res, next) => {
  try {
    const schema = z.object({
      dayOfWeek: z.coerce.number().int().min(1).max(6),
      shiftName: nameSchema,
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      status: z.enum(["active", "inactive"]).default("active")
    });
    const data = schema.parse(req.body);
    validateTimeWindow(data.startTime, data.endTime);
    validateClinicSessionWindow(data.startTime, data.endTime);
    const workingHour = await ClinicWorkingHour.create(data);
    res.status(201).json({ workingHour });
  } catch (error) {
    next(error);
  }
});

router.patch("/working-hours/:id", async (req, res, next) => {
  try {
    const schema = z.object({
      shiftName: nameSchema.optional(),
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      status: z.enum(["active", "inactive"]).optional()
    });
    const data = schema.parse(req.body);
    const existing = await ClinicWorkingHour.findById(req.params.id);

    if (!existing) {
      const err = new Error("Không tìm thấy giờ làm việc.");
      err.statusCode = 404;
      throw err;
    }

    const nextStartTime = data.startTime || existing.startTime;
    const nextEndTime = data.endTime || existing.endTime;
    validateTimeWindow(nextStartTime, nextEndTime);
    validateClinicSessionWindow(nextStartTime, nextEndTime);

    const workingHour = await ClinicWorkingHour.findByIdAndUpdate(req.params.id, data, { new: true });

    res.json({ workingHour });
  } catch (error) {
    next(error);
  }
});

router.get("/staff-schedules", async (req, res) => {
  const query = {};
  if (req.query.date) {
    const date = new Date(`${req.query.date}T00:00:00`);
    query.workDate = date;
  }
  if (req.query.userId) query.user = req.query.userId;

  const limit = Math.min(Number(req.query.limit) || 80, 300);
  const schedules = await StaffSchedule.find(query)
    .populate([
      { path: "user", select: "fullName role phone" },
      { path: "timeSlot", select: "slotName startTime endTime" },
      { path: "room", select: "name status" }
    ])
    .sort({ workDate: 1, startTime: 1 })
    .limit(limit)
    .lean();
  res.json({ schedules });
});

router.post("/staff-schedules", async (req, res, next) => {
  try {
    const schema = z.object({
      userId: objectIdSchema,
      timeSlotId: objectIdSchema,
      roomId: optionalObjectIdSchema,
      workDate: futureDateInputSchema,
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      status: z.enum(["scheduled", "off", "completed", "cancelled"]).default("scheduled")
    });
    const data = schema.parse(req.body);
    validateTimeWindow(data.startTime, data.endTime);
    validateClinicSessionWindow(data.startTime, data.endTime);
    const workDate = new Date(`${data.workDate}T00:00:00`);
    validateWorkday(workDate);
    await validateStaffScheduleAssignment({
      userId: data.userId,
      roomId: data.roomId,
      workDate,
      startTime: data.startTime,
      endTime: data.endTime,
      status: data.status
    });
    const schedule = await StaffSchedule.create({
      user: data.userId,
      timeSlot: data.timeSlotId,
      room: data.roomId,
      workDate,
      startTime: data.startTime,
      endTime: data.endTime,
      status: data.status
    });
    await schedule.populate([
      { path: "user", select: "fullName role phone" },
      { path: "timeSlot", select: "slotName startTime endTime" },
      { path: "room", select: "name status" }
    ]);
    res.status(201).json({ schedule });
  } catch (error) {
    next(error);
  }
});

router.patch("/staff-schedules/:id", async (req, res, next) => {
  try {
    const schema = z.object({
      roomId: optionalObjectIdSchema,
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      status: z.enum(["scheduled", "off", "completed", "cancelled"]).optional()
    });
    const data = schema.parse(req.body);
    const existing = await StaffSchedule.findById(req.params.id);

    if (!existing) {
      const err = new Error("Không tìm thấy lịch nhân sự.");
      err.statusCode = 404;
      throw err;
    }

    const hasRoomUpdate = Object.prototype.hasOwnProperty.call(data, "roomId");
    const nextRoomId = hasRoomUpdate ? data.roomId : existing.room;
    const nextStartTime = data.startTime || existing.startTime;
    const nextEndTime = data.endTime || existing.endTime;
    const nextStatus = data.status || existing.status;

    validateTimeWindow(nextStartTime, nextEndTime);
    validateClinicSessionWindow(nextStartTime, nextEndTime);
    await validateStaffScheduleAssignment({
      userId: existing.user,
      roomId: nextRoomId,
      workDate: existing.workDate,
      startTime: nextStartTime,
      endTime: nextEndTime,
      status: nextStatus,
      excludeScheduleId: existing._id
    });

    const update = {};
    if (hasRoomUpdate) update.room = data.roomId;
    if (data.startTime) update.startTime = data.startTime;
    if (data.endTime) update.endTime = data.endTime;
    if (data.status) update.status = data.status;

    const schedule = await StaffSchedule.findByIdAndUpdate(req.params.id, update, { new: true }).populate([
      { path: "user", select: "fullName role phone" },
      { path: "timeSlot", select: "slotName startTime endTime" },
      { path: "room", select: "name status" }
    ]);

    res.json({ schedule });
  } catch (error) {
    next(error);
  }
});

router.get("/reports/export", async (_req, res) => {
  const [appointments, invoices, reviews, noShowCount] = await Promise.all([
    Appointment.countDocuments(),
    Invoice.aggregate([{ $group: { _id: "$status", total: { $sum: "$total" }, count: { $sum: 1 } } }]),
    Review.aggregate([{ $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } }]),
    Appointment.countDocuments({ status: "no_show" })
  ]);

  res.json({
    generatedAt: new Date(),
    appointments,
    invoiceSummary: invoices,
    reviewSummary: reviews[0] || { average: 0, count: 0 },
    noShowCount
  });
});

router.post("/users", async (req, res, next) => {
  try {
    const schema = z.object({
      fullName: nameSchema,
      email: emailSchema,
      phone: optionalPhoneSchema,
      password: passwordSchema.default("Password123!"),
      role: z.enum(["patient", "receptionist", "dentist", "nurse", "admin"]),
      specialty: optionalShortTextSchema,
      bio: noteSchema,
      yearsOfExperience: z.coerce.number().int().min(0).max(80).default(0)
    });
    const data = schema.parse(req.body);

    const role = await Role.findOneAndUpdate(
      { roleName: data.role },
      {
        roleName: data.role,
        parentRoleName: ROLE_HIERARCHY[data.role]?.parent || null,
        isAbstract: false,
        inheritanceChain: getInheritanceChain(data.role),
        description: ROLE_HIERARCHY[data.role]?.description || `Vai trò ${formatRoleName(data.role)}`
      },
      { new: true, upsert: true }
    );
    const user = await User.create({
      ...data,
      roleRef: role._id,
      passwordHash: await hashPassword(data.password)
    });
    await createRoleProfile(user, data);
    const object = user.toObject();
    delete object.passwordHash;
    res.status(201).json({ user: object });
  } catch (error) {
    next(error);
  }
});

router.post("/users/:id/reset-password", async (req, res, next) => {
  try {
    const schema = z.object({
      password: passwordSchema.optional()
    });
    const data = schema.parse(req.body || {});
    const user = await User.findById(req.params.id);

    if (!user) {
      const err = new Error("Không tìm thấy tài khoản.");
      err.statusCode = 404;
      throw err;
    }

    const temporaryPassword = data.password || generateTemporaryPassword();
    user.passwordHash = await hashPassword(temporaryPassword);
    await user.save();

    const object = user.toObject();
    delete object.passwordHash;
    res.json({ user: object, temporaryPassword });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id", async (req, res, next) => {
  try {
    const schema = z.object({
      fullName: nameSchema.optional(),
      phone: optionalPhoneSchema,
      status: z.enum(["active", "inactive", "locked"]).optional(),
      specialty: optionalShortTextSchema,
      bio: noteSchema,
      yearsOfExperience: z.coerce.number().int().min(0).max(80).optional()
    });
    const data = schema.parse(req.body);
    const user = await User.findByIdAndUpdate(req.params.id, data, { new: true }).select("-passwordHash");

    if (!user) {
      const err = new Error("Không tìm thấy tài khoản.");
      err.statusCode = 404;
      throw err;
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.post("/services", async (req, res, next) => {
  try {
    const schema = z.object({
      name: nameSchema,
      description: noteSchema,
      durationMinutes: z.coerce.number().int().min(10).max(480),
      price: z.coerce.number().min(0),
      requiresPrepayment: z.boolean().default(true),
      isConsultation: z.boolean().default(false)
    });
    const service = await DentalService.create(schema.parse(req.body));
    res.status(201).json({ service });
  } catch (error) {
    next(error);
  }
});

router.patch("/services/:id", async (req, res, next) => {
  try {
    const schema = z.object({
      name: nameSchema.optional(),
      description: noteSchema,
      durationMinutes: z.coerce.number().int().min(10).max(480).optional(),
      price: z.coerce.number().min(0).optional(),
      requiresPrepayment: z.boolean().optional(),
      isConsultation: z.boolean().optional(),
      isActive: z.boolean().optional()
    });
    const service = await DentalService.findByIdAndUpdate(req.params.id, schema.parse(req.body), { new: true });

    if (!service) {
      const err = new Error("Không tìm thấy dịch vụ.");
      err.statusCode = 404;
      throw err;
    }

    res.json({ service });
  } catch (error) {
    next(error);
  }
});

router.patch("/rooms/:id", async (req, res, next) => {
  try {
    const schema = z.object({
      name: nameSchema.optional(),
      description: noteSchema,
      equipment: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
      assignedDentist: optionalObjectIdSchema,
      status: z.enum(["available", "in_use", "cleaning", "maintenance"]).optional(),
      isActive: z.boolean().optional()
    });
    const room = await ClinicRoom.findByIdAndUpdate(req.params.id, schema.parse(req.body), { new: true }).populate(
      "assignedDentist",
      "fullName specialty"
    );

    if (!room) {
      const err = new Error("Không tìm thấy phòng khám.");
      err.statusCode = 404;
      throw err;
    }

    res.json({ room });
  } catch (error) {
    next(error);
  }
});

export default router;

async function createRoleProfile(user, data) {
  if (user.role === "patient") {
    await Patient.create({ user: user._id });
  } else if (user.role === "receptionist") {
    await Receptionist.create({ user: user._id });
  } else if (user.role === "dentist") {
    await Dentist.create({
      user: user._id,
      specialization: data.specialty,
      qualification: "DDS",
      experienceYears: data.yearsOfExperience || 0,
      description: data.bio,
      status: "active"
    });
  } else if (user.role === "nurse") {
    await Nurse.create({ user: user._id, qualification: "Y tá đã đăng ký" });
  } else if (user.role === "admin") {
    await AdminProfile.create({ user: user._id, position: "Quản trị hệ thống" });
  }
}

function validateTimeWindow(startTime, endTime) {
  if (startTime >= endTime) {
    const err = new Error("Giờ bắt đầu phải trước giờ kết thúc.");
    err.statusCode = 400;
    throw err;
  }
}

function validateClinicSessionWindow(startTime, endTime) {
  const isValidSession = CLINIC_WORKING_SESSIONS.some((session) => startTime >= session.start && endTime <= session.end);
  if (!isValidSession) {
    throwHttpError("Thời gian phải nằm trong ca sáng 07:00 - 11:30 hoặc ca chiều 13:30 - 17:30.", 400);
  }
}

function validateWorkday(date) {
  if (date.getDay() === 0) {
    const err = new Error("Phòng khám nghỉ Chủ nhật.");
    err.statusCode = 400;
    throw err;
  }
}

async function validateStaffScheduleAssignment({ userId, roomId, workDate, startTime, endTime, status, excludeScheduleId }) {
  const user = await User.findById(userId).select("fullName role status").lean();

  if (!user) {
    throwHttpError("Không tìm thấy tài khoản nhân sự.", 404);
  }

  if (!STAFF_SCHEDULE_ROLES.includes(user.role)) {
    throwHttpError("Chỉ bác sĩ, y tá hoặc lễ tân mới được xếp lịch làm việc.", 400);
  }

  if (user.status !== "active") {
    throwHttpError("Không thể xếp lịch cho tài khoản đang ngưng hoạt động hoặc bị khóa.", 409);
  }

  if (!BLOCKING_SCHEDULE_STATUSES.includes(status)) {
    return;
  }

  const overlapQuery = buildStaffScheduleOverlapQuery({ workDate, startTime, endTime, excludeScheduleId });
  const userConflict = await StaffSchedule.findOne({
    ...overlapQuery,
    user: userId
  })
    .populate("room", "name")
    .lean();

  if (userConflict) {
    const roomName = userConflict.room?.name ? ` tại ${userConflict.room.name}` : "";
    throwHttpError(`Nhân sự này đã có lịch ${userConflict.startTime} - ${userConflict.endTime}${roomName}.`, 409);
  }

  if (!roomId) {
    return;
  }

  const room = await ClinicRoom.findById(roomId).select("name status isActive").lean();
  if (!room) {
    throwHttpError("Không tìm thấy phòng khám.", 404);
  }

  if (!room.isActive || ["maintenance", "unavailable"].includes(room.status)) {
    throwHttpError("Phòng khám đang không khả dụng để xếp lịch.", 409);
  }

  const roomConflicts = await StaffSchedule.find({
    ...overlapQuery,
    room: roomId
  })
    .populate("user", "fullName role")
    .lean();

  const conflict = roomConflicts.find((schedule) => isBlockingRoomSchedule(user.role, schedule.user?.role));
  if (conflict) {
    throwHttpError(buildRoomScheduleConflictMessage(room.name, conflict), 409);
  }
}

function buildStaffScheduleOverlapQuery({ workDate, startTime, endTime, excludeScheduleId }) {
  const query = {
    workDate,
    status: { $in: BLOCKING_SCHEDULE_STATUSES },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime }
  };

  if (excludeScheduleId) {
    query._id = { $ne: excludeScheduleId };
  }

  return query;
}

function isBlockingRoomSchedule(nextRole, existingRole) {
  if (nextRole === "dentist") return existingRole !== "nurse";
  if (nextRole === "nurse") return existingRole !== "dentist";
  return true;
}

function buildRoomScheduleConflictMessage(roomName, conflict) {
  const staffName = conflict.user?.fullName || "nhân sự khác";
  const role = formatRoleName(conflict.user?.role);
  return `${roomName} đã có ${role} ${staffName} làm ${conflict.startTime} - ${conflict.endTime}.`;
}

function formatRoleName(role) {
  const labels = {
    dentist: "bác sĩ",
    nurse: "y tá",
    receptionist: "lễ tân",
    admin: "quản trị viên",
    patient: "bệnh nhân"
  };
  return labels[role] || "nhân sự";
}

function throwHttpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}
