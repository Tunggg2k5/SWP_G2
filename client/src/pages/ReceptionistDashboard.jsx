import { CalendarPlus, CheckCheck, CheckCircle2, ClipboardList, DoorOpen, PhoneCall, Search, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../components/EmptyState.jsx";
import Feedback from "../components/Feedback.jsx";
import FeatureTabs from "../components/FeatureTabs.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { api, getErrorMessage } from "../services/api.js";
import { formatDateTime, todayInput } from "../utils/format.js";
import { firstError, requireValue, validateDate, validateEmail, validateName, validateNote, validatePhone } from "../utils/validation.js";

const receptionistFeatures = [
  { id: "appointments", label: "Lịch hẹn", icon: ClipboardList },
  { id: "patients", label: "Bệnh nhân", icon: UserPlus },
  { id: "booking", label: "Đặt lịch hộ", icon: CalendarPlus },
  { id: "consultations", label: "Tư vấn", icon: PhoneCall },
  { id: "waitlist", label: "Danh sách chờ", icon: CheckCircle2 },
  { id: "rooms", label: "Phòng khám", icon: DoorOpen }
];

const appointmentStatusOptions = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "scheduled", label: "Đã đặt" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "checked_in", label: "Đã đến" },
  { value: "in_treatment", label: "Đang khám" },
  { value: "completed", label: "Hoàn tất" },
  { value: "cancelled", label: "Đã hủy" },
  { value: "no_show", label: "Vắng mặt" }
];

