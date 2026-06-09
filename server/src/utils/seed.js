import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { getInheritanceChain, ROLE_HIERARCHY } from "../config/roleHierarchy.js";
import AdminProfile from "../models/AdminProfile.js";
import Appointment from "../models/Appointment.js";
import AppointmentSlot from "../models/AppointmentSlot.js";
import ClinicRoom from "../models/ClinicRoom.js";
import ClinicWorkingHour from "../models/ClinicWorkingHour.js";
import ConsultationRequest from "../models/ConsultationRequest.js";
import DentalService from "../models/DentalService.js";
import Dentist from "../models/Dentist.js";
import DentistService from "../models/DentistService.js";
import Invoice from "../models/Invoice.js";
import Notification from "../models/Notification.js";
import Nurse from "../models/Nurse.js";
import Patient from "../models/Patient.js";
import Payment from "../models/Payment.js";
import Prescription from "../models/Prescription.js";
import Receptionist from "../models/Receptionist.js";
import Review from "../models/Review.js";
import Role from "../models/Role.js";
import RoomStatus from "../models/RoomStatus.js";
import StaffSchedule from "../models/StaffSchedule.js";
import TimeSlot from "../models/TimeSlot.js";
import TreatmentPlan from "../models/TreatmentPlan.js";
import TreatmentRecord from "../models/TreatmentRecord.js";
import User from "../models/User.js";
import { createAppointmentFromSlot } from "../services/schedulingService.js";
import { isWorkingDate, toDateInputValue } from "../utils/time.js";
import { hashPassword } from "../utils/password.js";

function nextWorkingDates(count, offsetDays = 1) {
  const dates = [];
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  while (dates.length < count) {
    const dateText = toDateInputValue(date);
    if (isWorkingDate(dateText)) {
      dates.push(dateText);
    }
    date.setDate(date.getDate() + 1);
  }

  return dates;
}

async function clearDatabase() {
  await Promise.all([
    AdminProfile.deleteMany({}),
    Appointment.deleteMany({}),
    AppointmentSlot.deleteMany({}),
    ClinicRoom.deleteMany({}),
    ClinicWorkingHour.deleteMany({}),
    ConsultationRequest.deleteMany({}),
    DentalService.deleteMany({}),
    Dentist.deleteMany({}),
    DentistService.deleteMany({}),
    Invoice.deleteMany({}),
    Notification.deleteMany({}),
    Nurse.deleteMany({}),
    Patient.deleteMany({}),
    Payment.deleteMany({}),
    Prescription.deleteMany({}),
    Receptionist.deleteMany({}),
    Review.deleteMany({}),
    Role.deleteMany({}),
    RoomStatus.deleteMany({}),
    StaffSchedule.deleteMany({}),
    TimeSlot.deleteMany({}),
    TreatmentPlan.deleteMany({}),
    TreatmentRecord.deleteMany({}),
    User.deleteMany({})
  ]);
}

async function createRoles() {
  const roles = {};
  for (const [roleName, config] of Object.entries(ROLE_HIERARCHY)) {
    roles[roleName] = await Role.create({
      roleName,
      parentRoleName: config.parent,
      isAbstract: config.abstract,
      inheritanceChain: getInheritanceChain(roleName),
      description: config.description
    });
  }
  return roles;
}

async function createUser({ fullName, email, phone, role, roleRef, passwordHash, extra = {} }) {
  return User.create({
    fullName,
    email,
    phone,
    role,
    roleRef,
    passwordHash,
    ...extra
  });
}

async function createWorkingCalendar() {
  const workingHours = [];
  for (const dayOfWeek of [1, 2, 3, 4, 5, 6]) {
    workingHours.push(
      {
        dayOfWeek,
        shiftName: "Ca sáng",
        startTime: "08:00",
        endTime: "11:30",
        status: "active"
      },
      {
        dayOfWeek,
        shiftName: "Ca chiều",
        startTime: "14:00",
        endTime: "17:30",
        status: "active"
      }
    );
  }
  await ClinicWorkingHour.create(workingHours);

  return TimeSlot.create([
    { slotName: "Ca sáng", startTime: "08:00", endTime: "11:30" },
    { slotName: "Ca chiều", startTime: "14:00", endTime: "17:30" }
  ]);
}

