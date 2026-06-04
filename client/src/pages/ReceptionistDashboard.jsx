import { CalendarDays, CalendarPlus, CheckCheck, ClipboardList, PhoneCall, Search } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import EmptyState from "../components/EmptyState.jsx";
import Feedback from "../components/Feedback.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { api, getErrorMessage } from "../services/api.js";
import { formatDateTime, formatTime, todayInput } from "../utils/format.js";
import { firstError, requireValue, validateDate, validateName, validateNote, validatePhone } from "../utils/validation.js";

const receptionStatusActionOptions = [
  { value: "checked_in", label: "Có mặt" },
  { value: "no_show", label: "Vắng mặt" },
  { value: "in_treatment", label: "Đang khám" },
  { value: "completed", label: "Hoàn tất" },
  { value: "cancelled", label: "Đã hủy" }
];

const scheduleStatuses = new Set(["scheduled", "confirmed", "checked_in", "in_treatment", "completed", "cancelled", "no_show"]);
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
  const [newPatient, setNewPatient] = useState({ fullName: "", phone: "", gender: "unknown", address: "", createAccount: false });
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
    if (["appointments", "schedule", "booking", "consultations"].includes(tab)) {
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
        setNewPatient({ fullName: "", phone: "", gender: "unknown", address: "", createAccount: false });
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

  async function updateAppointment(id, status, note = "Lễ tân cập nhật trạng thái lịch khám.") {
    if (!window.confirm("Xác nhận cập nhật trạng thái lịch hẹn?")) return;

    try {
      await api.patch(`/appointments/${id}/status`, { status, note });
      setMessage("Đã cập nhật trạng thái lịch hẹn.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
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
      setMessage(status === "confirmed" ? "Đã chấp nhận lịch hẹn." : "Đã từ chối lịch hẹn.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function applyScheduleStatus(appointment) {
    if (isPatientCancelled(appointment)) {
      setError("Lịch này do bệnh nhân hủy nên lễ tân không thể thay đổi trạng thái.");
      return;
    }

    const value = statusActions[appointment._id] || defaultStatusAction(appointment);
    await updateAppointment(appointment._id, value);
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

  const filteredBaseAppointments = appointments.filter((appointment) => matchesAppointmentFilters(appointment, appointmentSearch, roomFilter));
  const pendingAppointments = filteredBaseAppointments.filter((appointment) => intakeStatuses.has(appointment.status));
  const scheduleAppointments = filteredBaseAppointments.filter((appointment) => scheduleStatuses.has(appointment.status));
  const pendingIntakeCount = appointments.filter((appointment) => appointment.status === "pending").length;
  const rejectedIntakeCount = appointments.filter((appointment) => appointment.status === "rejected").length;
  const acceptedCount = appointments.filter((appointment) => scheduleStatuses.has(appointment.status)).length;
  const duplicateContactCount = pendingAppointments.filter((appointment) => duplicateBookingInfo(appointment, appointments).shouldContact).length;
  const checkedInCount = appointments.filter((appointment) => appointment.status === "checked_in").length;
  const inTreatmentCount = appointments.filter((appointment) => appointment.status === "in_treatment").length;
  const patientKeyword = patientSearch.trim().toLowerCase();
  const selectablePatients = patients.filter((patient) => {
    if (!patientKeyword) return true;
    return [patient.fullName, patient.phone].filter(Boolean).join(" ").toLowerCase().includes(patientKeyword);
  });

  const dentistColumns = useMemo(() => {
    return Array.from(
      new Map(scheduleAppointments.map((appointment) => [appointment.dentist?._id, appointment.dentist]).filter(([id]) => id)).values()
    );
  }, [scheduleAppointments]);

  const slotRows = useMemo(() => {
    return Array.from(
      new Map(
        scheduleAppointments.map((appointment) => [
          new Date(appointment.startAt).getTime(),
          { key: new Date(appointment.startAt).getTime(), label: formatTime(appointment.startAt) }
        ])
      ).values()
    ).sort((a, b) => a.key - b.key);
  }, [scheduleAppointments]);

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
                        <span>Phòng: {appointment.room?.name || "-"} / Bác sĩ: {appointment.dentist?.fullName || "-"}</span>
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
                          Đổi lịch
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Không có lịch chờ xử lý" text="Các lịch đã chấp nhận sẽ nằm ở chức năng Lịch khám." />
          )}
        </section>
      )}

      {activeFeature === "schedule" && (
        <section className="panel reception-schedule-panel">
          <div className="section-title">
            <CalendarDays size={20} />
            <h2>Lịch khám theo bác sĩ và slot</h2>
          </div>

          <div className="metrics-grid compact-grid">
            <ReceptionMetric icon={CalendarDays} label="Lịch trong bảng" value={scheduleAppointments.length} />
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
          ) : scheduleAppointments.length && dentistColumns.length ? (
            <div className="reception-schedule-table-wrapper">
              <div
                className="reception-schedule-grid"
                style={{ gridTemplateColumns: `92px repeat(${dentistColumns.length}, minmax(220px, 1fr))` }}
              >
                <div className="schedule-head schedule-time-head">Giờ</div>
                {dentistColumns.map((dentist) => (
                  <div className="schedule-head dentist-head" key={dentist._id}>
                    <strong>{dentist.fullName}</strong>
                    <span>{dentist.specialty || "Bác sĩ"}</span>
                  </div>
                ))}

                {slotRows.map((row) => (
                  <Fragment key={row.key}>
                    <div className="schedule-time-cell">{row.label}</div>
                    {dentistColumns.map((dentist) => {
                      const cellAppointments = scheduleAppointments.filter(
                        (appointment) =>
                          appointment.dentist?._id === dentist._id &&
                          new Date(appointment.startAt).getTime() === row.key
                      );
                      return (
                        <div className="schedule-cell" key={`${row.key}-${dentist._id}`}>
                          {cellAppointments.map((appointment) => {
                            const locked = isPatientCancelled(appointment);
                            return (
                              <article className={`schedule-cell-card ${locked ? "locked" : ""}`} key={appointment._id}>
                                <div>
                                  <strong>{appointment.patient?.fullName || "Bệnh nhân"}</strong>
                                  <span>{appointment.service?.name || "Dịch vụ"} / {appointment.room?.name || "Phòng"}</span>
                                  <StatusBadge value={appointment.status} />
                                  {locked && <small>Bệnh nhân đã hủy, không thể đổi trạng thái.</small>}
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
                            );
                          })}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title="Chưa có lịch khám trong bảng" text="Khi lễ tân chấp nhận lịch hẹn, lịch sẽ hiển thị tại đây." />
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

function isPatientCancelled(appointment) {
  return appointment.status === "cancelled" && appointment.cancelledByRole === "patient";
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
  return statusActionValues.has(appointment.status) ? appointment.status : "checked_in";
}

function buildSlotKey(slot) {
  return `${slot.startAt}|${slot.room?._id}`;
}
