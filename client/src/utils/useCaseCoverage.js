export const systemHighlights = [
  { label: "Quy mô phòng khám", value: "5 phòng, 8 bác sĩ, 8 y tá, 4 lễ tân" },
  { label: "Kênh đặt lịch", value: "Online, offline qua lễ tân, booking consultation" },
  { label: "Lịch động", value: "Theo thời lượng dịch vụ và 10 phút chuyển giao" },
  { label: "Giờ làm việc", value: "Thứ 2 - Thứ 7, 07:00-11:30 và 13:30-17:30" }
];

export const actorUseCaseCoverage = [
  {
    actor: "Guest",
    inherits: "Public visitor",
    summary: "Khách chưa đăng nhập xem thông tin, gửi yêu cầu tư vấn và được điều hướng tạo tài khoản bệnh nhân khi đặt lịch.",
    entry: "/",
    useCases: [
      "Create Appointment Consultation",
      "View Dental Service",
      "View Dentist Profiles",
      "View Clinic Information",
      "Create Account",
      "Login",
      "Forgot Password"
    ]
  },
  {
    actor: "User",
    inherits: "Base account",
    summary: "Tài khoản chung cho mọi vai trò, xử lý hồ sơ, thông báo và đăng xuất.",
    entry: "/profile",
    useCases: ["Logout", "Change Password", "View Profile", "Edit Profile", "View Notifications"]
  },
  {
    actor: "Patient",
    inherits: "User",
    summary: "Bệnh nhân đặt lịch online, đổi/hủy lịch trước 12 giờ, xem hồ sơ điều trị, hóa đơn và đánh giá trong lịch hẹn.",
    entry: "/dashboard",
    useCases: [
      "Booking Appointment",
      "View Appointment",
      "Reschedule Appointment",
      "Cancel Appointment",
      "View Treatment Record",
      "View Treatment Plan",
      "View Prescription",
      "View Invoice",
      "Make Payment",
      "Review & Rating"
    ]
  },
  {
    actor: "Receptionist",
    inherits: "User",
    summary: "Lễ tân vận hành lịch hẹn ngày, check-in/no-show, tư vấn, phòng khám và đặt lịch hộ.",
    entry: "/dashboard",
    useCases: [
      "Manage Appointments",
      "View Appointments",
      "Update Appointment Status",
      "Check-in Patient",
      "Handle No-show",
      "Generate Invoice",
      "Process Payment",
      "Manage Consultation Requests",
      "View Consultation Requests",
      "Update Consultation Status",
      "Booking Appointment For Patient",
      "Search Account",
      "Create Patient Account",
      "Manage Clinical Room",
      "View Clinical Room",
      "Update Room Status"
    ]
  },
  {
    actor: "Clinical Staff",
    inherits: "User",
    summary: "Nhân sự lâm sàng xem lịch làm việc và thông tin bệnh nhân được phân công.",
    entry: "/dashboard",
    useCases: ["View Work Schedule", "View Patient Information"]
  },
  {
    actor: "Dentist",
    inherits: "Clinical Staff",
    summary: "Bác sĩ xem lịch khám, thông tin bệnh nhân và lịch sử điều trị để phục vụ khám chữa.",
    entry: "/dashboard",
    useCases: ["View Work Schedule", "View Patient Information", "View Patient Treatment History"]
  },
  {
    actor: "Nurse",
    inherits: "Clinical Staff",
    summary: "Y tá ghi nhận sinh hiệu, chẩn đoán, kế hoạch, đơn thuốc, ghi chú điều trị và trạng thái phòng.",
    entry: "/dashboard",
    useCases: [
      "View Work Schedule",
      "View Patient Information",
      "Record Vital Signs",
      "Update Treatment Note",
      "Prescribe Medicine",
      "Update Room Status",
      "Manage Treatment Plan",
      "Record Diagnosis"
    ]
  },
  {
    actor: "Admin",
    inherits: "User",
    summary: "Quản trị cấu hình hệ thống, tài khoản, phòng, dịch vụ, giờ làm, lịch nhân sự và báo cáo.",
    entry: "/dashboard",
    useCases: [
      "Manage Dental Services",
      "Manage Accounts",
      "Manage Clinic Rooms",
      "Manage Clinic Working Hours",
      "Manage Staff Schedule",
      "View Revenue Report",
      "View Patient Statistics",
      "View Review & Rating",
      "View No-show Statistics",
      "Export Report"
    ]
  }
];

export const erdCoverage = [
  "ROLE",
  "USER",
  "PATIENT / RECEPTIONIST / DENTIST / NURSE / ADMIN",
  "CLINIC_WORKING_HOUR / TIME_SLOT / STAFF_SCHEDULE",
  "DENTAL_SERVICE / DENTIST_SERVICE",
  "CLINIC_ROOM / ROOM_STATUS",
  "APPOINTMENT_SLOT / APPOINTMENT / WAITLIST",
  "BOOKING_CONSULTATION",
  "TREATMENT_RECORD / TREATMENT_PLAN / PRESCRIPTION",
  "INVOICE / PAYMENT",
  "REVIEW_RATING / NOTIFICATION"
];
