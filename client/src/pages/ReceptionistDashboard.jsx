import { CalendarPlus, CheckCheck, ClipboardList, DoorOpen, PhoneCall, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import EmptyState from "../components/EmptyState.jsx";
import Feedback from "../components/Feedback.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { api, getErrorMessage } from "../services/api.js";
import { formatDateTime, formatTime, todayInput } from "../utils/format.js";
import { firstError, requireValue, validateDate, validateName, validateNote, validatePhone } from "../utils/validation.js";

const appointmentStatusOptions = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "called", label: "Đã gọi" },
  { value: "scheduled", label: "Đã đặt" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "checked_in", label: "Đã đến" },
  { value: "completed", label: "Hoàn tất" },
  { value: "cancelled", label: "Đã hủy" },
  { value: "no_show", label: "Vắng mặt" }
];

const statusActionOptions = appointmentStatusOptions.filter((option) => option.value !== "all");

const genderOptions = [
  { value: "unknown", label: "Chưa chọn" },
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
  { value: "other", label: "Other" }
];

export default function ReceptionistDashboard() {
  const location = useLocation();
  const [activeFeature, setActiveFeature] = useState("appointments");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [date, setDate] = useState(todayInput());
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [appointmentStatus, setAppointmentStatus] = useState("all");
  const [roomFilter, setRoomFilter] = useState("all");
  const [patientSearch, setPatientSearch] = useState("");
  const [accountMode, setAccountMode] = useState("existing");
  const [newPatient, setNewPatient] = useState({ fullName: "", phone: "", gender: "unknown", address: "" });
  const [booking, setBooking] = useState({ patientId: "", serviceId: "", note: "" });
  const [rescheduleDates, setRescheduleDates] = useState({});
  const [rescheduleSlots, setRescheduleSlots] = useState({});
  const [rescheduleSlotKeys, setRescheduleSlotKeys] = useState({});
  const [statusActions, setStatusActions] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/reception/dashboard", { params: { date } });

      setAppointments(res.data.appointments);
      setPatients(res.data.patients);
      setServices(res.data.services);
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

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    if (["appointments", "booking", "consultations"].includes(tab)) {
      setActiveFeature(tab);
    }
  }, [location.search]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const refresh = setInterval(load, 30000);
    return () => {
      clearInterval(timer);
      clearInterval(refresh);
    };
  }, [date, patientSearch]);

  async function createBooking(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const commonError = firstError(requireValue(booking.serviceId, "Dịch vụ"), validateDate(date), validateNote(booking.note));
    const patientError =
      accountMode === "existing"
        ? requireValue(booking.patientId, "Bệnh nhân")
        : firstError(validateName(newPatient.fullName), validatePhone(newPatient.phone), requireValue(newPatient.gender, "Gender"));
    const validationError = firstError(commonError, patientError);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!window.confirm("Xác nhận đặt lịch hộ bệnh nhân?")) return;

    try {
      let patientId = booking.patientId;

      if (accountMode === "new") {
        const res = await api.post("/reception/patients", newPatient);
        patientId = res.data.patient._id;
        setNewPatient({ fullName: "", phone: "", gender: "unknown", address: "" });
      }

      await api.post("/appointments", {
        patientId,
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
    if (!window.confirm("Xác nhận cập nhật trạng thái lịch hẹn?")) return;

    try {
      await api.patch(`/appointments/${id}/status`, { status });
      setMessage("Đã cập nhật trạng thái lịch hẹn.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function applyStatusAction(appointment) {
    const value = statusActions[appointment._id] || appointment.status;
    if (value === "called") {
      await confirmAppointmentCall(appointment._id);
      return;
    }

    await updateAppointment(appointment._id, value);
  }

  async function confirmAppointmentCall(id) {
    if (!window.confirm("Xác nhận đã gọi bệnh nhân?")) return;

    try {
      await api.patch(`/appointments/${id}/confirmation-call`, { note: "Lễ tân đã gọi xác nhận trước giờ khám." });
      setMessage("Đã ghi nhận cuộc gọi xác nhận và gửi thông báo cho bệnh nhân.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function checkIn(id) {
    if (!window.confirm("Xác nhận ghi nhận bệnh nhân đã đến?")) return;

    try {
      await api.patch(`/appointments/${id}/check-in`, { paid: false });
      setMessage("Đã ghi nhận bệnh nhân đến quầy.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function rescheduleAppointment(appointment) {
    const nextDate = rescheduleDates[appointment._id];
    const slotKey = rescheduleSlotKeys[appointment._id];
    const slot = (rescheduleSlots[appointment._id] || []).find((item) => buildSlotKey(item) === slotKey);
    if (!nextDate) {
      setError("Chọn ngày mới trước khi đổi lịch.");
      return;
    }
    if (!slot) {
      setError("Chọn slot trống trước khi đổi lịch.");
      return;
    }

    if (!window.confirm(`Xác nhận đổi lịch sang ${formatTime(slot.startAt)} tại ${slot.room.name}?`)) return;

    try {
      await api.patch(`/appointments/${appointment._id}/reschedule`, { date: nextDate, startAt: slot.startAt, roomId: slot.room._id });
      setMessage("Đã đổi lịch bệnh nhân sang slot trống đã chọn.");
      setRescheduleDates((current) => ({ ...current, [appointment._id]: "" }));
      setRescheduleSlots((current) => ({ ...current, [appointment._id]: [] }));
      setRescheduleSlotKeys((current) => ({ ...current, [appointment._id]: "" }));
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function loadRescheduleSlots(appointment) {
    const nextDate = rescheduleDates[appointment._id];
    if (!nextDate) {
      setError("Chọn ngày mới để xem slot trống.");
      return;
    }

    try {
      const res = await api.get("/availability", { params: { serviceId: appointment.service?._id, date: nextDate } });
      const slots = res.data.slots || [];
      setRescheduleSlots((current) => ({ ...current, [appointment._id]: slots }));
      setRescheduleSlotKeys((current) => ({ ...current, [appointment._id]: slots[0] ? buildSlotKey(slots[0]) : "" }));
      if (!slots.length) setMessage("Ngày này chưa có slot trống phù hợp.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function updateConsultation(id, status) {
    if (!window.confirm("Xác nhận cập nhật yêu cầu tư vấn?")) return;

    try {
      await api.patch(`/reception/consultations/${id}`, { status });
      setMessage("Đã cập nhật yêu cầu tư vấn.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function updateRoomStatus(id, status) {
    if (!window.confirm("Xác nhận cập nhật trạng thái phòng?")) return;

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
    const matchesRoom = roomFilter === "all" || appointment.room?._id === roomFilter;
    const matchesStatus =
      appointmentStatus === "all" ||
      (appointmentStatus === "called" ? Boolean(appointment.confirmationCalledAt) : appointment.status === appointmentStatus);
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

    return matchesRoom && matchesStatus && (!keyword || searchableText.includes(keyword));
  });
  const confirmationNeededCount = appointments.filter((appointment) => needsConfirmationCall(appointment)).length;
  const checkedInCount = appointments.filter((appointment) => appointment.status === "checked_in").length;
  const patientKeyword = patientSearch.trim().toLowerCase();
  const selectablePatients = patients.filter((patient) => {
    if (!patientKeyword) return true;
    return [patient.fullName, patient.phone].filter(Boolean).join(" ").toLowerCase().includes(patientKeyword);
  });

  return (
    <div className="page-grid">
      <Feedback error={error} message={message} onClear={() => { setError(""); setMessage(""); }} />

      {activeFeature === "appointments" && (
        <>
        <section className="panel">
          <div className="section-title">
            <ClipboardList size={20} />
            <h2>Lịch hẹn trong ngày</h2>
          </div>
          <p className="muted">Thời gian thực: {currentTime.toLocaleString("vi-VN")}</p>

          <div className="metrics-grid compact-grid">
            <ReceptionMetric icon={ClipboardList} label="Tổng lịch" value={appointments.length} />
            <ReceptionMetric icon={PhoneCall} label="Cần gọi xác nhận" value={confirmationNeededCount} />
            <ReceptionMetric icon={CheckCheck} label="Đã đến" value={checkedInCount} />
          </div>

          <div className="toolbar-row">
            <label className="field inline-field">
              <span>Ngày</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
            <label className="field inline-field">
              <span>Phòng</span>
              <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
                <option value="all">Tất cả phòng</option>
                {rooms.map((room) => (
                  <option key={room._id} value={room._id}>
                    {room.name}
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
              {filteredAppointments.map((appointment) => {
                return (
                  <article className="appointment-card" key={appointment._id}>
                    <div>
                      <h4>{appointment.patient?.fullName}</h4>
                      <p>
                        {appointment.service?.name} - {formatDateTime(appointment.startAt)}
                      </p>
                      <div className="appointment-meta-stack">
                        <span className="mini">
                          Phòng: {appointment.room?.name} / Bác sĩ: {appointment.dentist?.fullName}
                        </span>
                        <span className="mini">Giờ đến: {formatDateTime(appointment.arrivalAt)}</span>
                      </div>
                      <span className={`mini confirmation-note ${needsConfirmationCall(appointment) ? "warning-text" : ""}`}>
                        {formatConfirmationText(appointment)}
                      </span>
                    </div>
                    <div className="row-actions">
                      <select
                        value={statusActions[appointment._id] || appointment.status}
                        onChange={(e) => setStatusActions((current) => ({ ...current, [appointment._id]: e.target.value }))}
                      >
                        {statusActionOptions.map((option) => (
                          <option value={option.value} key={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button className="button small" onClick={() => applyStatusAction(appointment)}>
                        Cập nhật
                      </button>
                      <input
                        type="date"
                        min={todayInput()}
                        value={rescheduleDates[appointment._id] || ""}
                        onChange={(e) => {
                          setRescheduleDates((current) => ({ ...current, [appointment._id]: e.target.value }));
                          setRescheduleSlots((current) => ({ ...current, [appointment._id]: [] }));
                          setRescheduleSlotKeys((current) => ({ ...current, [appointment._id]: "" }));
                        }}
                      />
                      <button className="button small" onClick={() => loadRescheduleSlots(appointment)}>
                        Xem slot
                      </button>
                      {(rescheduleSlots[appointment._id] || []).length > 0 && (
                        <select
                          value={rescheduleSlotKeys[appointment._id] || ""}
                          onChange={(e) => setRescheduleSlotKeys((current) => ({ ...current, [appointment._id]: e.target.value }))}
                        >
                          {(rescheduleSlots[appointment._id] || []).map((slot) => (
                            <option value={buildSlotKey(slot)} key={buildSlotKey(slot)}>
                              {formatTime(slot.startAt)} - {slot.room.name} - {slot.dentist?.fullName}
                            </option>
                          ))}
                        </select>
                      )}
                      <button className="button small" onClick={() => rescheduleAppointment(appointment)}>
                        Đổi lịch slot
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Không có lịch phù hợp" text="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." />
          )}
        </section>
          <section className="panel room-status-panel">
            <div className="section-title">
              <DoorOpen size={20} />
              <h2>Trạng thái phòng trong lịch hẹn</h2>
            </div>
            <div className="room-grid">
              {rooms.map((room) => (
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
        </>
      )}

      {activeFeature === "booking" && (
        <section className="panel">
          <div className="section-title">
            <CalendarPlus size={20} />
            <h2>Đặt lịch hộ bệnh nhân</h2>
          </div>
          <form className="stack" onSubmit={createBooking}>
            <div className="segmented-control">
              <label>
                <input type="radio" name="accountMode" value="existing" checked={accountMode === "existing"} onChange={(e) => setAccountMode(e.target.value)} />
                <span>Đã có tài khoản</span>
              </label>
              <label>
                <input type="radio" name="accountMode" value="new" checked={accountMode === "new"} onChange={(e) => setAccountMode(e.target.value)} />
                <span>Chưa có tài khoản</span>
              </label>
            </div>

            {accountMode === "existing" ? (
              <>
                <label className="field">
                  <span>Tìm tài khoản bệnh nhân</span>
                  <input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder="Tên hoặc số điện thoại" />
                </label>
                <label className="field">
                  <span>Bệnh nhân</span>
                  <select value={booking.patientId} onChange={(e) => setBooking({ ...booking, patientId: e.target.value })} required>
                    {selectablePatients.map((patient) => (
                      <option key={patient._id} value={patient._id}>
                        {patient.fullName} - {patient.phone}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <div className="form-grid">
                <label className="field">
                  <span>Họ tên</span>
                  <input value={newPatient.fullName} onChange={(e) => setNewPatient({ ...newPatient, fullName: e.target.value })} required />
                </label>
                <label className="field">
                  <span>Số điện thoại</span>
                  <input type="tel" value={newPatient.phone} onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })} required />
                </label>
                <label className="field">
                  <span>Gender</span>
                  <select value={newPatient.gender} onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}>
                    {genderOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Address</span>
                  <input value={newPatient.address} onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })} />
                </label>
              </div>
            )}

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
            <button className="button primary booking-submit-final">Đặt lịch hộ</button>
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
                <button className="button small" onClick={() => updateConsultation(item._id, "closed")}>
                  Đóng
                </button>
              </div>
            ))}
            {!loading && !consultations.length && <EmptyState />}
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

function buildSlotKey(slot) {
  return `${slot.startAt}|${slot.room?._id}`;
}
