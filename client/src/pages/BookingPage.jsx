import { CalendarSearch, Clock, Stethoscope } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import { useAuth } from "../redux/AuthContext.jsx";
import { usePublicBootstrap } from "../utils/usePublicBootstrap.js";
import { api, getErrorMessage } from "../utils/api.js";
import { formatMoney, todayInput } from "../utils/format.js";
import { canUsePatientBooking } from "../utils/roles.js";
import { firstError, requireValue, validateDate, validateNote } from "../utils/validation.js";

export const bookingSlotOptions = [
  { value: "08:00", label: "8h-10h" },
  { value: "10:00", label: "10h-11h30" },
  { value: "14:00", label: "14h-16h" },
  { value: "16:00", label: "16h-17h30" }
];

export function toClinicIso(date, time) {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

export default function BookingPage({ embedded = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const minDate = useMemo(() => todayInput(), []);
  const { services, dentists, rooms, loading: bootstrapLoading } = usePublicBootstrap();
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(minDate);
  const [dentistId, setDentistId] = useState("random");
  const [time, setTime] = useState(bookingSlotOptions[0].value);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const dentistOptions = useMemo(() => {
    const roomDentists = rooms.map((room) => room.assignedDentist).filter(Boolean);
    const allDentists = [...roomDentists, ...dentists];
    return Array.from(new Map(allDentists.map((dentist) => [dentist._id, dentist])).values());
  }, [dentists, rooms]);

  useEffect(() => {
    setServiceId((current) => current || services[0]?._id || "");
  }, [services]);

  useEffect(() => {
    setDentistId((current) => current || "random");
  }, [dentistOptions]);

  function validateBookingInputs() {
    return firstError(
      requireValue(serviceId, "Dịch vụ"),
      dentistId === "random" ? "" : requireValue(dentistId, "Bác sĩ"),
      validateDate(date),
      requireValue(time, "Giờ khám"),
      validateNote(note)
    );
  }

  async function book(event) {
    event.preventDefault();

    if (!user) {
      navigate("/login");
      return;
    }

    if (!canUsePatientBooking(user.role)) {
      setError("Chỉ tài khoản bệnh nhân được đặt lịch tại màn hình này.");
      return;
    }

    const validationError = validateBookingInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    const wantsRandomDentist = dentistId === "random";
    const room = wantsRandomDentist ? null : rooms.find((item) => item.assignedDentist?._id === dentistId);
    if (!wantsRandomDentist && !room) {
      setError("Chưa có phòng khám được gán bác sĩ. Vui lòng liên hệ lễ tân.");
      return;
    }

    const selectedSlot = bookingSlotOptions.find((option) => option.value === time);
    if (!window.confirm(`Xác nhận đặt lịch ca ${selectedSlot?.label || time}?`)) return;

    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      await api.post("/appointments", {
        serviceId,
        date,
        startAt: toClinicIso(date, time),
        roomId: room?._id,
        dentistPreference: wantsRandomDentist ? "random" : "selected",
        note
      });
      setMessage("Đã gửi yêu cầu đặt lịch. Lễ tân sẽ tiếp nhận và cập nhật trạng thái cho bạn.");
      setNote("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const selectedService = services.find((service) => service._id === serviceId);

  return (
    <div className={embedded ? "booking-page embedded-booking" : "page-grid booking-page"}>
      <Feedback error={error} message={message} onClear={() => { setError(""); setMessage(""); }} />

      <section className="panel patient-booking-panel">
        <div className="booking-form-heading">
          <CalendarSearch size={24} />
          <div>
            <h2>Đặt lịch khám</h2>
            <p>Miễn phí chụp phim, tư vấn và thăm khám khi khách hàng đặt lịch hẹn trước.</p>
          </div>
        </div>

        <form className="booking-form-modern" onSubmit={book}>
          <label className="field">
            <span>Họ và tên</span>
            <input value={user?.fullName || ""} disabled />
          </label>

          <label className="field">
            <span>Số điện thoại</span>
            <input value={user?.phone || ""} disabled />
          </label>

          <label className="field">
            <span>Dịch vụ quan tâm</span>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={bootstrapLoading} required>
              {services.map((service) => (
                <option value={service._id} key={service._id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Bác sĩ</span>
            <select value={dentistId} onChange={(e) => setDentistId(e.target.value)} disabled={bootstrapLoading} required>
              <option value="random">Bác sĩ ngẫu nhiên</option>
              {dentistOptions.map((dentist) => (
                <option value={dentist._id} key={dentist._id}>
                  {dentist.fullName}{dentist.specialty ? ` - ${dentist.specialty}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Ngày khám</span>
            <input type="date" value={date} min={minDate} onChange={(e) => setDate(e.target.value)} required />
          </label>

          <fieldset className="booking-time-field">
            <legend>Giờ khám</legend>
            <div className="booking-time-options">
              {bookingSlotOptions.map((option) => (
                <label key={option.value}>
                  <input type="radio" name="booking-time" value={option.value} checked={time === option.value} onChange={(e) => setTime(e.target.value)} />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field wide">
            <span>Ghi chú</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Triệu chứng hoặc yêu cầu thêm"
              maxLength={1000}
            />
          </label>

          {selectedService && (
            <div className="booking-summary-strip">
              <span>
                <Stethoscope size={16} />
                {selectedService.name}
              </span>
              <span>
                <Clock size={16} />
                {selectedService.requiresPrepayment ? `Thanh toán khi đến khám: ${formatMoney(selectedService.price)}` : "Chi phí xác định sau khám"}
              </span>
            </div>
          )}

          <button className="button primary booking-submit-final" disabled={submitting || bootstrapLoading}>
            {submitting ? "Đang gửi..." : "Đặt lịch"}
          </button>
        </form>
      </section>
    </div>
  );
}
