import { CheckCheck, ClipboardPenLine, DoorOpen, FileText, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../components/EmptyState.jsx";
import Feedback from "../components/Feedback.jsx";
import FeatureTabs from "../components/FeatureTabs.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api, getErrorMessage } from "../services/api.js";
import { formatDateTime, todayInput } from "../utils/format.js";

export default function ClinicalDashboard() {
  const { user } = useAuth();
  const clinicalFeatures = [
    { id: "schedule", label: "Lịch làm việc", icon: Stethoscope },
    ...(user.role === "nurse" ? [{ id: "treatment", label: "Cập nhật điều trị", icon: ClipboardPenLine }] : []),
    { id: "records", label: user.role === "dentist" ? "Lịch sử điều trị" : "Hồ sơ gần đây", icon: FileText },
    ...(user.role === "nurse" ? [{ id: "rooms", label: "Trạng thái phòng", icon: DoorOpen }] : [])
  ];
  const [activeFeature, setActiveFeature] = useState("schedule");
  const [date, setDate] = useState(todayInput());
  const [appointments, setAppointments] = useState([]);
  const [records, setRecords] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recordForm, setRecordForm] = useState({
    appointmentId: "",
    bloodPressure: "",
    spo2: "",
    temperature: "",
    respiratoryRate: "",
    diagnosis: "",
    treatmentResult: "",
    treatmentNote: "",
    treatmentPlan: "",
    prescription: ""
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/clinical/dashboard", { params: { date } });
      setAppointments(res.data.appointments);
      setRecords(res.data.records);
      setRooms(res.data.rooms);
      setRecordForm((current) => ({
        ...current,
        appointmentId: current.appointmentId || res.data.appointments[0]?._id || ""
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

  function updateRecord(field, value) {
    setRecordForm((current) => ({ ...current, [field]: value }));
  }

  async function submitRecord(event) {
    event.preventDefault();
    if (!recordForm.appointmentId) return;

    try {
      await api.put(`/clinical/appointments/${recordForm.appointmentId}/treatment-record`, {
        vitalSigns: {
          bloodPressure: recordForm.bloodPressure,
          spo2: recordForm.spo2,
          temperature: recordForm.temperature,
          respiratoryRate: recordForm.respiratoryRate
        },
        diagnosis: recordForm.diagnosis,
        treatmentResult: recordForm.treatmentResult,
        treatmentNote: recordForm.treatmentNote,
        treatmentPlan: recordForm.treatmentPlan,
        prescription: recordForm.prescription
      });
      setMessage("Đã cập nhật hồ sơ điều trị.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function completeAppointment() {
    if (!recordForm.appointmentId) {
      setError("Chọn lịch hẹn trước khi hoàn tất điều trị.");
      return;
    }

    if (!window.confirm("Xác nhận hoàn tất lịch điều trị này?")) return;

    try {
      await api.patch(`/appointments/${recordForm.appointmentId}/status`, {
        status: "completed",
        note: "Y tá hoàn tất quy trình điều trị."
      });
      setMessage("Đã hoàn tất lịch điều trị. Bệnh nhân có thể gửi đánh giá.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function viewPatientHistory(patientId) {
    if (!patientId) {
      setError("Không tìm thấy bệnh nhân của lịch hẹn này.");
      return;
    }

    try {
      const res = await api.get(`/clinical/patients/${patientId}/history`);
      setHistory(res.data.records);
      setActiveFeature("records");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function setRoomStatus(roomId, status) {
    try {
      await api.patch(`/clinical/rooms/${roomId}/status`, { status });
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const selectedAppointment = appointments.find((appointment) => appointment._id === recordForm.appointmentId);

  return (
    <div className="page-grid">
      <Feedback error={error} message={message} />
      <FeatureTabs items={clinicalFeatures} active={activeFeature} onChange={setActiveFeature} />

      {activeFeature === "schedule" && (
        <section className="panel">
          <div className="section-title">
            <Stethoscope size={20} />
            <h2>Lịch làm việc nhân sự lâm sàng</h2>
          </div>
          <label className="field inline-field">
            <span>Ngày</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          {loading ? (
            <EmptyState title="Đang tải lịch làm việc" text="Hệ thống đang lấy dữ liệu mới nhất." />
          ) : appointments.length ? (
            <div className="appointment-list">
              {appointments.map((appointment) => (
                <article className="appointment-card" key={appointment._id}>
                  <div>
                    <h4>{appointment.patient?.fullName}</h4>
                    <p>
                      {appointment.service?.name} - {formatDateTime(appointment.startAt)}
                    </p>
                    <span className="mini">
                      {appointment.room?.name} / {appointment.patient?.phone}
                    </span>
                  </div>
                  <StatusBadge value={appointment.status} />
                  {user.role === "dentist" && (
                    <button className="button small" onClick={() => viewPatientHistory(appointment.patient?._id)}>
                      Xem lịch sử điều trị
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
      )}

      {activeFeature === "treatment" && user.role === "nurse" && (
        <section className="panel">
          <div className="section-title">
            <ClipboardPenLine size={20} />
            <h2>Cập nhật điều trị</h2>
          </div>
          <form className="stack" onSubmit={submitRecord}>
            <label className="field">
              <span>Lịch hẹn</span>
              <select value={recordForm.appointmentId} onChange={(e) => updateRecord("appointmentId", e.target.value)}>
                {appointments.map((appointment) => (
                  <option key={appointment._id} value={appointment._id}>
                    {appointment.patient?.fullName} - {appointment.service?.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Huyết áp</span>
                <input value={recordForm.bloodPressure} onChange={(e) => updateRecord("bloodPressure", e.target.value)} />
              </label>
              <label className="field">
                <span>SpO2</span>
                <input value={recordForm.spo2} onChange={(e) => updateRecord("spo2", e.target.value)} />
              </label>
              <label className="field">
                <span>Nhiệt độ</span>
                <input value={recordForm.temperature} onChange={(e) => updateRecord("temperature", e.target.value)} />
              </label>
              <label className="field">
                <span>Nhịp thở</span>
                <input value={recordForm.respiratoryRate} onChange={(e) => updateRecord("respiratoryRate", e.target.value)} />
              </label>
            </div>
            <label className="field">
              <span>Chẩn đoán</span>
              <textarea value={recordForm.diagnosis} onChange={(e) => updateRecord("diagnosis", e.target.value)} rows="3" />
            </label>
            <label className="field">
              <span>Kết quả điều trị</span>
              <textarea value={recordForm.treatmentResult} onChange={(e) => updateRecord("treatmentResult", e.target.value)} rows="3" />
            </label>
            <label className="field">
              <span>Ghi chú điều trị</span>
              <textarea value={recordForm.treatmentNote} onChange={(e) => updateRecord("treatmentNote", e.target.value)} rows="3" />
            </label>
            <label className="field">
              <span>Kế hoạch điều trị</span>
              <textarea value={recordForm.treatmentPlan} onChange={(e) => updateRecord("treatmentPlan", e.target.value)} rows="3" />
            </label>
            <label className="field">
              <span>Đơn thuốc</span>
              <textarea value={recordForm.prescription} onChange={(e) => updateRecord("prescription", e.target.value)} rows="3" />
            </label>
            <div className="row-actions clinical-treatment-actions">
              <button className="button primary">Lưu hồ sơ</button>
              <button
                type="button"
                className="button secondary"
                disabled={!recordForm.appointmentId || selectedAppointment?.status === "completed"}
                onClick={completeAppointment}
              >
                <CheckCheck size={17} />
                Hoàn tất
              </button>
            </div>
          </form>
        </section>
      )}

      {activeFeature === "records" && (
        <section className="panel">
          <div className="section-title">
            <FileText size={20} />
            <h2>Hồ sơ gần đây</h2>
          </div>
          {loading ? (
            <EmptyState title="Đang tải hồ sơ" text="Hệ thống đang lấy dữ liệu mới nhất." />
          ) : (history.length ? history : records).length ? (
            <div className="mini-list">
              {(history.length ? history : records).map((record) => (
                <div className="record-card" key={record._id}>
                  <strong>{record.patient?.fullName}</strong>
                  <p>{record.diagnosis || "Chưa có chẩn đoán"}</p>
                  <span className="mini">{record.prescription || "Chưa có đơn thuốc"}</span>
                  <span className="mini">{record.treatmentPlan || "Chưa có kế hoạch điều trị"}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
      )}

      {activeFeature === "rooms" && user.role === "nurse" && (
        <section className="panel">
          <div className="section-title">
            <DoorOpen size={20} />
            <h2>Cập nhật trạng thái phòng</h2>
          </div>
          <div className="room-grid">
            {loading ? (
              <EmptyState title="Đang tải phòng khám" text="Hệ thống đang lấy dữ liệu mới nhất." />
            ) : rooms.map((room) => (
              <article className="room-card" key={room._id}>
                <h4>{room.name}</h4>
                <StatusBadge value={room.status} />
                {user.role === "nurse" && (
                  <div className="row-actions">
                    <button className="button small" onClick={() => setRoomStatus(room._id, "cleaning")}>
                      Vệ sinh
                    </button>
                    <button className="button small" onClick={() => setRoomStatus(room._id, "available")}>
                      Sẵn sàng
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
