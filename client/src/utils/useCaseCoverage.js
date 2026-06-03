export const systemHighlights = [
  { label: "Quy mô phòng khám", value: "1 chi nhánh, 5 phòng, 8 bác sĩ, 8 y tá, 4 lễ tân" },
  { label: "Luồng đặt lịch", value: "Chọn dịch vụ, nha sĩ, slot 30 phút và xác nhận lịch" },
  { label: "Vận hành lâm sàng", value: "Nha sĩ ghi kết quả khám, y tá hỗ trợ sinh hiệu và hồ sơ điều trị" },
  { label: "Báo cáo quản lý", value: "Lịch hẹn, doanh thu, bệnh nhân mới/tái khám và hiệu suất nhân sự" }
];

export const workflowUseCases = [
  {
    workflow: "WF0",
    name: "Authentication & Authorization",
    useCases: [
      { id: "UCA01", actor: "Guest", name: "Register Patient", description: "Bệnh nhân đăng ký tài khoản bằng email hoặc số điện thoại." },
      { id: "UCA02", actor: "User", name: "Login / Logout", description: "Đăng nhập đa vai trò và đăng xuất khỏi hệ thống." },
      { id: "UCA03", actor: "User", name: "Forgot Password", description: "Yêu cầu reset mật khẩu qua email hoặc hỗ trợ xác minh." },
      { id: "UCA04", actor: "User", name: "Profile Management", description: "Cập nhật thông tin cá nhân, ảnh đại diện và mật khẩu." },
      { id: "UCA05", actor: "User", name: "Notification Management", description: "Xem và đánh dấu đã đọc các thông báo hệ thống." }
    ]
  },
  {
    workflow: "WF1",
    name: "Master Data Setup",
    useCases: [
      { id: "UCA06", actor: "Guest", name: "View Clinic Info & Services", description: "Xem thông tin phòng khám, giờ làm, dịch vụ và hồ sơ nha sĩ." },
      { id: "UCA07", actor: "Admin", name: "Manage Dental Services", description: "CRUD danh mục dịch vụ nha khoa như tẩy trắng, trám răng, niềng răng." },
      { id: "UCA08", actor: "Admin", name: "Manage Dentist Profiles", description: "CRUD hồ sơ nha sĩ, chuyên môn, kinh nghiệm và dịch vụ phụ trách." },
      { id: "UCA09", actor: "Admin", name: "Manage Nurse Profiles", description: "Quản lý hồ sơ y tá và phân công hỗ trợ lâm sàng." },
      { id: "UCA10", actor: "Admin", name: "Manage Clinic Info", description: "Cập nhật thông tin phòng khám, địa chỉ và giờ hoạt động." },
      { id: "UCA11", actor: "Admin", name: "Manage Clinic Rooms", description: "Quản lý phòng khám, thiết bị, trạng thái phòng và nha sĩ phụ trách." },
      { id: "UCA12", actor: "Dentist / Nurse", name: "Manage Work Schedule", description: "Thiết lập hoặc xem lịch làm việc theo tuần với các slot 30 phút." }
    ]
  },
  {
    workflow: "WF2",
    name: "Core Transaction Flow",
    useCases: [
      { id: "UCA13", actor: "Patient", name: "Book Appointment", description: "Chọn dịch vụ, nha sĩ, slot trống và gửi yêu cầu đặt lịch để lễ tân tiếp nhận.", path: "Success" },
      { id: "UCA14", actor: "Patient", name: "View Appointment History", description: "Xem lịch hẹn hiện tại, lịch sử khám và hồ sơ điều trị." },
      { id: "UCA15", actor: "Receptionist", name: "Confirm Appointment", description: "Xác nhận lịch hẹn hợp lệ với bệnh nhân.", path: "Success" },
      { id: "UCA16", actor: "Receptionist", name: "Reject / Waitlist Appointment", description: "Từ chối lịch hẹn hoặc chuyển vào hàng đợi khi chưa thể xác nhận slot ngay." },
      { id: "UCA17", actor: "Receptionist", name: "Check-in Patient", description: "Check-in khi bệnh nhân đến phòng khám.", path: "Success" },
      { id: "UCA18", actor: "Dentist", name: "Record Treatment Result", description: "Ghi kết quả khám, chẩn đoán và ghi chú điều trị.", path: "Success" },
      { id: "UCA19", actor: "Nurse", name: "Record Vital Signs", description: "Y tá ghi sinh hiệu và thông tin hỗ trợ trước hoặc trong buổi khám." },
      { id: "UCA20", actor: "Dentist / Nurse", name: "Manage Treatment Plan", description: "Tạo hoặc cập nhật kế hoạch điều trị cho bệnh nhân." },
      { id: "UCA21", actor: "Dentist", name: "Prescribe Medicine", description: "Ghi đơn thuốc hoặc hướng dẫn chăm sóc sau điều trị." },
      { id: "UCA22", actor: "Patient / Receptionist", name: "Cancel Appointment", description: "Hủy lịch trước giờ khám ít nhất 24 giờ.", path: "Exception" },
      { id: "UCA23", actor: "Patient / Receptionist", name: "Reschedule Appointment", description: "Dời lịch hẹn sang slot trống khác.", path: "Exception" },
      { id: "UCA24", actor: "Receptionist", name: "Handle No-Show", description: "Tự động hoặc thủ công xử lý bệnh nhân không đến.", path: "Exception" },
      { id: "UCA25", actor: "Receptionist", name: "Process Invoice / Payment", description: "Ghi nhận hóa đơn và thanh toán khi bệnh nhân hoàn tất dịch vụ." },
      { id: "UCA26", actor: "Patient", name: "Review Service", description: "Bệnh nhân đánh giá dịch vụ sau khi hoàn tất lịch hẹn." }
    ]
  },
  {
    workflow: "WF3",
    name: "Dashboard & Reporting",
    useCases: [
      { id: "UCA27", actor: "Receptionist / Admin", name: "Appointment Dashboard", description: "Tổng quan lịch hẹn hôm nay, tuần và tháng." },
      { id: "UCA28", actor: "Admin", name: "Revenue Report", description: "Thống kê doanh thu theo dịch vụ, nha sĩ và thời gian." },
      { id: "UCA29", actor: "Admin", name: "Patient Statistics", description: "Thống kê bệnh nhân mới, bệnh nhân tái khám và tỉ lệ no-show." },
      { id: "UCA30", actor: "Admin", name: "Service & Staff Statistics", description: "Thống kê hiệu suất dịch vụ, nha sĩ, y tá và phòng khám." }
    ]
  }
];

