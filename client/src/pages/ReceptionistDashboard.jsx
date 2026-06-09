import { CalendarDays, CalendarPlus, CheckCheck, ClipboardCheck, ClipboardList, KeyRound, PhoneCall, Search } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import EmptyState from "../components/EmptyState.jsx";
import Feedback from "../components/Feedback.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { api, getErrorMessage } from "../utils/api.js";
import { formatDateTime, formatTime, todayInput } from "../utils/format.js";
import { firstError, requireValue, validateDate, validateName, validateNote, validatePhone } from "../utils/validation.js";

const receptionStatusActionOptions = [
  { value: "confirmed", label: "Đang chờ" },
  { value: "checked_in", label: "Có mặt" },
  { value: "no_show", label: "Vắng mặt" },
  { value: "in_treatment", label: "Đang khám" },
  { value: "completed", label: "Hoàn tất" }
];

const checkInStatuses = new Set(["scheduled", "confirmed", "no_show"]);
const clinicalQueueStatuses = new Set(["checked_in", "in_treatment", "completed"]);
const acceptedStatuses = new Set([...checkInStatuses, ...clinicalQueueStatuses]);
const statusActionValues = new Set(receptionStatusActionOptions.map((option) => option.value));
const intakeStatuses = new Set(["pending", "rejected"]);
const duplicateContactStatuses = new Set(["pending", "scheduled", "confirmed", "checked_in", "in_treatment"]);

const genderOptions = [
  { value: "unknown", label: "Chưa chọn" },
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
  { value: "other", label: "Other" }
];

