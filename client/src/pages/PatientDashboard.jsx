import {
  Bell,
  CalendarClock,
  Camera,
  CheckCircle2,
  CreditCard,
  FileText,
  Home,
  LockKeyhole,
  Menu,
  ReceiptText,
  RefreshCw,
  Save,
  Star,
  UserRound,
  X,
  XCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import EmptyState from "../components/EmptyState.jsx";
import Feedback from "../components/Feedback.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api, getErrorMessage } from "../services/api.js";
import { formatDateTime, formatMoney, todayInput } from "../utils/format.js";
import { firstError, validateName, validatePassword, validatePhone } from "../utils/validation.js";

const patientNav = [
  { id: "home", label: "Trang chủ", icon: Home },
  { id: "appointments", label: "Lịch hẹn", icon: CalendarClock },
  { id: "records", label: "Hồ sơ điều trị", icon: FileText },
  { id: "account", label: "Tài khoản", icon: UserRound },
  { id: "notifications", label: "Thông báo", icon: Bell }
];

export default function PatientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeFeature, setActiveFeature] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [records, setRecords] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [rescheduleDates, setRescheduleDates] = useState({});
  const [review, setReview] = useState({ appointmentId: "", rating: 5, comment: "" });
  const [profile, setProfile] = useState({
    fullName: user?.fullName || "",
    phone: user?.phone || "",
    avatarUrl: user?.avatarUrl || "",
    bio: user?.bio || ""
  });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/patient/dashboard");
      setAppointments(res.data.appointments || []);
      setRecords(res.data.records || []);
      setInvoices(res.data.invoices || []);
      setNotifications(res.data.notifications || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function cancelAppointment(id) {
    if (!window.confirm("Xác nhận hủy lịch hẹn này?")) return;

    setError("");
    setMessage("");
    try {
      await api.patch(`/appointments/${id}/cancel`, { reason: "Bệnh nhân yêu cầu hủy lịch" });
      setMessage("Đã hủy lịch hẹn.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function rescheduleAppointment(appointment) {
    const date = rescheduleDates[appointment._id];
    if (!date) {
      setError("Chọn ngày mới trước khi đổi lịch.");
      return;
    }

    if (!window.confirm("Xác nhận đổi lịch sang slot trống đầu tiên của ngày mới?")) return;

    try {
      await api.patch(`/appointments/${appointment._id}/reschedule`, { date });
      setMessage("Đã đổi lịch sang lịch trống đầu tiên của ngày mới.");
      setRescheduleDates((current) => ({ ...current, [appointment._id]: "" }));
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function payInvoice(invoice) {
    if (!window.confirm(`Xác nhận thanh toán hóa đơn ${formatMoney(invoice.total)}?`)) return;

    try {
      await api.patch(`/patient/invoices/${invoice._id}/pay`);
      setMessage("Thanh toán đã được ghi nhận. Lịch hẹn đã chuyển sang Hoàn tất.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function submitReview(event) {
    event.preventDefault();
    if (!review.appointmentId) {
      setError("Chọn lịch đã hoàn tất trước khi gửi đánh giá.");
      return;
    }

    if (!window.confirm("Xác nhận gửi đánh giá cho lịch hẹn này?")) return;

    try {
      await api.post("/patient/reviews", review);
      setReview({ appointmentId: "", rating: 5, comment: "" });
      setMessage("Đã gửi đánh giá.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function markNotificationRead(notification) {
    if (!notification.id || notification.isRead) return;
    if (!window.confirm("Đánh dấu thông báo này là đã đọc?")) return;

    try {
      await api.patch(`/patient/notifications/${notification.id}/read`);
      setMessage("Đã đánh dấu thông báo là đã đọc.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    const validationError = firstError(validateName(profile.fullName), validatePhone(profile.phone));
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!window.confirm("Xác nhận cập nhật hồ sơ?")) return;

    try {
      const res = await api.patch("/auth/me", profile);
      localStorage.setItem("das_user", JSON.stringify(res.data.user));
      setMessage("Đã cập nhật hồ sơ.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    const validationError = firstError(
      passwords.currentPassword ? "" : "Mật khẩu hiện tại là bắt buộc.",
      validatePassword(passwords.newPassword)
    );
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!window.confirm("Xác nhận đổi mật khẩu?")) return;

    try {
      await api.patch("/auth/change-password", passwords);
      setPasswords({ currentPassword: "", newPassword: "" });
      setMessage("Đã đổi mật khẩu.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const activeAppointments = appointments
    .filter((item) => !["cancelled", "completed", "no_show"].includes(item.status) && new Date(item.startAt) >= new Date())
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const nextAppointment = activeAppointments[0];
  const unpaidInvoices = invoices.filter((item) => item.status !== "paid");
  const unreadNotifications = notifications.filter((item) => item.type === "notification" && !item.isRead);
  const invoiceByAppointment = new Map(invoices.filter((invoice) => invoice.appointment?._id).map((invoice) => [invoice.appointment._id, invoice]));
  const completedAppointments = appointments.filter((item) => item.status === "completed");

  return (
    <div className={`patient-dashboard-shell ${sidebarOpen ? "" : "collapsed"}`}>
      <Feedback error={error} message={message} onClear={() => { setError(""); setMessage(""); }} />

      <aside className="patient-sidebar">
        <div className="patient-sidebar-head">
          <div className="patient-avatar-cluster">
            <div className="patient-avatar-wrap">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt={user?.fullName || "Avatar"} /> : <UserRound size={30} />}
              <button className="avatar-mini-button" onClick={() => setActiveFeature("account")} title="Đổi avatar">
                <Camera size={14} />
              </button>
            </div>
            <button className="patient-avatar-notification" onClick={() => setActiveFeature("notifications")} title="Thông báo">
              <Bell size={14} />
              {unreadNotifications.length > 0 && <span>{unreadNotifications.length}</span>}
            </button>
          </div>
          <div className="patient-sidebar-name">
            <strong>{profile.fullName || user?.fullName}</strong>
            <span>{profile.phone || user?.phone}</span>
          </div>
          <button className="icon-button" onClick={() => setSidebarOpen((value) => !value)} title="Đóng mở menu">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="patient-side-nav">
          {patientNav.map((item) => {
            const Icon = item.icon;
            const notificationCount = item.id === "notifications" ? unreadNotifications.length : 0;
            return (
              <button className={activeFeature === item.id ? "active" : ""} key={item.id} onClick={() => setActiveFeature(item.id)}>
                <Icon size={19} />
                <span>{item.label}</span>
                {notificationCount > 0 && <em>{notificationCount}</em>}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="patient-dashboard-content">
        {activeFeature === "home" && (
          <>
            <section className="patient-home-hero">
              <div>
                <p className="eyebrow">Trang chủ bệnh nhân</p>
                <h1>Thông tin và lịch hẹn nha khoa của bạn</h1>
                <p>
                  Theo dõi lịch hẹn, hồ sơ điều trị, hóa đơn, đánh giá và thông báo từ phòng khám trong cùng một màn hình.
                </p>
              </div>
              <div className="patient-home-actions">
                <button className="button primary" onClick={() => navigate("/booking")}>
                  Đặt lịch
                </button>
                <button className="button ghost" onClick={() => setActiveFeature("appointments")}>
                  Xem lịch hẹn
                </button>
              </div>
            </section>

            <section className="metrics-grid">
              <OverviewMetric icon={CalendarClock} label="Lịch sắp tới" value={activeAppointments.length} />
              <OverviewMetric icon={ReceiptText} label="Hóa đơn cần xử lý" value={unpaidInvoices.length} />
              <OverviewMetric icon={Bell} label="Thông báo mới" value={unreadNotifications.length} />
              <OverviewMetric icon={FileText} label="Hồ sơ điều trị" value={records.length} />
            </section>

            <section className="overview-grid">
              <article className="insight-card">
                <div className="section-title tight-title">
                  <CalendarClock size={20} />
                  <h2>Lịch gần nhất</h2>
                </div>
                {loading ? (
                  <EmptyState title="Đang tải lịch hẹn" text="Hệ thống đang lấy dữ liệu mới nhất." />
                ) : nextAppointment ? (
                  <div className="stack">
                    <strong>{nextAppointment.service?.name}</strong>
                    <span>{formatDateTime(nextAppointment.startAt)} - {nextAppointment.room?.name}</span>
                    <span className="mini">Giờ đến: {formatDateTime(nextAppointment.arrivalAt)}</span>
                    <span className="mini">Bác sĩ: {nextAppointment.dentist?.fullName}</span>
                    <StatusBadge value={nextAppointment.status} />
                  </div>
                ) : (
                  <EmptyState title="Chưa có lịch sắp tới" text="Bạn có thể đặt lịch mới ở màn Đặt lịch." />
                )}
              </article>

              <article className="insight-card">
                <div className="section-title tight-title">
                  <Bell size={20} />
                  <h2>Thông báo mới</h2>
                </div>
                {unreadNotifications.length ? (
                  <div className="mini-list">
                    {unreadNotifications.slice(0, 3).map((item, index) => (
                      <div className="mini-row" key={`${item.id || index}`}>
                        <span>{item.message}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Không có thông báo mới" />
                )}
              </article>
            </section>
          </>
        )}

        {activeFeature === "appointments" && (
          <section className="panel">
            <div className="section-title">
              <CalendarClock size={20} />
              <h2>Lịch hẹn của tôi</h2>
            </div>
            {loading ? (
              <EmptyState title="Đang tải lịch hẹn" text="Hệ thống đang lấy dữ liệu mới nhất." />
            ) : appointments.length ? (
              <div className="appointment-list">
                {appointments.map((appointment) => {
                  const invoice = invoiceByAppointment.get(appointment._id);
                  const canReview = appointment.status === "completed";
                  return (
                    <article className="appointment-card patient-appointment-card" key={appointment._id}>
                      <div>
                        <h4>{appointment.service?.name}</h4>
                        <p>
                          {formatDateTime(appointment.startAt)} - {appointment.room?.name}
                        </p>
                        <span className="mini">Giờ đến: {formatDateTime(appointment.arrivalAt)}</span>
                        <span className="mini">Bác sĩ: {appointment.dentist?.fullName}</span>
                        {appointment.confirmationCalledAt && (
                          <span className="mini">Lễ tân đã gọi xác nhận: {formatDateTime(appointment.confirmationCalledAt)}</span>
                        )}
                        {invoice && (
                          <div className="appointment-subpanel">
                            <strong>Hóa đơn: {formatMoney(invoice.total)}</strong>
                            <StatusBadge value={invoice.status} />
                            {invoice.status !== "paid" && (
                              <button className="button small" onClick={() => payInvoice(invoice)}>
                                Thanh toán
                              </button>
                            )}
                          </div>
                        )}
                        {canReview && (
                          <form className="appointment-review-form" onSubmit={submitReview}>
                            <select value={review.appointmentId} onChange={(e) => setReview({ ...review, appointmentId: e.target.value })}>
                              <option value="">Chọn lịch để đánh giá</option>
                              {completedAppointments.map((item) => (
                                <option value={item._id} key={item._id}>
                                  {item.service?.name} - {formatDateTime(item.startAt)}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min="1"
                              max="5"
                              value={review.rating}
                              onChange={(e) => setReview({ ...review, rating: e.target.value })}
                            />
                            <input
                              value={review.comment}
                              onChange={(e) => setReview({ ...review, comment: e.target.value })}
                              placeholder="Nhận xét"
                              maxLength={1000}
                            />
                            <button className="button small secondary">Gửi đánh giá</button>
                          </form>
                        )}
                      </div>
                      <div>
                        <StatusBadge value={appointment.status} />
                      </div>
                      <div className="row-actions">
                        <input
                          type="date"
                          min={todayInput()}
                          value={rescheduleDates[appointment._id] || ""}
                          onChange={(e) => setRescheduleDates((current) => ({ ...current, [appointment._id]: e.target.value }))}
                        />
                        <button className="icon-button" title="Đổi lịch" onClick={() => rescheduleAppointment(appointment)}>
                          <RefreshCw size={17} />
                        </button>
                        <button className="icon-button danger" title="Hủy lịch" onClick={() => cancelAppointment(appointment._id)}>
                          <XCircle size={17} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="Chưa có lịch hẹn" text="Bạn có thể đặt lịch mới tại màn Đặt lịch." />
            )}
          </section>
        )}

        {activeFeature === "records" && (
          <section className="panel">
            <div className="section-title">
              <FileText size={20} />
              <h2>Hồ sơ điều trị</h2>
            </div>
            {loading ? (
              <EmptyState title="Đang tải hồ sơ" text="Hệ thống đang lấy dữ liệu mới nhất." />
            ) : records.length ? (
              <div className="mini-list">
                {records.map((record) => (
                  <div className="record-card" key={record._id}>
                    <strong>{record.appointment?.service?.name}</strong>
                    <p>{record.diagnosis || "Chưa có chẩn đoán"}</p>
                    <span className="mini">{record.prescription || "Chưa có đơn thuốc"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </section>
        )}

        {activeFeature === "account" && (
          <section className="two-col">
            <article className="panel">
              <div className="section-title">
                <UserRound size={20} />
                <h2>Thông tin bệnh nhân</h2>
              </div>
              <form className="stack" onSubmit={saveProfile}>
                <label className="field">
                  <span>Họ tên</span>
                  <input value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} required />
                </label>
                <label className="field">
                  <span>Số điện thoại</span>
                  <input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} required />
                </label>
                <label className="field">
                  <span>Đổi avatar</span>
                  <input value={profile.avatarUrl} onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })} placeholder="URL ảnh đại diện" />
                </label>
                <label className="field">
                  <span>Ghi chú hồ sơ</span>
                  <textarea value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} rows="3" maxLength={1000} />
                </label>
                <button className="button primary">
                  <Save size={17} />
                  Lưu hồ sơ
                </button>
              </form>
            </article>

            <article className="panel">
              <div className="section-title">
                <LockKeyhole size={20} />
                <h2>Đổi mật khẩu</h2>
              </div>
              <form className="stack" onSubmit={changePassword}>
                <label className="field">
                  <span>Mật khẩu hiện tại</span>
                  <input
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                    required
                  />
                </label>
                <label className="field">
                  <span>Mật khẩu mới</span>
                  <input
                    type="password"
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                    required
                    minLength={8}
                    maxLength={72}
                  />
                </label>
                <button className="button secondary">Đổi mật khẩu</button>
              </form>
            </article>
          </section>
        )}

        {activeFeature === "notifications" && (
          <section className="panel">
            <div className="section-title">
              <Bell size={20} />
              <h2>Thông báo</h2>
            </div>
            {loading ? (
              <EmptyState title="Đang tải thông báo" text="Hệ thống đang lấy dữ liệu mới nhất." />
            ) : notifications.length ? (
              <div className="mini-list">
                {notifications.map((item, index) => (
                  <div className="mini-row" key={`${item.type}-${item.id || index}`}>
                    <span>{item.message}</span>
                    {item.type === "notification" && item.isRead === false ? (
                      <button className="button small" onClick={() => markNotificationRead(item)}>
                        Đánh dấu đã đọc
                      </button>
                    ) : (
                      <CheckCircle2 size={18} />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function OverviewMetric({ icon: Icon, label, value }) {
  return (
    <article className="metric-card">
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
