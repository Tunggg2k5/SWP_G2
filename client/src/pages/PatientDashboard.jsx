import {
  CalendarClock,
  CalendarPlus,
  FileText,
  Home,
  Menu,
  Star,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../components/EmptyState.jsx";
import Feedback from "../components/Feedback.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { usePublicBootstrap } from "../hooks/usePublicBootstrap.js";
import { api, getErrorMessage } from "../services/api.js";
import { formatDateTime, formatMoney, todayInput } from "../utils/format.js";
import BookingPage, { bookingSlotOptions, toClinicIso } from "./BookingPage.jsx";

const patientNav = [
  { id: "home", label: "Trang chủ", icon: Home },
  { id: "booking", label: "Đặt lịch", icon: CalendarPlus },
  { id: "appointments", label: "Lịch hẹn", icon: CalendarClock },
  { id: "records", label: "Hồ sơ điều trị", icon: FileText }
];

const lockedPatientStatuses = new Set(["cancelled", "rejected", "completed", "no_show"]);

export default function PatientDashboard() {
  const [activeFeature, setActiveFeature] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [records, setRecords] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewForms, setReviewForms] = useState({});
  const [rescheduleForms, setRescheduleForms] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { services, dentists, rooms } = usePublicBootstrap();

  const dentistOptions = useMemo(() => {
    const roomDentists = rooms.map((room) => room.assignedDentist).filter(Boolean);
    return Array.from(new Map([...roomDentists, ...dentists].map((dentist) => [dentist._id, dentist])).values());
  }, [dentists, rooms]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/patient/dashboard");
      setAppointments(res.data.appointments || []);
      setRecords(res.data.records || []);
      setInvoices(res.data.invoices || []);
      setNotifications(res.data.notifications || []);
      setReviews(res.data.reviews || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateReviewForm(appointmentId, values) {
    setReviewForms((current) => ({
      ...current,
      [appointmentId]: {
        rating: 5,
        comment: "",
        ...(current[appointmentId] || {}),
        ...values
      }
    }));
  }

  function updateRescheduleForm(appointment, values) {
    setRescheduleForms((current) => ({
      ...current,
      [appointment._id]: {
        date: todayInput(),
        time: bookingSlotOptions[0].value,
        dentistId: appointment.dentist?._id || dentistOptions[0]?._id || "",
        ...(current[appointment._id] || {}),
        ...values
      }
    }));
  }

  async function submitReview(event, appointmentId) {
    event.preventDefault();
    const review = reviewForms[appointmentId] || { rating: 5, comment: "" };

    if (!window.confirm("Xác nhận gửi đánh giá cho lịch hẹn này?")) return;

    try {
      await api.post("/patient/reviews", { ...review, appointmentId });
      setReviewForms((current) => ({ ...current, [appointmentId]: { rating: 5, comment: "" } }));
      setMessage("Đã gửi đánh giá.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function cancelAppointment(appointment) {
    if (!canModifyAppointment(appointment)) {
      setError("Lịch hẹn đã hủy, bị hủy hoặc hoàn tất nên không thể thay đổi.");
      return;
    }

    if (!window.confirm("Xác nhận hủy lịch hẹn này?")) return;

    try {
      await api.patch(`/appointments/${appointment._id}/cancel`, { reason: "Bệnh nhân hủy lịch hẹn." });
      setMessage("Đã hủy lịch hẹn.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function rescheduleAppointment(appointment) {
    if (!canModifyAppointment(appointment)) {
      setError("Lịch hẹn đã hủy, bị hủy hoặc hoàn tất nên không thể đổi lịch.");
      return;
    }

    const form = rescheduleForms[appointment._id] || {};
    if (!form.date || !form.time || !form.dentistId) {
      setError("Chọn ngày, giờ và bác sĩ trước khi đổi lịch.");
      return;
    }

    const room = rooms.find((item) => item.assignedDentist?._id === form.dentistId) || rooms.find((item) => item.assignedDentist);
    if (!room) {
      setError("Chưa có phòng khám được gán bác sĩ. Vui lòng liên hệ lễ tân.");
      return;
    }

    const slot = bookingSlotOptions.find((option) => option.value === form.time);
    if (!window.confirm(`Xác nhận đổi lịch sang ${form.date}, ca ${slot?.label || form.time}?`)) return;

    try {
      await api.patch(`/appointments/${appointment._id}/reschedule`, {
        serviceId: appointment.service?._id,
        date: form.date,
        startAt: toClinicIso(form.date, form.time),
        roomId: room._id
      });
      setMessage("Đã đổi lịch hẹn.");
      setRescheduleForms((current) => ({ ...current, [appointment._id]: undefined }));
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
    .filter((item) => !["cancelled", "completed", "no_show", "rejected"].includes(item.status) && new Date(item.startAt) >= new Date())
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const nextAppointment = activeAppointments[0];
  const unreadNotifications = notifications.filter((item) => item.type === "notification" && !item.isRead);
  const invoiceByAppointment = new Map(invoices.filter((invoice) => invoice.appointment?._id).map((invoice) => [invoice.appointment._id, invoice]));

  return (
    <div className={`patient-dashboard-shell ${sidebarOpen ? "" : "collapsed"}`}>
      <Feedback error={error} message={message} onClear={() => { setError(""); setMessage(""); }} />

      <main className="patient-dashboard-content">
        {activeFeature === "home" && (
          <PatientHome
            activeAppointments={activeAppointments}
            dentistOptions={dentistOptions}
            nextAppointment={nextAppointment}
            notifications={unreadNotifications}
            records={records}
            reviews={reviews}
            services={services}
            setActiveFeature={setActiveFeature}
          />
        )}

        {activeFeature === "booking" && <BookingPage embedded />}

        {activeFeature === "appointments" && (
          <section className="panel" id="appointments">
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
                  const canModify = canModifyAppointment(appointment);
                  const reviewForm = reviewForms[appointment._id] || { rating: 5, comment: "" };
                  const rescheduleForm = rescheduleForms[appointment._id] || {
                    date: todayInput(),
                    time: bookingSlotOptions[0].value,
                    dentistId: appointment.dentist?._id || dentistOptions[0]?._id || ""
                  };

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
                          </div>
                        )}
                        {canModify ? (
                          <div className="patient-appointment-actions">
                            <button className="button small danger" onClick={() => cancelAppointment(appointment)}>
                              Hủy lịch
                            </button>
                            <div className="patient-reschedule-box">
                              <input
                                type="date"
                                min={todayInput()}
                                value={rescheduleForm.date}
                                onChange={(e) => updateRescheduleForm(appointment, { date: e.target.value })}
                              />
                              <select
                                value={rescheduleForm.dentistId}
                                onChange={(e) => updateRescheduleForm(appointment, { dentistId: e.target.value })}
                              >
                                {dentistOptions.map((dentist) => (
                                  <option key={dentist._id} value={dentist._id}>
                                    {dentist.fullName}
                                  </option>
                                ))}
                              </select>
                              <select value={rescheduleForm.time} onChange={(e) => updateRescheduleForm(appointment, { time: e.target.value })}>
                                {bookingSlotOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <button className="button small" onClick={() => rescheduleAppointment(appointment)}>
                                Đổi lịch
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="locked-note">Lịch này không thể thay đổi thêm.</span>
                        )}
                        {canReview && (
                          <form className="appointment-review-form" onSubmit={(event) => submitReview(event, appointment._id)}>
                            <input
                              type="number"
                              min="1"
                              max="5"
                              value={reviewForm.rating}
                              onChange={(e) => updateReviewForm(appointment._id, { rating: e.target.value })}
                            />
                            <input
                              value={reviewForm.comment}
                              onChange={(e) => updateReviewForm(appointment._id, { comment: e.target.value })}
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
          <section className="panel" id="records">
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

      {sidebarOpen ? (
        <aside className="patient-sidebar">
          <div className="patient-sidebar-tools">
            <strong>SmileCare</strong>
            <button className="icon-button" onClick={() => setSidebarOpen(false)} title="Đóng menu">
              <X size={18} />
            </button>
          </div>

          <nav className="patient-side-nav">
            {patientNav.map((item) => {
              const Icon = item.icon;
              return (
                <button className={activeFeature === item.id ? "active" : ""} key={item.id} onClick={() => setActiveFeature(item.id)}>
                  <Icon size={19} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>
      ) : (
        <button className="patient-sidebar-fab" onClick={() => setSidebarOpen(true)} title="Mở menu">
          <Menu size={22} />
        </button>
      )}
    </div>
  );
}

function PatientHome({ activeAppointments, dentistOptions, nextAppointment, notifications, records, reviews, services, setActiveFeature }) {
  return (
    <div className="patient-public-home">
      <section className="patient-public-hero" id="home">
        <div className="patient-public-copy">
          <span className="smile-pill">Nha khoa uy tín hàng đầu</span>
          <h1>Nụ cười rạng rỡ, tự tin tỏa sáng</h1>
          <p>SmileCare mang đến giải pháp chăm sóc răng miệng toàn diện với công nghệ hiện đại và đội ngũ bác sĩ giàu kinh nghiệm.</p>
          <div className="patient-home-actions">
            <button className="button primary" onClick={() => setActiveFeature("booking")}>
              Đặt lịch
            </button>
            <button className="button ghost" onClick={() => setActiveFeature("appointments")}>
              Xem lịch hẹn
            </button>
          </div>
        </div>

        <div className="patient-home-panel">
          <div className="section-title tight-title">
            <CalendarClock size={20} />
            <h2>Trung tâm bệnh nhân</h2>
          </div>
          <div className="patient-home-summary">
            <span>Lịch sắp tới <strong>{activeAppointments.length}</strong></span>
            <span>Thông báo mới <strong>{notifications.length}</strong></span>
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
        </div>
      </section>

      <section className="patient-public-section" id="services">
        <div className="section-title">
          <CalendarPlus size={20} />
          <h2>Dịch vụ nha khoa</h2>
        </div>
        <div className="patient-public-grid">
          {services.slice(0, 6).map((service) => (
            <article className="patient-info-card" key={service._id}>
              <strong>{service.name}</strong>
              <p>{service.description || "Dịch vụ chăm sóc răng miệng tại phòng khám."}</p>
              <span>{formatMoney(service.price)}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="patient-public-section" id="about">
        <div className="section-title">
          <Home size={20} />
          <h2>Giới thiệu phòng khám</h2>
        </div>
        <div className="patient-about-grid">
          <article>
            <strong>1 chi nhánh tại TP. Hồ Chí Minh</strong>
            <p>Không gian thăm khám sáng, sạch và được vận hành theo quy trình đặt lịch rõ ràng.</p>
          </article>
          <article>
            <strong>{dentistOptions.length || 3} bác sĩ nha khoa</strong>
            <p>Đội ngũ bác sĩ phụ trách tư vấn, điều trị và theo dõi lịch sử khám của từng bệnh nhân.</p>
          </article>
          <article>
            <strong>Thứ 2 - Thứ 7</strong>
            <p>8h-11h30 và 14h-17h30.</p>
          </article>
        </div>
      </section>

      <section className="patient-public-section" id="contact">
        <div className="section-title">
          <Star size={20} />
          <h2>Đánh giá gần đây của tôi</h2>
        </div>
        {reviews.length ? (
          <div className="patient-review-grid">
            {reviews.map((review) => (
              <article className="patient-info-card" key={review._id}>
                <strong>{review.service?.name || "Dịch vụ"}</strong>
                <span>{review.rating || review.ratingService || 5}/5 sao</span>
                <p>{review.comment || "Chưa có nhận xét chi tiết."}</p>
                <small>{review.dentist?.fullName || "Bác sĩ phòng khám"}</small>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Chưa có đánh giá gần đây" text="Sau khi lịch hoàn tất, bạn có thể gửi đánh giá tại tab Lịch hẹn." />
        )}
      </section>
    </div>
  );
}

function canModifyAppointment(appointment) {
  return !lockedPatientStatuses.has(appointment.status);
}