export default function ReceptionistDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeFeature, setActiveFeature] = useState("appointments");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [date, setDate] = useState(todayInput());
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [roomFilter, setRoomFilter] = useState("all");
  const [patientSearch, setPatientSearch] = useState("");
  const [accountMode, setAccountMode] = useState("existing");
  const [newPatient, setNewPatient] = useState({ fullName: "", phone: "", gender: "unknown", createAccount: false });
  const [booking, setBooking] = useState({ patientId: "", serviceId: "", note: "" });
  const [resetPasswords, setResetPasswords] = useState({});
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
    if (["appointments", "checkin", "schedule", "booking", "accounts", "consultations"].includes(tab)) {
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
  }, [date]);

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
        setNewPatient({ fullName: "", phone: "", gender: "unknown", createAccount: false });
      }

      await api.post("/appointments", {
        patientId,
        serviceId: booking.serviceId,
        date,
        channel: "offline",
        note: booking.note
      });
      setMessage("Đã đặt lịch hộ bệnh nhân. Chuyển sang màn Check in.");
      setActiveFeature("checkin");
      navigate("/dashboard?tab=checkin", { replace: true });
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function updateAppointment(id, status, note = "Lễ tân cập nhật trạng thái lịch khám.") {
    if (!window.confirm("Xác nhận cập nhật trạng thái lịch hẹn?")) return;

    try {
      const res = await api.patch(`/appointments/${id}/status`, { status, note });
      setMessage("Đã cập nhật trạng thái lịch hẹn.");
      load();
      return res.data.appointment;
    } catch (err) {
      setError(getErrorMessage(err));
      return null;
    }
  }

  async function receptionDecision(appointment, status) {
    const labels = {
      confirmed: "chấp nhận lịch hẹn này",
      rejected: "từ chối lịch hẹn này"
    };

    if (!window.confirm(`Xác nhận ${labels[status]}?`)) return;

    try {
      await api.patch(`/appointments/${appointment._id}/status`, {
        status,
        note: `Lễ tân ${labels[status]}.`
      });
      setMessage(status === "confirmed" ? "Đã chấp nhận lịch hẹn. Chuyển sang màn Check in." : "Đã từ chối lịch hẹn.");
      if (status === "confirmed") {
        setActiveFeature("checkin");
        navigate("/dashboard?tab=checkin", { replace: true });
      }
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function applyScheduleStatus(appointment) {
    if (isLockedScheduleAppointment(appointment)) {
      setError("Lịch này đã hủy hoặc bị từ chối nên không thể thay đổi trạng thái.");
      return;
    }

    const value = statusActions[appointment._id] || defaultStatusAction(appointment);
    const updated = await updateAppointment(appointment._id, value);
    if (updated && clinicalQueueStatuses.has(value)) {
      setMessage("Đã cập nhật bệnh nhân vào Lịch khám theo thứ tự.");
      setActiveFeature("schedule");
      navigate("/dashboard?tab=schedule", { replace: true });
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
      setMessage("Đã đổi lịch bệnh nhân. Chuyển sang màn Check in.");
      setRescheduleDates((current) => ({ ...current, [appointment._id]: "" }));
      setRescheduleSlots((current) => ({ ...current, [appointment._id]: [] }));
      setRescheduleSlotKeys((current) => ({ ...current, [appointment._id]: "" }));
      setActiveFeature("checkin");
      navigate("/dashboard?tab=checkin", { replace: true });
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function scheduleReceptionAppointment(appointment) {
    const nextDate = rescheduleDates[appointment._id];
    const slotKey = rescheduleSlotKeys[appointment._id];
    const slot = (rescheduleSlots[appointment._id] || []).find((item) => buildSlotKey(item) === slotKey);
    if (!nextDate) {
      setError("Chọn ngày để xếp lịch cho bệnh nhân.");
      return;
    }
    if (!slot) {
      setError("Chọn giờ khám và bác sĩ trước khi gửi lại lịch cho bệnh nhân.");
      return;
    }

    if (!window.confirm(`Xếp lịch ${formatTime(slot.startAt)} với ${slot.dentist?.fullName || "bác sĩ"} và gửi thông báo cho bệnh nhân?`)) return;

    try {
      await api.patch(`/appointments/${appointment._id}/reception-schedule`, {
        serviceId: appointment.service?._id,
        date: nextDate,
        startAt: slot.startAt,
        roomId: slot.room._id,
        note: "Lễ tân đã xếp giờ khám và bác sĩ cho bệnh nhân."
      });
      setMessage("Đã xếp lịch và gửi thông tin lịch hẹn cho bệnh nhân.");
      setRescheduleDates((current) => ({ ...current, [appointment._id]: "" }));
      setRescheduleSlots((current) => ({ ...current, [appointment._id]: [] }));
      setRescheduleSlotKeys((current) => ({ ...current, [appointment._id]: "" }));
      setActiveFeature("checkin");
      navigate("/dashboard?tab=checkin", { replace: true });
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
      const res = await api.get("/availability", { params: { serviceId: appointment.service?._id, date: nextDate, includeBooked: "true" } });
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

  async function resetPatientPassword(patient) {
    const password = resetPasswords[patient._id] || "Password123!";
    if (!window.confirm(`Xác nhận reset mật khẩu cho ${patient.fullName}?`)) return;

    try {
      const res = await api.patch(`/reception/patients/${patient._id}/reset-password`, { password });
      setMessage(`Đã reset mật khẩu cho ${res.data.patient.fullName}. Mật khẩu tạm: ${res.data.temporaryPassword}`);
      setResetPasswords((current) => ({ ...current, [patient._id]: "" }));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const filteredBaseAppointments = appointments.filter((appointment) => matchesAppointmentFilters(appointment, appointmentSearch, roomFilter));
  const pendingAppointments = filteredBaseAppointments.filter((appointment) => intakeStatuses.has(appointment.status));
  const checkInAppointments = filteredBaseAppointments.filter((appointment) => checkInStatuses.has(appointment.status));
  const clinicalQueueAppointments = filteredBaseAppointments.filter((appointment) => clinicalQueueStatuses.has(appointment.status));
  const pendingIntakeCount = appointments.filter((appointment) => appointment.status === "pending").length;
  const rejectedIntakeCount = appointments.filter((appointment) => appointment.status === "rejected").length;
  const acceptedCount = appointments.filter((appointment) => acceptedStatuses.has(appointment.status)).length;
  const checkInCount = appointments.filter((appointment) => checkInStatuses.has(appointment.status)).length;
  const duplicateContactCount = pendingAppointments.filter((appointment) => duplicateBookingInfo(appointment, appointments).shouldContact).length;
  const checkedInCount = appointments.filter((appointment) => appointment.status === "checked_in").length;
  const inTreatmentCount = appointments.filter((appointment) => appointment.status === "in_treatment").length;
  const patientKeyword = patientSearch.trim().toLowerCase();
  const selectablePatients = patients.filter((patient) => {
    if (!patientKeyword) return true;
    return [patient.fullName, patient.phone].filter(Boolean).join(" ").toLowerCase().includes(patientKeyword);
  });

  const dentistColumns = useMemo(() => {
    const roomDentists = rooms.map((room) => room.assignedDentist).filter(Boolean);
    const appointmentDentists = clinicalQueueAppointments.map((appointment) => appointment.dentist).filter(Boolean);
    const merged = Array.from(new Map([...roomDentists, ...appointmentDentists].map((dentist) => [dentist._id, dentist])).values()).slice(0, 3);

    while (merged.length < 3) {
      merged.push({
        _id: `fixed-dentist-${merged.length + 1}`,
        fullName: `Bác sĩ ${merged.length + 1}`,
        specialty: "Bác sĩ nha khoa"
      });
    }

    return merged;
  }, [rooms, clinicalQueueAppointments]);

  const appointmentsByDentist = useMemo(() => {
    const map = new Map(dentistColumns.map((dentist) => [dentist._id, []]));
    clinicalQueueAppointments
      .filter((appointment) => appointment.dentist?._id && map.has(appointment.dentist._id))
      .sort(compareQueueOrder)
      .forEach((appointment) => {
        map.get(appointment.dentist._id).push(appointment);
      });
    return map;
  }, [dentistColumns, clinicalQueueAppointments]);

  const queueRowCount = Math.max(1, ...Array.from(appointmentsByDentist.values()).map((items) => items.length));

  return (
    <div className="page-grid">
      <Feedback error={error} message={message} onClear={() => { setError(""); setMessage(""); }} />

      {activeFeature === "appointments" && (
        <section className="panel">
          <div className="section-title">
            <ClipboardList size={20} />
            <h2>Lịch hẹn chờ xác nhận</h2>
          </div>
          <p className="muted">Thời gian thực: {currentTime.toLocaleString("vi-VN")}</p>

          <div className="metrics-grid compact-grid">
            <ReceptionMetric icon={ClipboardList} label="Chờ xác nhận" value={pendingIntakeCount} />
            <ReceptionMetric icon={ClipboardList} label="Đã từ chối" value={rejectedIntakeCount} />
            <ReceptionMetric icon={CalendarDays} label="Đã chấp nhận" value={acceptedCount} />
            <ReceptionMetric icon={PhoneCall} label="Cần liên hệ" value={duplicateContactCount} />
          </div>

          <ReceptionFilters
            date={date}
            setDate={setDate}
            rooms={rooms}
            roomFilter={roomFilter}
            setRoomFilter={setRoomFilter}
            appointmentSearch={appointmentSearch}
            setAppointmentSearch={setAppointmentSearch}
          />

          {loading ? (
            <EmptyState title="Đang tải lịch hẹn" text="Hệ thống đang lấy dữ liệu mới nhất." />
          ) : pendingAppointments.length ? (
            <div className="appointment-list">
              {pendingAppointments.map((appointment) => {
                const duplicateInfo = duplicateBookingInfo(appointment, appointments);
                return (
                  <article className={`appointment-card reception-appointment-card pending-intake ${duplicateInfo.shouldContact ? "needs-contact" : ""}`} key={appointment._id}>
                    <div className="appointment-card-main">
                      <div className="patient-contact-row">
                        <div>
                          <h4>{appointment.patient?.fullName || "Bệnh nhân"}</h4>
                          <p>{appointment.patient?.phone || "Chưa có SĐT"}</p>
                        </div>
                        <StatusBadge value={appointment.status} />
                      </div>
                      <div className="appointment-slot-box">
                        <strong>Slot bệnh nhân đã đặt</strong>
                        <span>{appointment.service?.name} - {formatDateTime(appointment.startAt)}</span>
                        <span>Giờ đến dự kiến: {formatDateTime(appointment.arrivalAt)}</span>
                        <span>Phòng: {appointment.room?.name || "-"} / Bác sĩ: {appointment.dentist?.fullName || "-"}</span>
                        <span>Bác sĩ mong muốn: {appointment.dentistPreference === "random" ? "Ngẫu nhiên, lễ tân xếp bác sĩ" : "Bệnh nhân đã chọn bác sĩ"}</span>
                        <span>Y tá: {appointment.nurse?.fullName || "Chưa phân công"} / Kênh: {appointment.channel === "online" ? "Online" : "Tại quầy"}</span>
                      </div>
                      {duplicateInfo.shouldContact && (
                        <div className="duplicate-contact-alert">
                          <PhoneCall size={16} />
                          <span>
                            Cần liên hệ: giờ này đã có {duplicateInfo.count} bệnh nhân chọn. Người đặt trước: {duplicateInfo.firstPatient}.
                          </span>
                        </div>
                      )}
                      {appointment.patientNote && <span className="mini">Ghi chú bệnh nhân: {appointment.patientNote}</span>}
                    </div>
                    <div className="appointment-card-actions">
                      <div className="appointment-intake-actions">
                        <button className="button small primary" onClick={() => receptionDecision(appointment, "confirmed")}>
                          {appointment.status === "rejected" ? "Chấp nhận lại" : "Chấp nhận"}
                        </button>
                        <button className="button small danger" disabled={appointment.status === "rejected"} onClick={() => receptionDecision(appointment, "rejected")}>
                          Từ chối
                        </button>
                      </div>
                      <div className="row-actions appointment-reschedule-tools">
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
                          Xem giờ/bác sĩ
                        </button>
                        {(rescheduleSlots[appointment._id] || []).length > 0 && (
                          <select
                            value={rescheduleSlotKeys[appointment._id] || ""}
                            onChange={(e) => setRescheduleSlotKeys((current) => ({ ...current, [appointment._id]: e.target.value }))}
                          >
                            {(rescheduleSlots[appointment._id] || []).map((slot) => (
                              <option value={buildSlotKey(slot)} key={buildSlotKey(slot)}>
                                {formatTime(slot.startAt)} - {slot.room.name} - {slot.dentist?.fullName}{slot.isBooked ? ` (${slot.bookedCount} lịch)` : ""}
                              </option>
                            ))}
                          </select>
                        )}
                        <button className="button small primary" onClick={() => scheduleReceptionAppointment(appointment)}>
                          Xếp lịch & gửi
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Không có lịch chờ xử lý" text="Các lịch đã chấp nhận sẽ nằm ở chức năng Check in." />
          )}
        </section>
      )}

      {activeFeature === "checkin" && (
        <section className="panel reception-checkin-panel">
          <div className="section-title">
            <ClipboardCheck size={20} />
            <h2>Check in bệnh nhân</h2>
          </div>
          <p className="muted">Lịch đã được lễ tân xác nhận hoặc đặt hộ sẽ nằm ở đây. Cập nhật “Có mặt” để đưa bệnh nhân sang Lịch khám theo thứ tự.</p>

          <div className="metrics-grid compact-grid">
            <ReceptionMetric icon={ClipboardCheck} label="Chờ check in" value={checkInCount} />
            <ReceptionMetric icon={CheckCheck} label="Đã có mặt" value={checkedInCount} />
            <ReceptionMetric icon={ClipboardList} label="Đang khám" value={inTreatmentCount} />
          </div>

          <ReceptionFilters
            date={date}
            setDate={setDate}
            rooms={rooms}
            roomFilter={roomFilter}
            setRoomFilter={setRoomFilter}
            appointmentSearch={appointmentSearch}
            setAppointmentSearch={setAppointmentSearch}
          />

          {loading ? (
            <EmptyState title="Đang tải danh sách check in" text="Hệ thống đang lấy dữ liệu mới nhất." />
          ) : checkInAppointments.length ? (
            <div className="appointment-list checkin-list">
              {checkInAppointments.map((appointment) => (
                <article className="appointment-card reception-checkin-card" key={appointment._id}>
                  <div className="appointment-card-main">
                    <div className="patient-contact-row">
                      <div>
                        <h4>{appointment.patient?.fullName || "Bệnh nhân"}</h4>
                        <p>{appointment.patient?.phone || "Chưa có SĐT"}</p>
                      </div>
                      <StatusBadge value={appointment.status} />
                    </div>
                    <div className="appointment-slot-box">
                      <strong>{appointment.service?.name || "Dịch vụ"}</strong>
                      <span>{formatDateTime(appointment.startAt)} - {appointment.room?.name || "Phòng khám"}</span>
                      <span>Bác sĩ: {appointment.dentist?.fullName || "-"}</span>
                      {appointment.patientNote && <span>Ghi chú: {appointment.patientNote}</span>}
                    </div>
                  </div>

                  <div className="row-actions schedule-status-actions checkin-status-actions">
                    <select
                      value={statusActions[appointment._id] || defaultStatusAction(appointment)}
                      onChange={(e) => setStatusActions((current) => ({ ...current, [appointment._id]: e.target.value }))}
                    >
                      {receptionStatusActionOptions.map((option) => (
                        <option value={option.value} key={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button className="button small primary" onClick={() => applyScheduleStatus(appointment)}>
                      Cập nhật
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Không có lịch chờ check in" text="Lịch sau khi xác nhận hoặc đặt hộ sẽ xuất hiện ở đây." />
          )}
        </section>
      )}

      {activeFeature === "schedule" && (
        <section className="panel reception-schedule-panel">
          <div className="section-title">
            <CalendarDays size={20} />
            <h2>Lịch khám theo thứ tự check-in</h2>
          </div>

          <div className="metrics-grid compact-grid">
            <ReceptionMetric icon={CalendarDays} label="Lịch trong hàng đợi" value={clinicalQueueAppointments.length} />
            <ReceptionMetric icon={CheckCheck} label="Có mặt" value={checkedInCount} />
            <ReceptionMetric icon={ClipboardList} label="Đang khám" value={inTreatmentCount} />
          </div>

          <ReceptionFilters
            date={date}
            setDate={setDate}
            rooms={rooms}
            roomFilter={roomFilter}
            setRoomFilter={setRoomFilter}
            appointmentSearch={appointmentSearch}
            setAppointmentSearch={setAppointmentSearch}
          />

          {loading ? (
            <EmptyState title="Đang tải lịch khám" text="Hệ thống đang lấy dữ liệu mới nhất." />
          ) : (
            <div className="reception-schedule-table-wrapper">
              <div
                className="reception-schedule-grid"
                style={{ gridTemplateColumns: "74px repeat(3, minmax(220px, 1fr))" }}
              >
                <div className="schedule-head schedule-time-head">STT</div>
                {dentistColumns.map((dentist) => (
                  <div className="schedule-head dentist-head" key={dentist._id}>
                    <strong>{dentist.fullName}</strong>
                    <span>{dentist.specialty || "Bác sĩ"}</span>
                  </div>
                ))}

                {Array.from({ length: queueRowCount }, (_, rowIndex) => (
                  <Fragment key={`queue-row-${rowIndex}`}>
                    <div className="schedule-time-cell">#{rowIndex + 1}</div>
                    {dentistColumns.map((dentist) => {
                      const appointment = appointmentsByDentist.get(dentist._id)?.[rowIndex];
                      const locked = appointment ? isLockedScheduleAppointment(appointment) : false;
                      return (
                        <div className="schedule-cell" key={`${rowIndex}-${dentist._id}`}>
                          {appointment ? (
                            <article className={`schedule-cell-card ${locked ? "locked" : ""}`} key={appointment._id}>
                              <div>
                                <strong>{appointment.patient?.fullName || "Bệnh nhân"}</strong>
                                <span>{appointment.service?.name || "Dịch vụ"} / {appointment.room?.name || "Phòng"}</span>
                                <span>Giờ hẹn: {formatTime(appointment.startAt)}</span>
                                {appointment.checkedInAt && <span>Check-in: {formatTime(appointment.checkedInAt)}</span>}
                                <StatusBadge value={appointment.status} />
                                {locked && <small>Lịch đã hủy hoặc bị từ chối, không thể đổi trạng thái.</small>}
                              </div>
                              <div className="row-actions schedule-status-actions">
                                <select
                                  value={statusActions[appointment._id] || defaultStatusAction(appointment)}
                                  disabled={locked}
                                  onChange={(e) => setStatusActions((current) => ({ ...current, [appointment._id]: e.target.value }))}
                                >
                                  {receptionStatusActionOptions.map((option) => (
                                    <option value={option.value} key={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <button className="button small" disabled={locked} onClick={() => applyScheduleStatus(appointment)}>
                                  Cập nhật
                                </button>
                              </div>
                            </article>
                          ) : (
                            <span className="schedule-empty-cell">Chưa có bệnh nhân</span>
                          )}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          )}
        </section>
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
                  <span>Giới tính</span>
                  <select value={newPatient.gender} onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}>
                    {genderOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-field account-create-checkbox">
                  <input
                    type="checkbox"
                    checked={newPatient.createAccount}
                    onChange={(e) => setNewPatient({ ...newPatient, createAccount: e.target.checked })}
                  />
                  <span>Tạo tài khoản mới cho bệnh nhân từ thông tin trên</span>
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

      {activeFeature === "accounts" && (
        <section className="panel">
          <div className="section-title">
            <KeyRound size={20} />
            <h2>Tài khoản bệnh nhân</h2>
          </div>
          <p className="muted">Tìm bệnh nhân và reset mật khẩu khi bệnh nhân cần hỗ trợ đăng nhập.</p>

          <label className="field">
            <span>Tìm tài khoản bệnh nhân</span>
            <div className="input-with-icon">
              <Search size={17} />
              <input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder="Tên hoặc số điện thoại" />
            </div>
          </label>

          {loading ? (
            <EmptyState title="Đang tải tài khoản" text="Hệ thống đang lấy dữ liệu bệnh nhân." />
          ) : selectablePatients.length ? (
            <div className="reset-account-grid">
              {selectablePatients.map((patient) => (
                <article className="reset-account-card" key={patient._id}>
                  <div>
                    <strong>{patient.fullName}</strong>
                    <span>{patient.phone || "Chưa có SĐT"}</span>
                  </div>
                  <input
                    type="password"
                    value={resetPasswords[patient._id] || ""}
                    onChange={(e) => setResetPasswords((current) => ({ ...current, [patient._id]: e.target.value }))}
                    placeholder="Mặc định: Password123!"
                    minLength={8}
                    maxLength={72}
                  />
                  <button className="button small primary" onClick={() => resetPatientPassword(patient)}>
                    Reset mật khẩu
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Không tìm thấy bệnh nhân" text="Thử tìm bằng số điện thoại hoặc họ tên khác." />
          )}
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

function ReceptionFilters({ date, setDate, rooms, roomFilter, setRoomFilter, appointmentSearch, setAppointmentSearch }) {
  return (
    <div className="toolbar-row">
      <label className="field inline-field">
        <span>Ngày</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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

function matchesAppointmentFilters(appointment, appointmentSearch, roomFilter) {
  const keyword = appointmentSearch.trim().toLowerCase();
  const matchesRoom = roomFilter === "all" || appointment.room?._id === roomFilter;
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

  return matchesRoom && (!keyword || searchableText.includes(keyword));
}

function isLockedScheduleAppointment(appointment) {
  return ["cancelled", "rejected"].includes(appointment.status);
}

function compareQueueOrder(a, b) {
  const aCheckedIn = Boolean(a.checkedInAt || a.checkInTime);
  const bCheckedIn = Boolean(b.checkedInAt || b.checkInTime);
  if (aCheckedIn !== bCheckedIn) return aCheckedIn ? -1 : 1;

  const aTime = new Date(a.checkInTime || a.checkedInAt || a.startAt || a.createdAt).getTime();
  const bTime = new Date(b.checkInTime || b.checkedInAt || b.startAt || b.createdAt).getTime();
  return aTime - bTime;
}

function duplicateBookingInfo(appointment, appointments) {
  const dentistId = appointment.dentist?._id;
  const startTime = new Date(appointment.startAt).getTime();
  if (!dentistId || !startTime) return { count: 0, firstPatient: "-", shouldContact: false };

  const matches = appointments
    .filter((item) => (
      item.dentist?._id === dentistId &&
      new Date(item.startAt).getTime() === startTime &&
      duplicateContactStatuses.has(item.status)
    ))
    .sort((a, b) => new Date(a.createdAt || a.bookingDate || a.startAt) - new Date(b.createdAt || b.bookingDate || b.startAt));
  const position = matches.findIndex((item) => item._id === appointment._id);

  return {
    count: matches.length,
    firstPatient: matches[0]?.patient?.fullName || "bệnh nhân đặt trước",
    shouldContact: matches.length > 1 && position > 0
  };
}

function defaultStatusAction(appointment) {
  return statusActionValues.has(appointment.status) ? appointment.status : "confirmed";
}

function buildSlotKey(slot) {
  return `${slot.startAt}|${slot.room?._id}`;
}