export const actorUseCaseCoverage = [
  {
    actor: "Guest",
    summary: "Khách xem thông tin phòng khám, dịch vụ, hồ sơ nha sĩ và đăng ký tài khoản bệnh nhân.",
    entry: "/",
    useCases: ["UCA01", "UCA03", "UCA06"]
  },
  {
    actor: "User",
    summary: "Tài khoản chung cho mọi vai trò, dùng để đăng nhập, quản lý hồ sơ và thông báo.",
    entry: "/profile",
    useCases: ["UCA02", "UCA03", "UCA04", "UCA05"]
  },
  {
    actor: "Patient",
    summary: "Bệnh nhân đặt lịch online, xem lịch sử khám, hủy/dời lịch trước 24 giờ, thanh toán và đánh giá dịch vụ.",
    entry: "/dashboard",
    useCases: ["UCA13", "UCA14", "UCA22", "UCA23", "UCA26"]
  },
  {
    actor: "Receptionist",
    summary: "Lễ tân tiếp nhận lịch online, xác nhận, từ chối hoặc chuyển vào hàng đợi, check-in, xử lý no-show, đặt lịch hộ và ghi nhận thanh toán.",
    entry: "/dashboard",
    useCases: ["UCA15", "UCA16", "UCA17", "UCA22", "UCA23", "UCA24", "UCA25", "UCA27"]
  },
  {
    actor: "Dentist",
    summary: "Nha sĩ quản lý lịch làm việc, xem danh sách bệnh nhân và ghi kết quả khám/điều trị.",
    entry: "/dashboard",
    useCases: ["UCA08", "UCA12", "UCA18", "UCA20", "UCA21", "UCA30"]
  },
  {
    actor: "Nurse",
    summary: "Y tá hỗ trợ vận hành lâm sàng, xem lịch, ghi sinh hiệu, cập nhật hồ sơ và trạng thái phòng.",
    entry: "/dashboard",
    useCases: ["UCA09", "UCA12", "UCA19", "UCA20", "UCA30"]
  },
  {
    actor: "Admin / Manager",
    summary: "Quản lý master data, tài khoản, phòng khám, dashboard và các báo cáo thống kê.",
    entry: "/dashboard",
    useCases: ["UCA07", "UCA08", "UCA09", "UCA10", "UCA11", "UCA27", "UCA28", "UCA29", "UCA30"]
  }
];

export const erdCoverage = [
  "ROLE / USER",
  "PATIENT / RECEPTIONIST / DENTIST / NURSE / ADMIN",
  "CLINIC_WORKING_HOUR / TIME_SLOT / STAFF_SCHEDULE",
  "DENTAL_SERVICE / DENTIST_SERVICE",
  "CLINIC_ROOM / ROOM_STATUS",
  "APPOINTMENT_SLOT / APPOINTMENT",
  "CONSULTATION_REQUEST",
  "TREATMENT_RECORD / TREATMENT_PLAN / PRESCRIPTION",
  "INVOICE / PAYMENT",
  "REVIEW / NOTIFICATION"
];
