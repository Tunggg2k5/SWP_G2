import {
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock,
  Globe2,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api, getErrorMessage } from "../lib/api.js";
import { formatMoney, todayInput } from "../lib/format.js";
import { firstError, requireValue, validateDate, validateName, validateNote, validatePhone } from "../lib/validation.js";

const clinicBranches = {
  "TP. Hồ Chí Minh": [
    "DAS Quận 1 - 150 Hai Bà Trưng",
    "DAS Quận 3 - 345 Lê Văn Sỹ",
    "DAS Quận 7 - 493 Nguyễn Thị Thập"
  ],
  "Hà Nội": ["DAS Đống Đa - 224 Xã Đàn"],
  "Đồng Nai": ["DAS Biên Hòa - 264A Phạm Văn Thuận"],
  "Bình Dương": ["DAS Thủ Dầu Một - 01 Nguyễn Văn Tiết"],
  "Cần Thơ": ["DAS Ninh Kiều - 202 Đường 3/2"]
};

const provinceOptions = Object.keys(clinicBranches);
const defaultProvince = provinceOptions[0];
const defaultBranch = clinicBranches[defaultProvince][0];
const needOptions = ["Niềng răng", "Tư vấn Implant", "Bọc răng sứ", "Khác"];

export default function PublicHome() {
  const { user } = useAuth();
  const minDate = useMemo(() => todayInput(), []);
  const [services, setServices] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [captchaChecked, setCaptchaChecked] = useState(false);
  const [form, setForm] = useState({
    salutation: "Anh",
    needType: "Khác",
    fullName: "",
    phone: "",
    province: defaultProvince,
    branch: defaultBranch,
    serviceId: "",
    preferredDate: "",
    preferredTime: "",
    note: ""
  });

  useEffect(() => {
    api
      .get("/services")
      .then((res) => setServices(res.data.services))
      .catch(() => setServices([]));
  }, []);

  function updateForm(field, value) {
    setForm((current) => {
      if (field === "province") {
        return {
          ...current,
          province: value,
          branch: clinicBranches[value]?.[0] || ""
        };
      }

      return { ...current, [field]: value };
    });
  }

  async function submitAppointmentRequest(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const validationError = firstError(
      validateName(form.fullName),
      validatePhone(form.phone),
      validateNote(form.note),
      form.preferredDate ? validateDate(form.preferredDate) : "",
      requireValue(form.province, "Tỉnh thành"),
      requireValue(form.branch, "Chi nhánh"),
      captchaChecked ? "" : "Vui lòng xác nhận bạn không phải là người máy."
    );

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await api.post("/consultations", {
        fullName: form.fullName,
        phone: form.phone,
        service: form.serviceId || undefined,
        preferredDate: form.preferredDate || undefined,
        preferredTime: form.preferredTime || undefined,
        message: [
          `Danh xưng: ${form.salutation}`,
          `Nhu cầu: ${form.needType}`,
          `Tỉnh thành: ${form.province}`,
          `Chi nhánh: ${form.branch}`,
          form.note ? `Ghi chú: ${form.note}` : "Khách muốn đặt lịch hẹn nhanh."
        ].join(". ")
      });
      setForm({
        salutation: "Anh",
        needType: "Khác",
        fullName: "",
        phone: "",
        province: defaultProvince,
        branch: defaultBranch,
        serviceId: "",
        preferredDate: "",
        preferredTime: "",
        note: ""
      });
      setCaptchaChecked(false);
      setMessage("Đã nhận yêu cầu đặt lịch. Lễ tân sẽ liên hệ trong khoảng 3 phút.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="guest-page">
      <Feedback error={error} message={message} onClear={() => { setError(""); setMessage(""); }} />

      <header className="guest-header">
        <div className="guest-header-inner">
          <Link className="guest-brand" to="/">
            <span className="guest-brand-mark">
              <span>DAS</span>
            </span>
            <span className="guest-brand-name">NHA KHOA DAS</span>
          </Link>

          <nav className="guest-nav" aria-label="Điều hướng khách">
            <a href="#intro">Giới thiệu <ChevronDown size={14} /></a>
            <a href="#services">Dịch vụ <ChevronDown size={14} /></a>
            <a href="#pricing">Bảng giá</a>
            <a href="#news">Tin tức <ChevronDown size={14} /></a>
          </nav>

          <div className="guest-actions">
            <a className="guest-action danger" href="#appointment">
              <CalendarDays size={17} />
              ĐẶT HẸN
            </a>
            <a className="guest-action phone" href="tel:19006899">
              <Phone size={18} />
              1900 6899
            </a>
            <button className="guest-action lang" type="button">
              <Globe2 size={17} />
              EN
            </button>
            {user ? (
              <Link className="guest-login" to="/dashboard">Dashboard</Link>
            ) : (
              <Link className="guest-login" to="/login">Đăng nhập</Link>
            )}
          </div>
        </div>
      </header>

      <main className="guest-main" id="appointment">
        <section className="guest-hero">
          <div className="guest-hero-inner">
            <div className="guest-title">
              <span className="guest-kicker">Hệ thống đặt lịch phòng khám nha khoa</span>
              <h1>ĐẶT LỊCH HẸN</h1>
              <p>
                <span>Vui lòng để lại thông tin, nhu cầu và chi nhánh mong muốn.</span>
                <span>Nha Khoa DAS sẽ liên hệ trong vòng <strong>3 phút</strong></span>
                <em>(Tổng đài hỗ trợ từ <strong>7h30-23h30</strong> mỗi ngày)</em>
              </p>
              <div className="guest-proof-row" aria-label="Thông tin vận hành">
                <span><Building2 size={17} /> 5 phòng khám</span>
                <span><Clock size={17} /> 07:00-17:30</span>
                <span><ShieldCheck size={17} /> Hồ sơ bảo mật</span>
              </div>
            </div>

            <form className="guest-appointment-form" onSubmit={submitAppointmentRequest}>
              <div className="guest-radio-row" role="radiogroup" aria-label="Danh xưng">
                <label>
                  <input
                    type="radio"
                    name="salutation"
                    value="Anh"
                    checked={form.salutation === "Anh"}
                    onChange={(event) => updateForm("salutation", event.target.value)}
                  />
                  Anh
                </label>
                <label>
                  <input
                    type="radio"
                    name="salutation"
                    value="Chị"
                    checked={form.salutation === "Chị"}
                    onChange={(event) => updateForm("salutation", event.target.value)}
                  />
                  Chị
                </label>
              </div>

              <div className="guest-need-row" role="radiogroup" aria-label="Nhu cầu nha khoa">
                {needOptions.map((need) => (
                  <label key={need}>
                    <input
                      type="radio"
                      name="needType"
                      value={need}
                      checked={form.needType === need}
                      onChange={(event) => updateForm("needType", event.target.value)}
                    />
                    {need}
                  </label>
                ))}
              </div>

              <div className="guest-form-grid">
                <input
                  value={form.fullName}
                  onChange={(event) => updateForm("fullName", event.target.value)}
                  placeholder="Họ tên..."
                  required
                  maxLength={120}
                />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateForm("phone", event.target.value)}
                  placeholder="Số điện thoại..."
                  required
                  maxLength={13}
                />
                <select value={form.serviceId} onChange={(event) => updateForm("serviceId", event.target.value)}>
                  <option value="">Dịch vụ quan tâm...</option>
                  {services.map((service) => (
                    <option value={service._id} key={service._id}>
                      {service.name}
                    </option>
                  ))}
                </select>
                <select value={form.province} onChange={(event) => updateForm("province", event.target.value)} required>
                  {provinceOptions.map((province) => (
                    <option value={province} key={province}>
                      {province}
                    </option>
                  ))}
                </select>
                <select className="wide" value={form.branch} onChange={(event) => updateForm("branch", event.target.value)} required>
                  {(clinicBranches[form.province] || []).map((branch) => (
                    <option value={branch} key={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={form.preferredDate}
                  min={minDate}
                  onChange={(event) => updateForm("preferredDate", event.target.value)}
                  aria-label="Ngày mong muốn"
                />
                <input
                  type="time"
                  value={form.preferredTime}
                  onChange={(event) => updateForm("preferredTime", event.target.value)}
                  aria-label="Giờ mong muốn"
                />
                <textarea
                  value={form.note}
                  onChange={(event) => updateForm("note", event.target.value)}
                  placeholder="Ghi chú (nếu có)..."
                  rows="2"
                  maxLength={1000}
                />
              </div>

              <div className="guest-form-footer">
                <label className="guest-captcha">
                  <input
                    type="checkbox"
                    checked={captchaChecked}
                    onChange={(event) => setCaptchaChecked(event.target.checked)}
                  />
                  <span>Tôi không phải là người máy</span>
                  <ShieldCheck size={32} />
                  <small>reCAPTCHA</small>
                </label>

                <button className="guest-submit" type="submit">
                  <CalendarDays size={17} />
                  ĐẶT LỊCH HẸN
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="guest-service-strip" id="services">
          {services.slice(0, 4).map((service) => (
            <article key={service._id}>
              <strong>{service.name}</strong>
              <span>{service.requiresPrepayment ? formatMoney(service.price) : "Tư vấn sau khám"}</span>
            </article>
          ))}
        </section>

        <section className="guest-branch-section" id="intro">
          <div>
            <span className="guest-kicker">Nha khoa tiêu chuẩn chất lượng</span>
            <h2>Hệ thống chi nhánh DAS</h2>
          </div>
          <div className="guest-branch-grid">
            {provinceOptions.slice(0, 4).map((province) => (
              <article key={province}>
                <MapPin size={18} />
                <strong>{province}</strong>
                <span>{clinicBranches[province][0]}</span>
              </article>
            ))}
          </div>
        </section>
      </main>

      <button className="guest-bell" type="button" aria-label="Thông báo">
        <Bell size={27} />
        <span>6</span>
      </button>
      <button className="guest-chat" type="button" aria-label="Chat tư vấn">
        <MessageCircle size={33} />
      </button>
      <nav className="guest-bottom-actions" aria-label="Liên hệ nhanh">
        <a href="tel:19006899"><Phone size={18} /> Gọi ngay</a>
        <a href="#appointment"><CalendarDays size={18} /> Đặt hẹn</a>
        <a href="#appointment"><MessageCircle size={18} /> Chat ngay</a>
        <a href="#intro"><MapPin size={18} /> Chi nhánh</a>
      </nav>
    </div>
  );
}
