import { CalendarSearch, Clock, DoorOpen, ListPlus, UserRoundCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EmptyState from "../components/EmptyState.jsx";
import Feedback from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api, getErrorMessage } from "../services/api.js";
import { formatMoney, formatTime, todayInput } from "../utils/format.js";
import { canUsePatientBooking } from "../utils/roles.js";
import { firstError, requireValue, validateDate, validateNote } from "../utils/validation.js";

export default function BookingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const minDate = useMemo(() => todayInput(), []);
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(minDate);
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
      const res = await api.get("/availability", { params: { serviceId, date } });
      setSlots(res.data.slots);
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
      setMessage("Đặt lịch thành công. Lịch hẹn đã xuất hiện trong bảng điều khiển.");
      await searchSlots({ preserveFeedback: true });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function joinWaitlist() {
    if (!user) {
      navigate("/login");
      return;
    }

    if (!canUsePatientBooking(user.role)) {
      setError("Chỉ tài khoản bệnh nhân được tham gia danh sách chờ tại màn này.");
      return;
    }

    const validationError = validateBookingInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await api.post("/waitlist", {
        serviceId,
        preferredDate: date,
        note
      });
      setMessage("Đã tham gia danh sách chờ. Lễ tân sẽ liên hệ khi có lịch trống.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const selectedService = services.find((service) => service._id === serviceId);

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
              <Clock size={16} /> {selectedService.durationMinutes} phút + 10 phút chuyển giao
            </span>
            <span>{selectedService.requiresPrepayment ? `Thanh toán khi đến khám: ${formatMoney(selectedService.price)}` : "Chi phí xác định sau khám"}</span>
            <span>Giờ đến: trước 08:00 đến 07:00; từ 08:00 đến trước 1 giờ; ca chiều trước 14:30 đến 13:30.</span>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-title">
          <DoorOpen size={20} />
          <h3>Lịch trống theo phòng</h3>
        </div>

        {loading ? (
          <div className="empty-state">Đang tải lịch trống...</div>
        ) : slots.length ? (
          <div className="slot-grid">
            {slots.map((slot) => (
              <article className="slot-card" key={`${slot.room._id}-${slot.startAt}`}>
                <div className="slot-time">
                  <strong>{formatTime(slot.startAt)}</strong>
                  <span>{slot.session}</span>
                </div>
                <div>
                  <h4>{slot.room.name}</h4>
                  <p>{slot.service.name}</p>
                </div>
                <div className="dentist-detail">
                  <UserRoundCheck size={17} />
                  <span>{slot.dentist.fullName}</span>
                  <small>{slot.dentist.specialty}</small>
                </div>
                <p className="mini">Giờ đến: {formatTime(slot.arrivalAt)}</p>
                <button className="button primary" onClick={() => book(slot)}>
                  Đặt lịch
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="waitlist-box">
            <EmptyState title="Không còn lịch phù hợp" text="Bạn có thể tham gia danh sách chờ cho ngày đã chọn." />
            <button className="button secondary" onClick={joinWaitlist}>
              <ListPlus size={18} />
              Tham gia danh sách chờ
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