export default function ReceptionistDashboard() {
  const [activeFeature, setActiveFeature] = useState("appointments");
  const [date, setDate] = useState(todayInput());
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [appointmentStatus, setAppointmentStatus] = useState("all");
  const [patientSearch, setPatientSearch] = useState("");
  const [newPatient, setNewPatient] = useState({ fullName: "", email: "", phone: "" });
  const [booking, setBooking] = useState({ patientId: "", serviceId: "", note: "" });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/reception/dashboard", { params: patientSearch ? { date, q: patientSearch } : { date } });

      setAppointments(res.data.appointments);
      setPatients(res.data.patients);
      setServices(res.data.services);
      setWaitlist(res.data.waitlist);
      setConsultations(res.data.consultations);
      setRooms(res.data.rooms);
      setBooking((current) => ({
        ...current,
        patientId: current.patientId || res.data.patients[0]?._id || "",
        serviceId: current.serviceId || res.data.services[0]?._id || ""
      }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [date]);

  async function searchPatients(event) {
    event.preventDefault();
    await load();
  }

  async function createPatient(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationError = firstError(
      validateName(newPatient.fullName),
      validateEmail(newPatient.email),
      validatePhone(newPatient.phone)
    );

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const res = await api.post("/reception/patients", newPatient);
      setNewPatient({ fullName: "", email: "", phone: "" });
      setMessage(`Đã tạo tài khoản ${res.data.patient.fullName}.`);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function createBooking(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationError = firstError(
      requireValue(booking.patientId, "Bệnh nhân"),
      requireValue(booking.serviceId, "Dịch vụ"),
      validateDate(date),
      validateNote(booking.note)
    );

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await api.post("/appointments", {
        patientId: booking.patientId,
        serviceId: booking.serviceId,
        date,
        channel: "offline",
        note: booking.note
      });
      setMessage("Đã đặt lịch hộ bệnh nhân theo lịch trống đầu tiên.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function updateAppointment(id, status) {
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      setMessage("Đã cập nhật trạng thái lịch hẹn.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function confirmAppointmentCall(id) {
    try {
      await api.patch(`/appointments/${id}/confirmation-call`, { note: "Lễ tân đã gọi xác nhận trước giờ khám." });
      setMessage("Đã ghi nhận cuộc gọi xác nhận và gửi thông báo cho bệnh nhân.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function checkIn(id) {
    try {
      await api.patch(`/appointments/${id}/check-in`, { paid: true });
      setMessage("Đã ghi nhận bệnh nhân đến và ghi nhận thanh toán nếu dịch vụ có giá cố định.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function updateWaitlist(id, status) {
    try {
      await api.patch(`/waitlist/${id}`, { status });
      setMessage("Đã cập nhật danh sách chờ.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function updateConsultation(id, status) {
    try {
      await api.patch(`/reception/consultations/${id}`, { status });
      setMessage("Đã cập nhật yêu cầu tư vấn.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function updateRoomStatus(id, status) {
    try {
      await api.patch(`/reception/rooms/${id}/status`, { status, note: "Lễ tân cập nhật trạng thái phòng." });
      setMessage("Đã cập nhật trạng thái phòng.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const filteredAppointments = appointments.filter((appointment) => {
    const keyword = appointmentSearch.trim().toLowerCase();
    const matchesStatus = appointmentStatus === "all" || appointment.status === appointmentStatus;
    const searchableText = [
      appointment.patient?.fullName,
      appointment.patient?.phone,
      appointment.service?.name,
      appointment.room?.name,
      appointment.dentist?.fullName
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return matchesStatus && (!keyword || searchableText.includes(keyword));
  });
  const confirmationNeededCount = appointments.filter((appointment) => needsConfirmationCall(appointment)).length;
  const checkedInCount = appointments.filter((appointment) => appointment.status === "checked_in").length;

  return (
    <div className="page-grid">
      <Feedback error={error} message={message} onClear={() => { setError(""); setMessage(""); }} />
      <FeatureTabs items={receptionistFeatures} active={activeFeature} onChange={setActiveFeature} />

      {activeFeature === "appointments" && (
        <section className="panel">
          <div className="section-title">
            <ClipboardList size={20} />
            <h2>Lịch hẹn trong ngày</h2>
          </div>

          <div className="metrics-grid compact-grid">
            <ReceptionMetric icon={ClipboardList} label="Tổng lịch" value={appointments.length} />
            <ReceptionMetric icon={PhoneCall} label="Cần gọi xác nhận" value={confirmationNeededCount} />
            <ReceptionMetric icon={CheckCheck} label="Đã đến" value={checkedInCount} />
          </div>

          <div className="toolbar-row">
            <label className="field inline-field">
              <span>Ngày</span>
              <input type="date" value={date} min={todayInput()} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field inline-field">
              <span>Trạng thái</span>
              <select value={appointmentStatus} onChange={(e) => setAppointmentStatus(e.target.value)}>
                {appointmentStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field inline-field grow-field">
              <span>Tìm nhanh</span>
              <div className="input-with-icon">
                <Search size={17} />
                <input
                  value={appointmentSearch}
                  onChange={(e) => setAppointmentSearch(e.target.value)}
                  placeholder="Tên, SĐT, dịch vụ, phòng hoặc bác sĩ"
                />
              </div>
            </label>
          </div>

          {loading ? (
            <EmptyState title="Đang tải lịch hẹn" text="Hệ thống đang lấy dữ liệu mới nhất." />
          ) : filteredAppointments.length ? (
            <div className="appointment-list">
              {filteredAppointments.map((appointment) => (
                <article className="appointment-card" key={appointment._id}>
                  <div>
                    <h4>{appointment.patient?.fullName}</h4>
                    <p>
                      {appointment.service?.name} - {formatDateTime(appointment.startAt)}
                    </p>
                    <span className="mini">
                      {appointment.room?.name} / {appointment.dentist?.fullName}
                    </span>
                    <span className="mini">Giờ đến: {formatDateTime(appointment.arrivalAt)}</span>
                    <span className={`mini confirmation-note ${needsConfirmationCall(appointment) ? "warning-text" : ""}`}>
                      {formatConfirmationText(appointment)}
                    </span>
                  </div>
                  <StatusBadge value={appointment.status} />
                  <div className="row-actions">
                    {needsConfirmationCall(appointment) && (
                      <button className="button small" onClick={() => confirmAppointmentCall(appointment._id)}>
                        Đã gọi
                      </button>
                    )}
                    <button
                      className="button small"
                      disabled={["cancelled", "completed", "no_show"].includes(appointment.status)}
                      onClick={() => checkIn(appointment._id)}
                    >
                      Ghi nhận đến
                    </button>
                    <button
                      className="button small"
                      disabled={["cancelled", "completed", "no_show"].includes(appointment.status)}
                      onClick={() => updateAppointment(appointment._id, "no_show")}
                    >
                      Vắng mặt
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Không có lịch phù hợp" text="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." />
          )}
        </section>
      )}

      {activeFeature === "patients" && (
        <section className="panel">
          <div className="section-title">
            <UserPlus size={20} />
            <h2>Tìm hoặc tạo tài khoản bệnh nhân</h2>
          </div>
          <form className="form-grid" onSubmit={searchPatients}>
            <label className="field">
              <span>Tìm bệnh nhân theo tên, email hoặc số điện thoại</span>
              <input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder="Ví dụ: Nguyễn Văn A, 091..." />
            </label>
            <button className="button ghost">Tìm tài khoản</button>
          </form>
          <div className="mini-list">
            {loading ? (
              <EmptyState title="Đang tải tài khoản" text="Hệ thống đang lấy dữ liệu mới nhất." />
            ) : patients.slice(0, 8).map((patient) => (
              <div className="mini-row" key={patient._id}>
                <span>
                  {patient.fullName} - {patient.phone}
                </span>
                <span className="mini">{patient.email}</span>
              </div>
            ))}
          </div>
          <form className="stack" onSubmit={createPatient}>
            <label className="field">
              <span>Họ tên</span>
              <input
                value={newPatient.fullName}
                onChange={(e) => setNewPatient({ ...newPatient, fullName: e.target.value })}
                required
                maxLength={120}
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={newPatient.email}
                onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                required
                maxLength={160}
              />
            </label>
            <label className="field">
              <span>Số điện thoại</span>
              <input
                type="tel"
                value={newPatient.phone}
                onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                required
                maxLength={13}
              />
            </label>
            <button className="button secondary">Tạo tài khoản</button>
          </form>
        </section>
      )}

      {activeFeature === "booking" && (
        <section className="panel">
          <div className="section-title">
            <CalendarPlus size={20} />
            <h2>Đặt lịch hộ bệnh nhân</h2>
          </div>
          <form className="stack" onSubmit={createBooking}>
            <label className="field">
              <span>Bệnh nhân</span>
              <select value={booking.patientId} onChange={(e) => setBooking({ ...booking, patientId: e.target.value })} required>
                {patients.map((patient) => (
                  <option key={patient._id} value={patient._id}>
                    {patient.fullName} - {patient.phone}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Dịch vụ</span>
              <select value={booking.serviceId} onChange={(e) => setBooking({ ...booking, serviceId: e.target.value })} required>
                {services.map((service) => (
                  <option key={service._id} value={service._id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Ngày</span>
              <input type="date" value={date} min={todayInput()} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className="field">
              <span>Ghi chú</span>
              <input value={booking.note} onChange={(e) => setBooking({ ...booking, note: e.target.value })} maxLength={1000} />
            </label>
            <button className="button primary">Đặt lịch tại quầy</button>
          </form>
        </section>
      )}

      {activeFeature === "consultations" && (
        <section className="panel">
          <div className="section-title">
            <PhoneCall size={20} />
            <h2>Yêu cầu tư vấn</h2>
          </div>
          <div className="mini-list">
            {loading ? (
              <EmptyState title="Đang tải yêu cầu tư vấn" text="Hệ thống đang lấy dữ liệu mới nhất." />
            ) : consultations.map((item) => (
              <div className="mini-row" key={item._id}>
                <span>
                  {item.fullName} - {item.phone}
                </span>
                <StatusBadge value={item.status} />
                <button className="button small" onClick={() => updateConsultation(item._id, "contacted")}>
                  Đã gọi
                </button>
                <button className="button small" onClick={() => updateConsultation(item._id, "scheduled")}>
                  Đã hẹn
                </button>
              </div>
            ))}
            {!loading && !consultations.length && <EmptyState />}
          </div>
        </section>
      )}

      {activeFeature === "waitlist" && (
        <section className="panel">
          <div className="section-title">
            <CheckCircle2 size={20} />
            <h2>Danh sách chờ</h2>
          </div>
          <div className="mini-list">
            {loading ? (
              <EmptyState title="Đang tải danh sách chờ" text="Hệ thống đang lấy dữ liệu mới nhất." />
            ) : waitlist.map((entry) => (
              <div className="mini-row" key={entry._id}>
                <span>
                  {entry.patient?.fullName} - {entry.service?.name}
                </span>
                <StatusBadge value={entry.status} />
                <button className="button small" onClick={() => updateWaitlist(entry._id, "contacted")}>
                  Liên hệ
                </button>
                <button className="button small" onClick={() => updateWaitlist(entry._id, "booked")}>
                  Đã đặt
                </button>
              </div>
            ))}
            {!loading && !waitlist.length && <EmptyState />}
          </div>
        </section>
      )}

      {activeFeature === "rooms" && (
        <section className="panel">
          <div className="section-title">
            <DoorOpen size={20} />
            <h2>Trạng thái phòng</h2>
          </div>
          <div className="room-grid">
            {loading ? (
              <EmptyState title="Đang tải phòng khám" text="Hệ thống đang lấy dữ liệu mới nhất." />
            ) : rooms.map((room) => (
              <article className="room-card" key={room._id}>
                <h4>{room.name}</h4>
                <p>{room.assignedDentist?.fullName}</p>
                <StatusBadge value={room.status} />
                <div className="row-actions">
                  <button className="button small" onClick={() => updateRoomStatus(room._id, "in_use")}>
                    Đang dùng
                  </button>
                  <button className="button small" onClick={() => updateRoomStatus(room._id, "cleaning")}>
                    Vệ sinh
                  </button>
                  <button className="button small" onClick={() => updateRoomStatus(room._id, "available")}>
                    Sẵn sàng
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ReceptionMetric({ icon: Icon, label, value }) {
  return (
    <article className="metric-card">
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function needsConfirmationCall(appointment) {
  return ["scheduled", "confirmed"].includes(appointment.status) && !appointment.confirmationCalledAt;
}

function formatConfirmationText(appointment) {
  if (appointment.confirmationCalledAt) {
    const by = appointment.confirmationBy?.fullName ? ` bởi ${appointment.confirmationBy.fullName}` : "";
    return `Đã gọi xác nhận lúc ${formatDateTime(appointment.confirmationCalledAt)}${by}.`;
  }

  if (!needsConfirmationCall(appointment)) {
    return "Lịch này không cần gọi xác nhận thêm.";
  }

  const deadline = new Date(new Date(appointment.startAt).getTime() - 12 * 60 * 60 * 1000);
  const isLate = Date.now() > deadline.getTime();
  return `${isLate ? "Quá hạn gọi xác nhận" : "Hạn gọi xác nhận"}: ${formatDateTime(deadline)}.`;
}
