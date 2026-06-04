const labels = {
  pending: "Chờ tiếp nhận",
  scheduled: "Đang chờ",
  confirmed: "Đang chờ",
  waitlisted: "Hàng đợi",
  rejected: "Từ chối",
  called: "Đã gọi",
  checked_in: "Có mặt",
  in_treatment: "Đang khám",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
  no_show: "Vắng mặt",
  waiting: "Đang chờ",
  contacted: "Đã liên hệ",
  booked: "Đã đặt lịch",
  expired: "Quá hạn",
  new: "Mới",
  closed: "Đóng",
  active: "Hoạt động",
  inactive: "Ngưng",
  locked: "Khóa",
  available: "Sẵn sàng",
  in_use: "Đang dùng",
  cleaning: "Vệ sinh",
  maintenance: "Bảo trì",
  paid: "Đã trả",
  unpaid: "Chưa trả",
  pending_checkin: "Thanh toán khi đến",
  not_required: "Không yêu cầu",
  refunded: "Đã hoàn tiền",
  off: "Nghỉ",
  draft: "Nháp"
};

export default function StatusBadge({ value }) {
  return <span className={`status status-${value}`}>{labels[value] || value || "-"}</span>;
}
