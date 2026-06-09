import { CalendarPlus, ClipboardPenLine, DoorOpen, FileText, Stethoscope } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import EmptyState from "../components/EmptyState.jsx";
import Feedback from "../components/Feedback.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAuth } from "../redux/AuthContext.jsx";
import { api, getErrorMessage } from "../utils/api.js";
import { formatDateTime, formatMoney, todayInput } from "../utils/format.js";
import { bookingSlotOptions, toClinicIso } from "./BookingPage.jsx";

function getClinicalFeatures(role) {
  return [
    { id: "schedule", label: "Lịch khám", icon: Stethoscope },
    { id: "treatment", label: role === "dentist" ? "Kế hoạch điều trị" : "Cập nhật điều trị", icon: ClipboardPenLine },
    ...(role === "dentist" ? [{ id: "followUp", label: "Tái khám", icon: CalendarPlus }] : []),
    ...(role === "nurse" ? [{ id: "rooms", label: "Phòng khám", icon: DoorOpen }] : []),
    { id: "records", label: "Lịch sử điều trị", icon: FileText }
  ];
}

const defaultRecordForm = {
  appointmentId: "",
  bloodPressure: "",
  spo2: "",
  temperature: "",
  respiratoryRate: "",
  diagnosis: "",
  treatmentResult: "",
  treatmentNote: "",
  treatmentPlan: "",
  estimatedCost: ""
};

const defaultFollowUpForm = {
  appointmentId: "",
  serviceId: "",
  date: todayInput(),
  time: bookingSlotOptions[0].value,
  roomId: "",
  note: ""
};

