import { Router } from "express";
import { z } from "zod";
import User from "../models/User.js";
import Patient from "../models/Patient.js";
import Notification from "../models/Notification.js";
import Role from "../models/Role.js";
import { getInheritanceChain } from "../config/roleHierarchy.js";
import { requireAuth } from "../middlewares/auth.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { signToken } from "../utils/tokens.js";
import { nameSchema, passwordSchema, phoneSchema } from "../utils/validation.js";

const router = Router();

const registerSchema = z
  .object({
    fullName: nameSchema.optional(),
    phone: phoneSchema,
    gender: z.enum(["male", "female", "other", "unknown"]).default("unknown"),
    address: z.string().trim().max(255).optional().or(z.literal("")),
    password: passwordSchema,
    confirmPassword: z.string().min(1)
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu nhập lại không khớp.",
    path: ["confirmPassword"]
  });

const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1)
});

const forgotPasswordSchema = z.object({
  phone: phoneSchema
});

function serializeUser(user) {
  const object = user.toObject ? user.toObject() : user;
  delete object.passwordHash;
  return object;
}

function phoneEmail(phone) {
  return `${phone.replace(/\D/g, "")}@phone.das.local`;
}

async function ensurePatientRole() {
  return Role.findOneAndUpdate(
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
}

router.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await User.findOne({ phone: data.phone });

    if (existing) {
      const err = new Error("Số điện thoại đã được đăng ký.");
      err.statusCode = 409;
      throw err;
    }

    const patientRole = await ensurePatientRole();
    const user = await User.create({
      fullName: data.fullName || `Bệnh nhân ${data.phone}`,
      email: phoneEmail(data.phone),
      phone: data.phone,
      passwordHash: await hashPassword(data.password),
      roleRef: patientRole._id,
      role: "patient"
    });
    await Patient.create({
      user: user._id,
      gender: data.gender,
      address: data.address || undefined
    });

    res.status(201).json({
      message: "Đăng ký tài khoản thành công. Vui lòng đăng nhập bằng số điện thoại."
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await User.findOne({ phone: data.phone });

    if (!user || !(await comparePassword(data.password, user.passwordHash))) {
      const err = new Error("Số điện thoại hoặc mật khẩu không đúng.");
      err.statusCode = 401;
      throw err;
    }

    if (user.status !== "active") {
      const err = new Error("Tài khoản đang không hoạt động.");
      err.statusCode = 403;
      throw err;
    }

    res.json({
      user: serializeUser(user),
      token: signToken(user)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      fullName: nameSchema.optional(),
      phone: phoneSchema.optional(),
      gender: z.enum(["male", "female", "other", "unknown"]).optional(),
      address: z.string().trim().max(255).optional().or(z.literal("")),
      avatarUrl: z.string().url().optional().or(z.literal("")),
      bio: z.string().trim().max(1000).optional()
    });
    const data = schema.parse(req.body);

    if (data.phone && data.phone !== req.user.phone) {
      const duplicate = await User.findOne({ phone: data.phone, _id: { $ne: req.user._id } });
      if (duplicate) {
        const err = new Error("Số điện thoại đã tồn tại.");
        err.statusCode = 409;
        throw err;
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        fullName: data.fullName,
        phone: data.phone,
        avatarUrl: data.avatarUrl || undefined,
        bio: data.bio
      },
      { new: true }
    ).select("-passwordHash");

    if (user.role === "patient" && (data.gender || data.address !== undefined)) {
      await Patient.findOneAndUpdate(
        { user: user._id },
        { gender: data.gender, address: data.address || undefined },
        { upsert: true }
      );
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.get("/notifications", requireAuth, async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ notifications });
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);
    const user = await User.findOne({ phone: data.phone });

    res.json({
      message: user
        ? "Yêu cầu đặt lại mật khẩu đã được ghi nhận. Lễ tân hoặc quản trị viên sẽ hỗ trợ xác minh tài khoản."
        : "Nếu số điện thoại tồn tại, hệ thống sẽ ghi nhận yêu cầu hỗ trợ đặt lại mật khẩu."
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/change-password", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: passwordSchema
    });
    const data = schema.parse(req.body);
    const user = await User.findById(req.user._id);

    if (!(await comparePassword(data.currentPassword, user.passwordHash))) {
      const err = new Error("Mật khẩu hiện tại không đúng.");
      err.statusCode = 400;
      throw err;
    }

    user.passwordHash = await hashPassword(data.newPassword);
    await user.save();
    res.json({ message: "Đã đổi mật khẩu." });
  } catch (error) {
    next(error);
  }
});

export default router;
