import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  DoorOpen,
  LogIn,
  MapPin,
  Phone,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  UsersRound
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import { usePublicBootstrap } from "../hooks/usePublicBootstrap.js";
import { api, getErrorMessage } from "../services/api.js";
import { formatMoney, todayInput } from "../utils/format.js";
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

const fallbackDentists = [
  {
    _id: "fallback-dentist-1",
    fullName: "BS. Nguyễn Minh Anh",
    specialty: "Chỉnh nha và phục hình thẩm mỹ",
    description: "Theo dõi kế hoạch điều trị, tư vấn niềng răng và bọc răng sứ."
  },
  {
    _id: "fallback-dentist-2",
    fullName: "BS. Trần Hoàng Nam",
    specialty: "Cấy ghép Implant",
    description: "Phụ trách khám chuyên sâu, điều trị phục hồi răng mất và phẫu thuật miệng."
  },
  {
    _id: "fallback-dentist-3",
    fullName: "BS. Lê Thanh Vy",
    specialty: "Nha khoa tổng quát",
    description: "Khám ban đầu, tư vấn dịch vụ và chăm sóc răng miệng định kỳ."
  }
];

function getClinicBranches() {
  return Object.entries(branchMap).flatMap(([province, branches]) =>
    branches.map((branch) => ({
      id: `${province}-${branch}`,
      province,
      branch
    }))
  );
}

function getServiceSummary(service) {
  if (!service) return "";
  const duration = `${service.durationMinutes || 30} phút`;
  const transition = `${service.transitionTime || 10} phút chuyển giao`;
  return `${duration} + ${transition}`;
}

export default function PublicHome() {
  const { services, dentists, rooms } = usePublicBootstrap();
  const minDate = useMemo(() => todayInput(), []);
  const clinicBranches = useMemo(() => getClinicBranches(), []);
  const dentistCards = dentists.length ? dentists.slice(0, 6) : fallbackDentists;
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

  const heroHighlights = [
    {
      label: "Thông tin phòng khám",
      value: `${clinicBranches.length} chi nhánh, ${rooms.length || 5} phòng khám đang hoạt động`
    },
    {
      label: "Profile bác sĩ",
      value: `${dentists.length || fallbackDentists.length} bác sĩ theo chuyên môn nha khoa`
    },
    {
      label: "Dịch vụ phòng khám",
      value: `${services.length || 6} dịch vụ khám, điều trị và thẩm mỹ răng`
    },
    {
      label: "Giờ làm việc",
      value: "Thứ 2 - Thứ 7, 07:00-11:30 và 13:30-17:30"
    }
  ];

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
          <a href="#clinics">Phòng khám</a>
          <a href="#dentists">Bác sĩ</a>
          <a href="#services">Dịch vụ</a>
        </nav>

        <div className="portal-actions">
          <a className="button ghost" href="tel:19006899">
            <Phone size={17} />
            1900 6899
          </a>
          <Link className="button ghost" to="/login">
            <LogIn size={17} />
            Đăng nhập
          </Link>
          <Link className="button primary" to="/register">
            <UserPlus size={17} />
            Tạo tài khoản
          </Link>
        </div>
      </header>

      <main className="portal-main">
        <section className="portal-hero-band" id="booking">
          <div className="portal-copy">
            <p className="eyebrow">Dental Appointment System</p>
            <h1>Thông tin và đặt lịch phòng khám nha khoa</h1>
            <p>
              Khách hàng có thể xem thông tin phòng khám, hồ sơ bác sĩ, dịch vụ nha khoa và gửi yêu cầu tư vấn đặt lịch
              trước khi tạo tài khoản bệnh nhân.
            </p>

            <div className="portal-stat-grid">
              {heroHighlights.map((item) => (
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

        <section className="portal-section public-info-section" id="clinics">
          <div className="portal-section-heading">
            <p className="eyebrow">Thông tin phòng khám</p>
            <h2>Hệ thống chi nhánh DAS</h2>
          </div>
          <div className="clinic-info-grid">
            {clinicBranches.map((clinic) => (
              <article className="clinic-info-card" key={clinic.id}>
                <MapPin size={20} />
                <div>
                  <strong>{clinic.branch}</strong>
                  <span>{clinic.province}</span>
                </div>
              </article>
            ))}
          </div>
          <div className="clinic-feature-row">
            <article>
              <DoorOpen size={20} />
              <strong>{rooms.length || 5} phòng điều trị</strong>
              <span>Phòng khám được quản lý trạng thái để hỗ trợ đặt lịch chính xác.</span>
            </article>
            <article>
              <Clock size={20} />
              <strong>Lịch làm việc rõ ràng</strong>
              <span>Thứ 2 - Thứ 7, ca sáng 07:00-11:30 và ca chiều 13:30-17:30.</span>
            </article>
            <article>
              <ShieldCheck size={20} />
              <strong>Hồ sơ bảo mật</strong>
              <span>Thông tin tư vấn và lịch hẹn được xử lý theo vai trò người dùng.</span>
            </article>
          </div>
        </section>

        <section className="portal-section public-info-section" id="dentists">
          <div className="portal-section-heading">
            <p className="eyebrow">Profile bác sĩ</p>
            <h2>Đội ngũ bác sĩ nha khoa</h2>
          </div>
          <div className="dentist-profile-grid">
            {dentistCards.map((dentist) => (
              <article className="dentist-profile-card" key={dentist._id}>
                <div className="dentist-avatar">
                  <UsersRound size={24} />
                </div>
                <div>
                  <h3>{dentist.fullName}</h3>
                  <p>{dentist.specialty || "Nha khoa tổng quát"}</p>
                </div>
                <ul>
                  <li>
                    <CheckCircle2 size={15} />
                    <span>{dentist.description || "Khám, tư vấn và theo dõi kế hoạch điều trị cho bệnh nhân."}</span>
                  </li>
                  <li>
                    <CheckCircle2 size={15} />
                    <span>Lịch khám được điều phối theo phòng và dịch vụ phù hợp.</span>
                  </li>
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="portal-section public-info-section" id="services">
          <div className="portal-section-heading">
            <p className="eyebrow">Thông tin dịch vụ phòng khám</p>
            <h2>Dịch vụ nha khoa đang phục vụ</h2>
          </div>

          <div className="service-grid public-service-grid">
            {services.slice(0, 6).map((service) => (
              <article className="service-card" key={service._id}>
                <Stethoscope size={20} />
                <strong>{service.name}</strong>
                <span>{getServiceSummary(service)}</span>
                <small>{service.requiresPrepayment ? formatMoney(service.price) : "Tư vấn chi phí sau khám"}</small>
              </article>
            ))}
          </div>

          {!services.length && (
            <div className="service-grid public-service-grid">
              {needOptions.slice(1).map((service) => (
                <article className="service-card" key={service}>
                  <Stethoscope size={20} />
                  <strong>{service}</strong>
                  <span>Thời lượng được tư vấn theo tình trạng răng miệng.</span>
                  <small>Liên hệ lễ tân để nhận chi phí dự kiến</small>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