export default function ClinicalDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const clinicalFeatures = useMemo(() => getClinicalFeatures(user?.role), [user?.role]);
  const [activeFeature, setActiveFeature] = useState("schedule");
  const [date, setDate] = useState(todayInput());
  const [appointments, setAppointments] = useState([]);
  const [records, setRecords] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [services, setServices] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recordForm, setRecordForm] = useState(defaultRecordForm);
  const [followUpForm, setFollowUpForm] = useState(defaultFollowUpForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/clinical/dashboard", { params: { date } });
      const nextAppointments = res.data.appointments || [];
      const nextRooms = res.data.rooms || [];
      const nextServices = res.data.services || [];

      setAppointments(nextAppointments);
      setRecords(res.data.records || []);
      setRooms(nextRooms);
      setServices(nextServices);
      setRecordForm((current) => ({
        ...current,
        appointmentId: current.appointmentId || nextAppointments[0]?._id || ""
      }));
      setFollowUpForm((current) => {
        const appointment = nextAppointments.find((item) => item._id === current.appointmentId) || nextAppointments[0];
        return {
          ...current,
          appointmentId: current.appointmentId || appointment?._id || "",
          serviceId: current.serviceId || appointment?.service?._id || nextServices[0]?._id || "",
          roomId: current.roomId || appointment?.room?._id || findRoomForDentist(appointment?.dentist?._id, nextRooms)?._id || nextRooms[0]?._id || ""
        };
      });
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
    if (tab && clinicalFeatures.some((item) => item.id === tab)) {
      setActiveFeature(tab);
    } else if (!clinicalFeatures.some((item) => item.id === activeFeature)) {
      setActiveFeature("schedule");
    }
  }, [activeFeature, clinicalFeatures, location.search]);

  const clinicalColumns = useMemo(() => buildClinicalColumns(appointments, rooms), [appointments, rooms]);
  const clinicalRows = useMemo(() => buildClinicalRows(appointments, clinicalColumns), [appointments, clinicalColumns]);
  const selectedAppointment = appointments.find((appointment) => appointment._id === recordForm.appointmentId);
  const selectedFollowUpAppointment = appointments.find((appointment) => appointment._id === followUpForm.appointmentId);
  const displayRecords = history.length ? history : records;

  function updateRecord(field, value) {
    setRecordForm((current) => ({ ...current, [field]: value }));
  }

  function updateFollowUp(field, value) {
    setFollowUpForm((current) => ({ ...current, [field]: value }));
  }

  function openFeature(featureId) {
    setActiveFeature(featureId);
    navigate(`/dashboard?tab=${featureId}`, { replace: true });
  }

  function selectTreatmentAppointment(appointment) {
    setRecordForm((current) => ({ ...current, appointmentId: appointment._id }));
    openFeature("treatment");
  }

  function selectFollowUpAppointment(appointmentId) {
    const appointment = appointments.find((item) => item._id === appointmentId);
    setFollowUpForm((current) => ({
      ...current,
      appointmentId,
      serviceId: appointment?.service?._id || current.serviceId,
      roomId: appointment?.room?._id || findRoomForDentist(appointment?.dentist?._id, rooms)?._id || current.roomId
    }));
  }

  async function submitRecord(event) {
    event.preventDefault();
    if (!recordForm.appointmentId) {
      setError("Chọn lịch khám trước khi lưu điều trị.");
      return;
    }

    try {
      setError("");
      setMessage("");
      const payload = user?.role === "nurse"
        ? {
            vitalSigns: {
              bloodPressure: recordForm.bloodPressure,
              spo2: recordForm.spo2,
              temperature: recordForm.temperature,
              respiratoryRate: recordForm.respiratoryRate
            }
          }
        : {
            diagnosis: recordForm.diagnosis,
            treatmentResult: recordForm.treatmentResult,
            treatmentNote: recordForm.treatmentNote,
            treatmentPlan: recordForm.treatmentPlan,
            estimatedCost: Number(recordForm.estimatedCost || 0)
          };
      await api.put(`/clinical/appointments/${recordForm.appointmentId}/treatment-record`, payload);
      setMessage(user?.role === "nurse" ? "Đã lưu thông tin chung." : "Đã lưu thông tin điều trị.");
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function submitFollowUp(event) {
    event.preventDefault();
    if (!followUpForm.appointmentId || !followUpForm.serviceId || !followUpForm.date || !followUpForm.time || !followUpForm.roomId) {
      setError("Chọn bệnh nhân, dịch vụ, ngày giờ và bác sĩ/phòng trước khi đặt tái khám.");
      return;
    }

    try {
      setError("");
      setMessage("");
      await api.post(`/clinical/appointments/${followUpForm.appointmentId}/follow-up`, {
        serviceId: followUpForm.serviceId,
        date: followUpForm.date,
        startAt: toClinicIso(followUpForm.date, followUpForm.time),
        roomId: followUpForm.roomId,
        note: followUpForm.note
      });
      setMessage("Đã đặt lịch tái khám và gửi thông báo cho bệnh nhân.");
      setFollowUpForm((current) => ({ ...current, note: "" }));
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function viewPatientHistory(patientId) {
    if (!patientId) {
      setError("Không tìm thấy bệnh nhân của lịch khám này.");
      return;
    }

    try {
      setError("");
      setMessage("");
      const res = await api.get(`/clinical/patients/${patientId}/history`);
      setHistory(res.data.records || []);
      openFeature("records");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function setRoomStatus(roomId, status) {
    try {
      setError("");
      setMessage("");
      await api.patch(`/clinical/rooms/${roomId}/status`, { status });
      setMessage("Đã cập nhật trạng thái phòng khám.");
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="page-grid clinical-dashboard">
      <Feedback error={error} message={message} />

      {activeFeature === "schedule" && (
        <section className="panel reception-schedule-panel clinical-schedule-panel">
          <div className="section-title">
            <Stethoscope size={20} />
            <h2>Lịch khám trong ngày</h2>
          </div>
          <div className="clinical-schedule-toolbar">
            <label className="field inline-field">
              <span>Ngày</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <div className="clinical-schedule-summary">
              <strong>{appointments.length}</strong>
              <span>lịch khám</span>
            </div>
          </div>

          {loading ? (
            <EmptyState title="Đang tải lịch khám" text="Hệ thống đang lấy dữ liệu mới nhất." />
          ) : appointments.length ? (
            <div className="reception-schedule-table-wrapper">
              <div className="reception-schedule-grid clinical-schedule-grid" style={{ gridTemplateColumns: `74px repeat(${clinicalColumns.length}, minmax(250px, 1fr))` }}>
                <div className="schedule-head schedule-index-head">STT</div>
                {clinicalColumns.map((column) => (
                  <div className="schedule-head" key={column._id}>
                    <strong>{column.fullName}</strong>
                    <span>{column.specialty || column.roomName || "Bác sĩ phụ trách"}</span>
                  </div>
                ))}
                {clinicalRows.map((row) => (
                  <Fragment key={row.index}>
                    <div className="schedule-time-cell">{row.index}</div>
                    {row.cells.map((appointment, columnIndex) => (
                      <div className="schedule-cell" key={`${row.index}-${clinicalColumns[columnIndex]._id}`}>
                        {appointment ? (
                          <article className={`schedule-cell-card ${isLockedAppointment(appointment) ? "locked" : ""}`}>
                            <div>
                              <strong>{appointment.patient?.fullName || "Bệnh nhân"}</strong>
                              <span>{appointment.service?.name || "Dịch vụ"} / {appointment.room?.name || "Phòng khám"}</span>
                              <small>Đến: {formatDateTime(appointment.arrivalAt || appointment.startAt)}</small>
                            </div>
                            <StatusBadge value={appointment.status} />
                            <div className="row-actions schedule-status-actions">
                              <button className="button small ghost" type="button" onClick={() => viewPatientHistory(appointment.patient?._id)}>
                                Lịch sử
                              </button>
                              {canEditAppointment(user, appointment) && (
                                <button className="button small" type="button" onClick={() => selectTreatmentAppointment(appointment)}>
                                  Điều trị
                                </button>
                              )}
                            </div>
                          </article>
                        ) : (
                          <div className="schedule-empty-cell">Chưa có bệnh nhân</div>
                        )}
                      </div>
                    ))}
                  </Fragment>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title="Chưa có lịch khám" text="Lịch được check-in hoặc xếp trong ngày sẽ hiển thị tại đây." />
          )}
        </section>
      )}

      {activeFeature === "treatment" && (
        <section className="panel clinical-treatment-panel">
          <div className="section-title">
            <ClipboardPenLine size={20} />
            <h2>{user?.role === "dentist" ? "Quản lý kế hoạch điều trị" : "Cập nhật điều trị"}</h2>
          </div>
          <form className="stack" onSubmit={submitRecord}>
            <label className="field">
              <span>Lịch khám</span>
              <select value={recordForm.appointmentId} onChange={(event) => updateRecord("appointmentId", event.target.value)}>
                <option value="">Chọn lịch khám</option>
                {appointments.map((appointment) => (
                  <option key={appointment._id} value={appointment._id}>
                    {appointment.patient?.fullName || "Bệnh nhân"} - {appointment.service?.name || "Dịch vụ"} - {formatDateTime(appointment.startAt)}
                  </option>
                ))}
              </select>
            </label>

            {selectedAppointment && (
              <div className="clinical-selected-card">
                <strong>{selectedAppointment.patient?.fullName}</strong>
                <span>{selectedAppointment.service?.name} / {selectedAppointment.room?.name}</span>
                <StatusBadge value={selectedAppointment.status} />
              </div>
            )}

            {user?.role === "nurse" ? (
              <div className="form-grid">
                <label className="field">
                  <span>Huyết áp</span>
                  <input value={recordForm.bloodPressure} onChange={(event) => updateRecord("bloodPressure", event.target.value)} />
                </label>
                <label className="field">
                  <span>SpO2</span>
                  <input value={recordForm.spo2} onChange={(event) => updateRecord("spo2", event.target.value)} />
                </label>
                <label className="field">
                  <span>Nhiệt độ</span>
                  <input value={recordForm.temperature} onChange={(event) => updateRecord("temperature", event.target.value)} />
                </label>
                <label className="field">
                  <span>Nhịp thở</span>
                  <input value={recordForm.respiratoryRate} onChange={(event) => updateRecord("respiratoryRate", event.target.value)} />
                </label>
              </div>
            ) : (
              <>
                <label className="field">
                  <span>Chẩn đoán</span>
                  <textarea value={recordForm.diagnosis} onChange={(event) => updateRecord("diagnosis", event.target.value)} rows="3" />
                </label>
                <label className="field">
                  <span>Kế hoạch điều trị</span>
                  <textarea value={recordForm.treatmentPlan} onChange={(event) => updateRecord("treatmentPlan", event.target.value)} rows="3" />
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>Chi phí dự kiến</span>
                    <input type="number" min="0" value={recordForm.estimatedCost} onChange={(event) => updateRecord("estimatedCost", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Kết quả điều trị</span>
                    <input value={recordForm.treatmentResult} onChange={(event) => updateRecord("treatmentResult", event.target.value)} />
                  </label>
                </div>
                <label className="field">
                  <span>Ghi chú điều trị</span>
                  <textarea value={recordForm.treatmentNote} onChange={(event) => updateRecord("treatmentNote", event.target.value)} rows="3" />
                </label>
              </>
            )}
            <div className="row-actions clinical-treatment-actions">
              <button className="button primary">{user?.role === "nurse" ? "Lưu thông tin chung" : "Lưu điều trị"}</button>
            </div>
          </form>
        </section>
      )}

      {activeFeature === "followUp" && user?.role === "dentist" && (
        <section className="panel clinical-followup-panel">
          <div className="section-title">
            <CalendarPlus size={20} />
            <h2>Đặt lịch tái khám</h2>
          </div>
          <form className="form-grid" onSubmit={submitFollowUp}>
            <label className="field wide">
              <span>Bệnh nhân</span>
              <select value={followUpForm.appointmentId} onChange={(event) => selectFollowUpAppointment(event.target.value)}>
                <option value="">Chọn bệnh nhân từ lịch khám</option>
                {appointments
                  .filter((appointment) => canEditAppointment(user, appointment))
                  .map((appointment) => (
                    <option key={appointment._id} value={appointment._id}>
                      {appointment.patient?.fullName || "Bệnh nhân"} - {appointment.service?.name || "Dịch vụ"}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Dịch vụ</span>
              <select value={followUpForm.serviceId} onChange={(event) => updateFollowUp("serviceId", event.target.value)}>
                <option value="">Chọn dịch vụ</option>
                {services.map((service) => (
                  <option key={service._id} value={service._id}>
                    {service.name} - {formatMoney(service.price)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Bác sĩ / phòng</span>
              <select value={followUpForm.roomId} onChange={(event) => updateFollowUp("roomId", event.target.value)}>
                <option value="">Chọn bác sĩ</option>
                {rooms.map((room) => (
                  <option key={room._id} value={room._id}>
                    {room.assignedDentist?.fullName || room.name} - {room.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Ngày tái khám</span>
              <input type="date" min={todayInput()} value={followUpForm.date} onChange={(event) => updateFollowUp("date", event.target.value)} />
            </label>
            <label className="field">
              <span>Giờ tái khám</span>
              <select value={followUpForm.time} onChange={(event) => updateFollowUp("time", event.target.value)}>
                {bookingSlotOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field wide">
              <span>Ghi chú</span>
              <textarea value={followUpForm.note} onChange={(event) => updateFollowUp("note", event.target.value)} rows="3" />
            </label>
            {selectedFollowUpAppointment && (
              <div className="clinical-selected-card wide">
                <strong>{selectedFollowUpAppointment.patient?.fullName}</strong>
                <span>Lịch gốc: {formatDateTime(selectedFollowUpAppointment.startAt)} / {selectedFollowUpAppointment.service?.name}</span>
              </div>
            )}
            <button className="button primary">Đặt tái khám</button>
          </form>
        </section>
      )}

      {activeFeature === "records" && (
        <section className="panel">
          <div className="section-title">
            <FileText size={20} />
            <h2>Lịch sử điều trị</h2>
          </div>
          {loading ? (
            <EmptyState title="Đang tải lịch sử" text="Hệ thống đang lấy dữ liệu mới nhất." />
          ) : displayRecords.length ? (
            <div className="mini-list">
              {displayRecords.map((record) => (
                <div className="record-card" key={record._id}>
                  <strong>{record.patient?.fullName}</strong>
                  <p>{record.diagnosis || "Chưa có chẩn đoán"}</p>
                  <span className="mini">{record.treatmentPlan || "Chưa có kế hoạch điều trị"}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có lịch sử" text="Hồ sơ điều trị của bệnh nhân sẽ hiển thị tại đây." />
          )}
        </section>
      )}

      {activeFeature === "rooms" && user?.role === "nurse" && (
        <section className="panel">
          <div className="section-title">
            <DoorOpen size={20} />
            <h2>Cập nhật trạng thái phòng</h2>
          </div>
          <div className="room-grid">
            {loading ? (
              <EmptyState title="Đang tải phòng khám" text="Hệ thống đang lấy dữ liệu mới nhất." />
            ) : rooms.length ? (
              rooms.map((room) => (
                <article className="room-card" key={room._id}>
                  <h4>{room.name}</h4>
                  <span className="mini">{room.assignedDentist?.fullName || "Chưa gán bác sĩ"}</span>
                  <StatusBadge value={room.status} />
                  <div className="row-actions">
                    <button className="button small" onClick={() => setRoomStatus(room._id, "cleaning")}>
                      Vệ sinh
                    </button>
                    <button className="button small" onClick={() => setRoomStatus(room._id, "available")}>
                      Sẵn sàng
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function buildClinicalColumns(appointments, rooms) {
  const columns = new Map();
  rooms.forEach((room) => {
    if (room.assignedDentist?._id && !columns.has(room.assignedDentist._id)) {
      columns.set(room.assignedDentist._id, {
        _id: room.assignedDentist._id,
        fullName: room.assignedDentist.fullName,
        specialty: room.assignedDentist.specialty,
        roomName: room.name
      });
    }
  });
  appointments.forEach((appointment) => {
    if (appointment.dentist?._id && !columns.has(appointment.dentist._id)) {
      columns.set(appointment.dentist._id, {
        _id: appointment.dentist._id,
        fullName: appointment.dentist.fullName,
        specialty: appointment.dentist.specialty,
        roomName: appointment.room?.name
      });
    }
  });

  const result = Array.from(columns.values()).slice(0, 3);
  while (result.length < 3) {
    result.push({ _id: `empty-${result.length + 1}`, fullName: `Bác sĩ ${result.length + 1}`, specialty: "Chưa có lịch" });
  }
  return result;
}

function buildClinicalRows(appointments, columns) {
  const grouped = new Map(columns.map((column) => [column._id, []]));
  appointments
    .slice()
    .sort((first, second) => queueSortValue(first) - queueSortValue(second))
    .forEach((appointment) => {
      const dentistId = appointment.dentist?._id;
      if (grouped.has(dentistId)) {
        grouped.get(dentistId).push(appointment);
      }
    });

  const rowCount = Math.max(1, ...columns.map((column) => grouped.get(column._id)?.length || 0));
  return Array.from({ length: rowCount }, (_, index) => ({
    index: index + 1,
    cells: columns.map((column) => grouped.get(column._id)?.[index] || null)
  }));
}

function queueSortValue(appointment) {
  return new Date(appointment.checkedInAt || appointment.checkInTime || appointment.startAt || 0).getTime();
}

function findRoomForDentist(dentistId, rooms) {
  if (!dentistId) return null;
  return rooms.find((room) => room.assignedDentist?._id === dentistId || room.assignedDentist === dentistId);
}

function canEditAppointment(user, appointment) {
  return user?.role === "admin" || user?.role === "nurse" || appointment.dentist?._id === user?._id;
}

function isLockedAppointment(appointment) {
  return ["cancelled", "no_show", "rejected"].includes(appointment.status);
}
