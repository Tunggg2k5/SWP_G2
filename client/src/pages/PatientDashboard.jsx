import {
  Bell,
  CalendarClock,
  CheckCircle2,
  FileText,
  Home,
  Menu,
  ReceiptText,
  RefreshCw,
  Star,
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

const patientNav = [
  { id: "home", label: "Trang chủ", icon: Home },
  { id: "appointments", label: "Lịch hẹn", icon: CalendarClock },
  { id: "records", label: "Hồ sơ điều trị", icon: FileText }
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
        <div className="patient-sidebar-tools">
          <strong>DAS</strong>
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
            <section className="guest-hero patient-guest-hero">
              <div className="guest-hero-inner patient-guest-inner">
                <div className="guest-title">
                  <span className="guest-kicker">Dental Appointment System</span>
                  <h1>Thông tin và đặt lịch phòng khám nha khoa</h1>
                  <p>
                    Khách hàng có thể xem thông tin phòng khám, hồ sơ bác sĩ, dịch vụ nha khoa và quản lý lịch hẹn trong tài khoản bệnh nhân.
                  </p>
                  <div className="guest-proof-row">
                    <span>1 chi nhánh tại TP. Hồ Chí Minh</span>
                    <span>8 bác sĩ nha khoa</span>
                    <span>Thứ 2 - Thứ 7</span>
                  </div>
                </div>

                <div className="guest-appointment-form patient-home-panel">
                  <div className="section-title tight-title">
                    <CalendarClock size={20} />
                    <h2>Trung tâm bệnh nhân</h2>
                  </div>
                  <div className="patient-home-summary">
                    <span>Lịch sắp tới <strong>{activeAppointments.length}</strong></span>
                    <span>Thông báo mới <strong>{unreadNotifications.length}</strong></span>
                    <span>Hồ sơ điều trị <strong>{records.length}</strong></span>
                  </div>
                  {nextAppointment ? (
                    <div className="patient-next-box">
                      <strong>{nextAppointment.service?.name}</strong>
                      <span>{formatDateTime(nextAppointment.startAt)} - {nextAppointment.room?.name}</span>
                      <small>Bác sĩ: {nextAppointment.dentist?.fullName}</small>
                    </div>
                  ) : (
                    <EmptyState title="Chưa có lịch sắp tới" text="Bạn có thể đặt lịch mới ngay trong hệ thống." />
                  )}
                  <div className="patient-home-actions">
                    <button className="button primary" onClick={() => navigate("/booking")}>
                      Đặt lịch
                    </button>
                    <button className="button ghost" onClick={() => setActiveFeature("appointments")}>
                      Xem lịch hẹn
                    </button>
                  </div>
                </div>
              </div>
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