async function run() {
  await connectDB(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/das");
  await clearDatabase();

  const passwordHash = await hashPassword("Password123!");
  const roles = await createRoles();
  const timeSlots = await createWorkingCalendar();

  const admin = await createUser({
    fullName: "Quản trị DAS",
    email: "admin@das.local",
    phone: "0900000000",
    role: "admin",
    roleRef: roles.admin._id,
    passwordHash
  });
  await AdminProfile.create({
    user: admin._id,
    position: "Quản trị hệ thống phòng khám",
    permissionLevel: "super_admin"
  });

  const receptionists = await User.create(
    Array.from({ length: 4 }).map((_, index) => ({
      fullName: `Lễ tân ${index + 1}`,
      email: `receptionist${index + 1}@das.local`,
      phone: `090100000${index + 1}`,
      role: "receptionist",
      roleRef: roles.receptionist._id,
      passwordHash
    }))
  );
  await Receptionist.create(receptionists.map((user) => ({ user: user._id, status: "active" })));

  const dentists = await User.create(
    Array.from({ length: 8 }).map((_, index) => ({
      fullName: `Bác sĩ ${index + 1}`,
      email: `dentist${index + 1}@das.local`,
      phone: `090200000${index + 1}`,
      role: "dentist",
      roleRef: roles.dentist._id,
      specialty: index % 2 === 0 ? "Nha khoa tổng quát và phục hình" : "Phẫu thuật răng miệng",
      yearsOfExperience: 4 + index,
      bio: "Bác sĩ phụ trách khám, tư vấn và điều trị nha khoa.",
      licenseNo: `DAS-DEN-${String(index + 1).padStart(3, "0")}`,
      passwordHash
    }))
  );
  await Dentist.create(
    dentists.map((user, index) => ({
      user: user._id,
      specialization: user.specialty,
      qualification: "Bác sĩ Răng Hàm Mặt",
      experienceYears: 4 + index,
      description: user.bio,
      status: "active"
    }))
  );

  const nurses = await User.create(
    Array.from({ length: 8 }).map((_, index) => ({
      fullName: `Y tá ${index + 1}`,
      email: `nurse${index + 1}@das.local`,
      phone: `090300000${index + 1}`,
      role: "nurse",
      roleRef: roles.nurse._id,
      yearsOfExperience: 2 + index,
      passwordHash
    }))
  );
  await Nurse.create(nurses.map((user) => ({ user: user._id, qualification: "Y tá đã đăng ký", status: "active" })));

  const patients = await User.create([
    {
      fullName: "Bệnh nhân 1",
      email: "patient1@das.local",
      phone: "0911000001",
      role: "patient",
      roleRef: roles.patient._id,
      gender: "unknown",
      address: "Quận 1",
      passwordHash
    },
    {
      fullName: "Bệnh nhân 2",
      email: "patient2@das.local",
      phone: "0911000002",
      role: "patient",
      roleRef: roles.patient._id,
      gender: "unknown",
      address: "Quận 3",
      passwordHash
    }
  ]);
  await Patient.create([
    {
      user: patients[0]._id,
      gender: "unknown",
      address: "Quận 1",
      medicalNote: "Chưa ghi nhận dị ứng."
    },
    {
      user: patients[1]._id,
      gender: "unknown",
      address: "Quận 3",
      medicalNote: "Ưu tiên lịch buổi chiều."
    }
  ]);

  const services = await DentalService.create([
    {
      name: "Trám răng",
      description: "Điều trị sâu răng giá cố định, thanh toán khi bệnh nhân đến khám.",
      durationMinutes: 30,
      transitionTime: 10,
      price: 300000,
      requiresPrepayment: true
    },
    {
      name: "Nhổ răng khôn",
      description: "Dịch vụ phẫu thuật răng miệng, thời lượng dự kiến 60 phút.",
      durationMinutes: 60,
      transitionTime: 10,
      price: 1500000,
      requiresPrepayment: true
    },
    {
      name: "Tư vấn nha khoa",
      description: "Tư vấn cho bệnh nhân chưa xác định rõ tình trạng răng miệng.",
      durationMinutes: 30,
      transitionTime: 10,
      price: 0,
      requiresPrepayment: false,
      isConsultation: true
    },
    {
      name: "Cạo vôi răng",
      description: "Dịch vụ vệ sinh răng miệng giá cố định.",
      durationMinutes: 30,
      transitionTime: 10,
      price: 250000,
      requiresPrepayment: true
    },
    {
      name: "Tẩy trắng răng",
      description: "Dịch vụ thẩm mỹ nha khoa giá cố định.",
      durationMinutes: 45,
      transitionTime: 10,
      price: 1200000,
      requiresPrepayment: true
    }
  ]);

  await DentistService.create(
    dentists.flatMap((dentist) =>
      services.map((service) => ({
        dentist: dentist._id,
        service: service._id
      }))
    )
  );

  const rooms = await ClinicRoom.create(
    Array.from({ length: 5 }).map((_, index) => ({
      name: `Phòng khám ${index + 1}`,
      roomType: "Phòng điều trị nha khoa",
      description: "Phòng được trang bị cho quy trình vận hành DAS.",
      assignedDentist: dentists[index]._id,
      equipment: ["Máy chụp X-quang", "Máy đo huyết áp", "Máy đo SpO2", "Nhiệt kế", "Máy theo dõi hô hấp"],
      status: "available"
    }))
  );

  await RoomStatus.create(
    rooms.map((room, index) => ({
      room: room._id,
      nurse: nurses[index % nurses.length]._id,
      availabilityStatus: "available",
      note: "Trạng thái phòng ban đầu từ dữ liệu mẫu ERD."
    }))
  );

  const workingDates = nextWorkingDates(12, 1);
  await StaffSchedule.create(
    workingDates.flatMap((dateText) => {
      const workDate = new Date(`${dateText}T00:00:00`);
      const dentistSchedules = rooms.flatMap((room, roomIndex) =>
        timeSlots.map((slot) => ({
          user: dentists[roomIndex]._id,
          room: room._id,
          timeSlot: slot._id,
          workDate,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: "scheduled"
        }))
      );
      const nurseSchedules = nurses.flatMap((nurse) =>
        timeSlots.map((slot) => ({
          user: nurse._id,
          timeSlot: slot._id,
          workDate,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: "scheduled"
        }))
      );
      return [...dentistSchedules, ...nurseSchedules];
    })
  );

  const date = workingDates[0];
  const firstAppointment = await createAppointmentFromSlot({
    requester: receptionists[0],
    patientId: patients[0]._id,
    serviceId: services[0]._id,
    date,
    channel: "offline",
    note: "Lịch mẫu cho bảng lễ tân."
  });

  const consultationAppointment = await createAppointmentFromSlot({
    requester: patients[1],
    patientId: patients[1]._id,
    serviceId: services[2]._id,
    date,
    channel: "online",
    note: "Lịch tư vấn trực tuyến mẫu."
  });

  const invoice = await Invoice.create({
    appointment: firstAppointment._id,
    patient: patients[0]._id,
    items: [{ name: services[0].name, amount: services[0].price }],
    total: services[0].price,
    totalAmount: services[0].price,
    invoiceDate: new Date(),
    status: "unpaid"
  });

  await Payment.create({
    invoice: invoice._id,
    paymentMethod: "cash",
    amount: 0,
    paymentStatus: "pending"
  });

  const treatmentRecord = await TreatmentRecord.create({
    appointment: consultationAppointment._id,
    patient: patients[1]._id,
    dentist: consultationAppointment.dentist,
    nurse: consultationAppointment.nurse,
    diagnosis: "Hồ sơ tư vấn ban đầu.",
    treatmentResult: "Đang chờ kế hoạch điều trị.",
    treatmentDate: new Date(),
    status: "draft"
  });

  await TreatmentPlan.create({
    treatmentRecord: treatmentRecord._id,
    dentist: consultationAppointment.dentist,
    planDetail: "Tái khám và lập dự toán điều trị chi tiết.",
    estimatedCost: 0,
    startDate: new Date(),
    status: "draft"
  });

  await Prescription.create({
    treatmentRecord: treatmentRecord._id,
    dentist: consultationAppointment.dentist,
    medicineName: "Thuốc giảm đau khi cần",
    dosage: "Theo hướng dẫn",
    instruction: "Chỉ dùng khi đau trước buổi tái khám.",
    note: "Đơn thuốc mẫu."
  });

  await ConsultationRequest.create({
    fullName: "Khách tư vấn",
    phone: "0988000001",
    email: "guest@example.com",
    service: services[2]._id,
    preferredDate: new Date(`${date}T00:00:00`),
    preferredTime: "14:00",
    message: "Muốn tư vấn đau răng trước khi đặt lịch."
  });

  await Notification.create([
    {
      user: patients[0]._id,
      title: "Đã tạo lịch hẹn",
      message: "Lịch hẹn của bạn đã được tạo từ dữ liệu mẫu.",
      isRead: false
    },
    {
      user: patients[1]._id,
      title: "Đã đặt lịch tư vấn",
      message: "Lịch tư vấn trực tuyến của bạn đã được tạo.",
      isRead: false
    }
  ]);

  console.log("Đã seed xong dữ liệu theo ERD");
  console.log("Mật khẩu demo: Password123!");
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
