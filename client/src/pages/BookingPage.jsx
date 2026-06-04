import { CalendarSearch, Clock, DoorOpen, Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EmptyState from "../components/EmptyState.jsx";
import Feedback from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api, getErrorMessage } from "../services/api.js";
import { formatMoney, formatTime, todayInput } from "../utils/format.js";
import { canUsePatientBooking } from "../utils/roles.js";
import { firstError, requireValue, validateDate, validateNote } from "../utils/validation.js";

const shiftOptions = [
  { value: "all", label: "Tất cả ca" },
  { value: "Ca sáng", label: "Ca sáng" },
  { value: "Ca chiều", label: "Ca chiều" }
];

export default function BookingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const minDate = useMemo(() => todayInput(), []);
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(minDate);
  const [shift, setShift] = useState("all");
  const [dentistId, setDentistId] = useState("");
  const [slots, setSlots] = useState([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/services")
      .then((res) => {
        setServices(res.data.services);
        setServiceId((current) => current || res.data.services[0]?._id || "");
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  useEffect(() => {
    if (serviceId) {
      searchSlots();
    }
  }, [serviceId, date]);

  function validateBookingInputs() {
    return firstError(requireValue(serviceId, "Dịch vụ"), validateDate(date), validateNote(note));
  }

  async function searchSlots({ preserveFeedback = false } = {}) {
    const validationError = firstError(requireValue(serviceId, "Dịch vụ"), validateDate(date));
    if (validationError) {
      setSlots([]);
      setError(validationError);
      return;
    }

    if (!preserveFeedback) {
      setError("");
      setMessage("");
    }
    setLoading(true);

    try {
      const res = await api.get("/availability", { params: { serviceId, date, includeBooked: true } });
      const nextSlots = res.data.slots || [];
      setSlots(nextSlots);
      setDentistId((current) => (
        nextSlots.some((slot) => slot.dentist?._id === current) ? current : ""
      ));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function book(slot) {
    if (!user) {
      navigate("/login");
      return;
    }

    if (!canUsePatientBooking(user.role)) {
      setError("Chỉ tài khoản bệnh nhân được đặt lịch tại màn này.");
      return;
    }

    const validationError = validateBookingInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!window.confirm(`Xác nhận đặt lịch lúc ${formatTime(slot.startAt)}?`)) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.post("/appointments", {
        serviceId,
        date,
        startAt: slot.startAt,
        roomId: slot.room._id,
        note
      });
      setMessage("Đã gửi yêu cầu đặt lịch. Nếu giờ này đã có người chọn, lễ tân sẽ liên hệ để xác nhận lại.");
      await searchSlots({ preserveFeedback: true });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const selectedService = services.find((service) => service._id === serviceId);
  const dentists = Array.from(
    new Map(slots.map((slot) => [slot.dentist?._id, slot.dentist]).filter(([id]) => id)).values()
  );
  const filteredSlots = slots.filter((slot) => {
    if (!dentistId) return false;
    const matchesShift = shift === "all" || slot.session === shift;
    const matchesDentist = slot.dentist?._id === dentistId;
    return matchesShift && matchesDentist;
  });

  return (
    <div className="page-grid">
      <Feedback error={error} message={message} onClear={() => { setError(""); setMessage(""); }} />
      <section className="panel">
        <div className="section-title">
          <CalendarSearch size={20} />
          <h2>Đặt lịch khám</h2>
        </div>

        <div className="form-grid booking-controls">
          <label className="field">
            <span>Dịch vụ</span>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
              {services.map((service) => (
                <option value={service._id} key={service._id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Ngày khám</span>
            <input type="date" value={date} min={minDate} onChange={(e) => setDate(e.target.value)} required />
          </label>

          <label className="field">
            <span>Ca</span>
            <select value={shift} onChange={(e) => setShift(e.target.value)}>
              {shiftOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Bác sĩ</span>
            <select value={dentistId} onChange={(e) => setDentistId(e.target.value)}>
              <option value="">Chọn bác sĩ</option>
              {dentists.map((dentist) => (
                <option value={dentist._id} key={dentist._id}>
                  {dentist.fullName}
                </option>
              ))}
            </select>
          </label>

          <label className="field wide">
            <span>Ghi chú</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Triệu chứng hoặc yêu cầu thêm"
              maxLength={1000}
            />
          </label>
        </div>

        {selectedService && (
          <div className="rule-strip">
            <span>
              <Clock size={16} /> Mỗi lịch khám cố định 30 phút
            </span>
            <span>{selectedService.requiresPrepayment ? `Thanh toán khi đến khám: ${formatMoney(selectedService.price)}` : "Chi phí xác định sau khám"}</span>
            <span>
              <Filter size={16} /> Có thể lọc lịch trống theo ngày, ca và bác sĩ.
            </span>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-title">
          <DoorOpen size={20} />
          <h3>Lịch trống theo bác sĩ</h3>
        </div>

        {loading ? (
          <div className="empty-state">Đang tải lịch trống...</div>
        ) : !dentistId ? (
          <EmptyState title="Chọn bác sĩ để xem slot" text="Sau khi chọn bác sĩ, hệ thống chỉ hiển thị các giờ trống của bác sĩ đó." />
        ) : filteredSlots.length ? (
          <div className="slot-grid">
            {filteredSlots.map((slot) => (
              <article className="slot-card simple-slot-card" key={`${slot.room._id}-${slot.startAt}`}>
                <div className="slot-time simple-slot-time">
                  <strong>{formatTime(slot.startAt)}</strong>
                </div>
                <button className="button primary" onClick={() => book(slot)}>
                  Đặt lịch
                </button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Không còn lịch phù hợp" text="Thử đổi ca, ngày hoặc bác sĩ để xem lịch trống khác." />
        )}
      </section>
    </div>
  );
}
