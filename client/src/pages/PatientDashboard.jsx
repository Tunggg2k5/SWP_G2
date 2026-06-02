import {
  AlertCircle,
  Bell,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileText,
  ListChecks,
  ReceiptText,
  RefreshCw,
  Star,
  XCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../components/EmptyState.jsx";
import Feedback from "../components/Feedback.jsx";
import FeatureTabs from "../components/FeatureTabs.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { api, getErrorMessage } from "../services/api.js";
import { formatDateTime, formatMoney, todayInput } from "../utils/format.js";

const patientFeatures = [
  { id: "overview", label: "Tổng quan", icon: AlertCircle },
  { id: "appointments", label: "Lịch hẹn", icon: CalendarClock },
  { id: "waitlist", label: "Danh sách chờ", icon: ListChecks },
  { id: "billing", label: "Hóa đơn", icon: CreditCard },
  { id: "records", label: "Hồ sơ điều trị", icon: FileText },
  { id: "reviews", label: "Đánh giá", icon: Star },
  { id: "notifications", label: "Thông báo", icon: Bell }
];

export default function PatientDashboard() {
  const [activeFeature, setActiveFeature] = useState("overview");
  const [appointments, setAppointments] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
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
      setAppointments(res.data.appointments);
      setWaitlist(res.data.waitlist);
      setRecords(res.data.records);
      setInvoices(res.data.invoices);
      setNotifications(res.data.notifications);
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

    try {
      await api.patch(`/appointments/${appointment._id}/reschedule`, { date });
      setMessage("Đã đổi lịch sang lịch trống đầu tiên của ngày mới.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function payInvoice(id) {
    try {
      await api.patch(`/patient/invoices/${id}/pay`);
      setMessage("Thanh toán đã được ghi nhận.");
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
  const unpaidTotal = unpaidInvoices.reduce((total, item) => total + Number(item.total || 0), 0);
  const openWaitlist = waitlist.filter((item) => ["waiting", "contacted"].includes(item.status));
  const unreadNotifications = notifications.filter((item) => item.type === "notification" && !item.isRead);
  const completedAppointments = appointments.filter((item) => item.status === "completed");

  return (
    <div className="page-grid">
      <Feedback error={error} message={message} onClear={() => { setError(""); setMessage(""); }} />
      <FeatureTabs items={patientFeatures} active={activeFeature} onChange={setActiveFeature} />

      {activeFeature === "overview" && (
        <>
          <section className="metrics-grid">
            <OverviewMetric icon={CalendarClock} label="Lịch sắp tới" value={activeAppointments.length} />
            <OverviewMetric icon={ReceiptText} label="Hóa đơn cần xử lý" value={unpaidInvoices.length} />
            <OverviewMetric icon={ListChecks} label="Danh sách chờ" value={openWaitlist.length} />
            <OverviewMetric icon={Bell} label="Thông báo mới" value={unreadNotifications.length} />
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
                <CreditCard size={20} />
                <h2>Thanh toán</h2>
              </div>
              {unpaidInvoices.length ? (
                <div className="stack">
                  <strong>{formatMoney(unpaidTotal)}</strong>
                  <span className="mini">Tổng tiền của {unpaidInvoices.length} hóa đơn chưa thanh toán.</span>
                  <button className="button secondary" onClick={() => setActiveFeature("billing")}>
                    Xem hóa đơn
                  </button>
                </div>
              ) : (
                <EmptyState title="Không có hóa đơn cần thanh toán" text="Các hóa đơn hiện tại đã được xử lý." />
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
              {appointments.map((appointment) => (
                <article className="appointment-card" key={appointment._id}>
                  <div>
                    <h4>{appointment.service?.name}</h4>
                    <p>
                      {formatDateTime(appointment.startAt)} - {appointment.room?.name}
                    </p>
                    <span className="mini">Giờ đến: {formatDateTime(appointment.arrivalAt)}</span>
                    {appointment.confirmationCalledAt && (
                      <span className="mini">Lễ tân đã gọi xác nhận: {formatDateTime(appointment.confirmationCalledAt)}</span>
                    )}
                  </div>
                  <div>
                    <StatusBadge value={appointment.status} />
                    <p className="mini">{appointment.dentist?.fullName}</p>
                  </div>
                  <div className="row-actions">
                    <input
                      type="date"
                      min={todayInput()}
                      value={rescheduleDates[appointment._id] || ""}
                      onChange={(e) =>
                        setRescheduleDates((current) => ({ ...current, [appointment._id]: e.target.value }))
                      }
                    />
                    <button className="icon-button" title="Đổi lịch" onClick={() => rescheduleAppointment(appointment)}>
                      <RefreshCw size={17} />
                    </button>
                    <button className="icon-button danger" title="Hủy lịch" onClick={() => cancelAppointment(appointment._id)}>
                      <XCircle size={17} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có lịch hẹn" text="Bạn có thể đặt lịch mới tại màn Đặt lịch." />
          )}
        </section>
      )}

      {activeFeature === "waitlist" && (
        <section className="panel">
          <div className="section-title">
            <ListChecks size={20} />
            <h2>Danh sách chờ</h2>
          </div>
          {loading ? (
            <EmptyState title="Đang tải danh sách chờ" text="Hệ thống đang lấy dữ liệu mới nhất." />
          ) : waitlist.length ? (
            <div className="mini-list">
              {waitlist.map((entry) => (
                <div className="mini-row" key={entry._id}>
                  <span>{entry.service?.name}</span>
                  <StatusBadge value={entry.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
      )}

      {activeFeature === "billing" && (
        <section className="panel">
          <div className="section-title">
            <CreditCard size={20} />
            <h2>Hóa đơn và thanh toán</h2>
          </div>
          {loading ? (
            <EmptyState title="Đang tải hóa đơn" text="Hệ thống đang lấy dữ liệu mới nhất." />
          ) : invoices.length ? (
            <div className="mini-list">
              {invoices.map((invoice) => (
                <div className="mini-row" key={invoice._id}>
                  <span>{formatMoney(invoice.total)}</span>
                  <StatusBadge value={invoice.status} />
                  {invoice.status !== "paid" && (
                    <button className="button small" onClick={() => payInvoice(invoice._id)}>
                      Thanh toán
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState />
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

      {activeFeature === "reviews" && (
        <section className="panel">
          <div className="section-title">
            <Star size={20} />
            <h2>Đánh giá</h2>
          </div>
          <form className="stack" onSubmit={submitReview}>
            <label className="field">
              <span>Lịch đã hoàn tất</span>
              <select value={review.appointmentId} onChange={(e) => setReview({ ...review, appointmentId: e.target.value })}>
                <option value="">Chọn lịch</option>
                {completedAppointments.map((appointment) => (
                  <option key={appointment._id} value={appointment._id}>
                    {appointment.service?.name} - {formatDateTime(appointment.startAt)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Điểm</span>
              <input
                type="number"
                min="1"
                max="5"
                value={review.rating}
                onChange={(e) => setReview({ ...review, rating: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Nhận xét</span>
              <textarea value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} rows="3" />
            </label>
            <button className="button secondary">Gửi đánh giá</button>
          </form>
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
