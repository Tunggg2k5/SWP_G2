import {
  Activity,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  DoorOpen,
  FileText,
  LogIn,
  Phone,
  ReceiptText,
  Search,
  ShieldCheck,
  Stethoscope,
  UserCog,
  UserPlus,
  UsersRound
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { usePublicBootstrap } from "../hooks/usePublicBootstrap.js";
import { api, getErrorMessage } from "../services/api.js";
import { formatMoney, todayInput } from "../utils/format.js";
import { actorUseCaseCoverage, erdCoverage, systemHighlights } from "../utils/useCaseCoverage.js";
import { firstError, requireValue, validateDate, validateName, validateNote, validatePhone } from "../utils/validation.js";

const branchMap = {
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

const provinceOptions = Object.keys(branchMap);
const needOptions = ["Tư vấn bác sĩ", "Trám răng", "Nhổ răng khôn", "Lấy cao răng", "Tẩy trắng răng"];

const actorIcons = {
  Guest: Search,
  User: UserCog,
  Patient: UsersRound,
  Receptionist: ClipboardList,
  "Clinical Staff": Stethoscope,
  Dentist: Activity,
  Nurse: ShieldCheck,
  Admin: UserCog
};

const moduleIcons = [Building2, CalendarDays, DoorOpen, ReceiptText, Bell, FileText];

export default function PublicHome() {
  const { user } = useAuth();
  const { services, dentists, rooms } = usePublicBootstrap();
  const minDate = useMemo(() => todayInput(), []);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    salutation: "Anh",
    needType: "Tư vấn bác sĩ",
    fullName: "",
    phone: "",
    province: provinceOptions[0],
    branch: branchMap[provinceOptions[0]][0],
    serviceId: "",
    preferredDate: "",
    preferredTime: "",
    note: ""
  });

  function updateForm(field, value) {
    setForm((current) => {
      if (field === "province") {
        return {
          ...current,
          province: value,
          branch: branchMap[value]?.[0] || ""
        };
      }

      return { ...current, [field]: value };
    });
  }

  async function submitConsultation(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const validationError = firstError(
      validateName(form.fullName),
      validatePhone(form.phone),
      validateNote(form.note),
      form.preferredDate ? validateDate(form.preferredDate) : "",
      requireValue(form.province, "Tỉnh thành"),
      requireValue(form.branch, "Chi nhánh")
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
          form.note ? `Ghi chú: ${form.note}` : "Khách muốn đặt lịch tư vấn."
        ].join(". ")
      });

      setForm({
        salutation: "Anh",
        needType: "Tư vấn bác sĩ",
        fullName: "",
        phone: "",
        province: provinceOptions[0],
        branch: branchMap[provinceOptions[0]][0],
        serviceId: "",
        preferredDate: "",
        preferredTime: "",
        note: ""
      });
      setMessage("Đã ghi nhận yêu cầu tư vấn. Lễ tân sẽ liên hệ để xác nhận lịch.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="clinic-portal">
      <Feedback error={error} message={message} onClear={() => { setError(""); setMessage(""); }} />

      <header className="portal-nav">
        <Link className="portal-brand" to="/">
          <span className="portal-brand-mark">DAS</span>
          <span>Nha khoa DAS</span>
        </Link>

        <nav className="portal-nav-links" aria-label="Điều hướng public">
          <a href="#booking">Đặt lịch</a>
          <a href="#actors">Actors</a>
          <a href="#services">Dịch vụ</a>
          <a href="#erd">ERD</a>
        </nav>

        <div className="portal-actions">
          <a className="button ghost" href="tel:19006899">
            <Phone size={17} />
            1900 6899
          </a>
          {user ? (
            <Link className="button primary" to="/dashboard">
              Dashboard
            </Link>
          ) : (
            <>
              <Link className="button ghost" to="/login">
                <LogIn size={17} />
                Đăng nhập
              </Link>
              <Link className="button primary" to="/register">
                <UserPlus size={17} />
                Tạo tài khoản
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="portal-main">
        <section className="portal-hero-band" id="booking">
          <div className="portal-copy">
            <p className="eyebrow">Dental Appointment System</p>
            <h1>Quản lý đặt lịch phòng khám nha khoa</h1>
            <p>
              Hệ thống DAS hỗ trợ đặt lịch online, đặt lịch offline qua lễ tân, waitlist, điều trị, thanh toán, đánh giá,
              thông báo và quản trị lịch nhân sự theo đúng tài liệu yêu cầu.
            </p>

            <div className="portal-stat-grid">
              {systemHighlights.map((item) => (
                <article className="portal-stat" key={item.label}>
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </article>
              ))}
            </div>
          </div>

          <form className="portal-form-panel" onSubmit={submitConsultation}>
            <div className="section-title tight-title">
              <CalendarDays size={20} />
              <h2>Yêu cầu tư vấn đặt lịch</h2>
            </div>

            <div className="segmented-control" role="radiogroup" aria-label="Danh xưng">
              {["Anh", "Chị"].map((option) => (
                <label key={option}>
                  <input
                    type="radio"
                    name="salutation"
                    value={option}
                    checked={form.salutation === option}
                    onChange={(event) => updateForm("salutation", event.target.value)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>

            <div className="need-control" role="radiogroup" aria-label="Nhu cầu nha khoa">
              {needOptions.map((need) => (
                <label key={need}>
                  <input
                    type="radio"
                    name="needType"
                    value={need}
                    checked={form.needType === need}
                    onChange={(event) => updateForm("needType", event.target.value)}
                  />
                  <span>{need}</span>
                </label>
              ))}
            </div>

            <div className="portal-form-grid">
              <input
                value={form.fullName}
                onChange={(event) => updateForm("fullName", event.target.value)}
                placeholder="Họ tên"
                required
                maxLength={120}
              />
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => updateForm("phone", event.target.value)}
                placeholder="Số điện thoại"
                required
                maxLength={13}
              />
              <select value={form.serviceId} onChange={(event) => updateForm("serviceId", event.target.value)}>
                <option value="">Dịch vụ quan tâm</option>
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
                {(branchMap[form.province] || []).map((branch) => (
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
                className="wide"
                value={form.note}
                onChange={(event) => updateForm("note", event.target.value)}
                placeholder="Ghi chú triệu chứng hoặc yêu cầu thêm"
                rows="3"
                maxLength={1000}
              />
            </div>

            <button className="button primary full">
              <CalendarDays size={17} />
              Gửi yêu cầu
            </button>
          </form>
        </section>

        <section className="portal-section" id="actors">
          <div className="portal-section-heading">
            <p className="eyebrow">Actors & Use Cases</p>
            <h2>Coverage theo tài liệu DAS System Requirements</h2>
          </div>
          <div className="actor-grid">
            {actorUseCaseCoverage.map((actor) => {
              const Icon = actorIcons[actor.actor] || CheckCircle2;
              return (
                <article className="actor-card" key={actor.actor}>
                  <div className="actor-card-head">
                    <Icon size={22} />
                    <div>
                      <h3>{actor.actor}</h3>
                      <span>{actor.inherits}</span>
                    </div>
                  </div>
                  <p>{actor.summary}</p>
                  <ul className="usecase-list">
                    {actor.useCases.map((item) => (
                      <li key={item}>
                        <CheckCircle2 size={15} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section className="portal-section split-section" id="services">
          <div className="portal-section-heading">
            <p className="eyebrow">Dịch vụ, bác sĩ, phòng khám</p>
            <h2>Dữ liệu public từ MongoDB Atlas</h2>
          </div>

          <div className="service-grid">
            {services.slice(0, 6).map((service) => (
              <article className="service-card" key={service._id}>
                <strong>{service.name}</strong>
                <span>{service.durationMinutes} phút + {service.transitionTime || 10} phút chuyển giao</span>
                <small>{service.requiresPrepayment ? formatMoney(service.price) : "Tư vấn chi phí sau khám"}</small>
              </article>
            ))}
          </div>

          <div className="resource-rail">
            <article>
              <UsersRound size={20} />
              <strong>{dentists.length || 8} bác sĩ</strong>
              <span>Hồ sơ bác sĩ và chuyên môn phục vụ View Dentist Profiles.</span>
            </article>
            <article>
              <DoorOpen size={20} />
              <strong>{rooms.length || 5} phòng khám</strong>
              <span>Trạng thái phòng hỗ trợ đặt lịch động và cập nhật phòng.</span>
            </article>
            <article>
              <CreditCard size={20} />
              <strong>Invoice & Payment</strong>
              <span>Thanh toán khi check-in hoặc online theo hóa đơn bệnh nhân.</span>
            </article>
          </div>
        </section>

        <section className="portal-section" id="erd">
          <div className="portal-section-heading">
            <p className="eyebrow">ERD coverage</p>
            <h2>Các nhóm bảng chính đã được ánh xạ trong dự án</h2>
          </div>
          <div className="erd-grid">
            {erdCoverage.map((item, index) => {
              const Icon = moduleIcons[index % moduleIcons.length];
              return (
                <article key={item}>
                  <Icon size={18} />
                  <span>{item}</span>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
