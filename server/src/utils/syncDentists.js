import "dotenv/config";
import dns from "node:dns";
import mongoose from "mongoose";
import { getInheritanceChain } from "../config/roleHierarchy.js";
import { connectDB } from "../config/db.js";
import ClinicRoom from "../models/ClinicRoom.js";
import Dentist from "../models/Dentist.js";
import DentistService from "../models/DentistService.js";
import DentalService from "../models/DentalService.js";
import Role from "../models/Role.js";
import StaffSchedule from "../models/StaffSchedule.js";
import User from "../models/User.js";
import { hashPassword } from "./password.js";

const dnsServers = process.env.DNS_SERVERS?.split(",").map((server) => server.trim()).filter(Boolean);

if (dnsServers?.length) {
  dns.setServers(dnsServers);
}

const canonicalDentists = [
  {
    fullName: "BS. Nguyễn Minh Anh",
    email: "dentist1@das.local",
    phone: "0902000001",
    specialty: "Chỉnh nha và phục hình thẩm mỹ",
    yearsOfExperience: 12,
    bio: "Tư vấn kế hoạch điều trị rõ ràng, theo dõi sát quá trình niềng răng và phục hình.",
    licenseNo: "DAS-DEN-001"
  },
  {
    fullName: "BS. Trần Hoàng Nam",
    email: "dentist2@das.local",
    phone: "0902000002",
    specialty: "Cấy ghép Implant",
    yearsOfExperience: 9,
    bio: "Phụ trách điều trị phục hồi răng mất, lập kế hoạch an toàn và tối ưu chức năng ăn nhai.",
    licenseNo: "DAS-DEN-002"
  },
  {
    fullName: "BS. Lê Thanh Vy",
    email: "dentist3@das.local",
    phone: "0902000003",
    specialty: "Nha khoa tổng quát",
    yearsOfExperience: 15,
    bio: "Khám ban đầu, tư vấn chăm sóc răng miệng định kỳ và đồng hành cùng bệnh nhân lâu dài.",
    licenseNo: "DAS-DEN-003"
  }
];

async function ensureDentistRole() {
  return Role.findOneAndUpdate(
    { roleName: "dentist" },
    {
      roleName: "dentist",
      parentRoleName: "clinical_staff",
      isAbstract: false,
      inheritanceChain: getInheritanceChain("dentist"),
      description: "Bác sĩ điều trị, xem lịch, ghi kết quả khám, kế hoạch điều trị và đơn thuốc."
    },
    { new: true, upsert: true }
  );
}

async function upsertCanonicalDentists(roleRef) {
  const passwordHash = await hashPassword("Password123!");
  const dentists = [];

  for (const profile of canonicalDentists) {
    const update = {
      ...profile,
      role: "dentist",
      roleRef: roleRef._id,
      status: "active"
    };
    const user = await User.findOneAndUpdate(
      { phone: profile.phone },
      {
        $set: update,
        $setOnInsert: { passwordHash }
      },
      { new: true, upsert: true }
    );

    await Dentist.findOneAndUpdate(
      { user: user._id },
      {
        user: user._id,
        specialization: profile.specialty,
        qualification: "Bác sĩ Răng Hàm Mặt",
        experienceYears: profile.yearsOfExperience,
        description: profile.bio,
        status: "active"
      },
      { new: true, upsert: true }
    );

    dentists.push(user);
  }

  return dentists;
}

async function removeExtraDentists(allowedIds) {
  const extraDentists = await User.find({ role: "dentist", _id: { $nin: allowedIds } }).select("_id fullName phone").lean();
  const extraIds = extraDentists.map((dentist) => dentist._id);

  if (!extraIds.length) {
    return [];
  }

  await Promise.all([
    Dentist.deleteMany({ user: { $in: extraIds } }),
    DentistService.deleteMany({ dentist: { $in: extraIds } }),
    StaffSchedule.deleteMany({ user: { $in: extraIds } }),
    ClinicRoom.updateMany({ assignedDentist: { $in: extraIds } }, { $unset: { assignedDentist: "" } }),
    User.deleteMany({ _id: { $in: extraIds } })
  ]);

  return extraDentists;
}

async function syncDentistServices(dentists) {
  const services = await DentalService.find({ isActive: true }).select("_id").lean();
  const dentistIds = dentists.map((dentist) => dentist._id);

  await DentistService.deleteMany({ dentist: { $in: dentistIds } });
  await DentistService.create(
    dentists.flatMap((dentist) =>
      services.map((service) => ({
        dentist: dentist._id,
        service: service._id
      }))
    )
  );
}

async function syncRooms(dentists) {
  const rooms = await ClinicRoom.find({}).sort({ name: 1 });

  for (let index = 0; index < dentists.length; index += 1) {
    const room = rooms[index] || new ClinicRoom({ name: `Phòng khám ${index + 1}` });
    room.roomType = room.roomType || "Phòng điều trị nha khoa";
    room.description = room.description || "Phòng được trang bị cho quy trình vận hành DAS.";
    room.assignedDentist = dentists[index]._id;
    room.status = room.status || "available";
    room.isActive = true;
    await room.save();
  }

  const extraRooms = rooms.slice(dentists.length);
  for (const room of extraRooms) {
    room.assignedDentist = undefined;
    await room.save();
  }
}

async function run() {
  await connectDB(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/das");
  const role = await ensureDentistRole();
  const dentists = await upsertCanonicalDentists(role);
  const removed = await removeExtraDentists(dentists.map((dentist) => dentist._id));
  await syncDentistServices(dentists);
  await syncRooms(dentists);

  console.log(`Đã đồng bộ ${dentists.length} bác sĩ active.`);
  console.log(`Đã xóa ${removed.length} bác sĩ dư.`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
