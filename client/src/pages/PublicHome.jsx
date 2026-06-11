import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  PhoneCall,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  UsersRound
} from "lucide-react";
import { useMemo, useState } from "react";
import Carousel from "react-bootstrap/Carousel";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState.jsx";
import Feedback from "../components/Feedback.jsx";
import { usePublicBootstrap } from "../utils/usePublicBootstrap.js";
import { api, getErrorMessage } from "../utils/api.js";
import { formatMoney } from "../utils/format.js";
import { firstError, validateName, validatePhone } from "../utils/validation.js";
import doctorLeThanhVy from "../assets/doctor-le-thanh-vy.png";
import doctorNguyenMinhAnh from "../assets/doctor-nguyen-minh-anh.png";
import doctorTranHoangNam from "../assets/doctor-tran-hoang-nam.png";

const branchMap = {
  "TP. Hồ Chí Minh": ["SmileCare Quận 1 - 150 Hai Bà Trưng"]
};

const salutationOptions = ["Anh", "Chị", "Khác"];

const doctorPhotosByName = {
  "BS. Nguyễn Minh Anh": doctorNguyenMinhAnh,
  "BS. Trần Hoàng Nam": doctorTranHoangNam,
  "BS. Lê Thanh Vy": doctorLeThanhVy
};

const doctorPhotoFallbacks = [doctorNguyenMinhAnh, doctorTranHoangNam, doctorLeThanhVy];

const serviceFallback = [
  {
    name: "Cấy ghép Implant",
    description: "Phục hồi răng mất bằng công nghệ Implant hiện đại, giúp ăn nhai tự nhiên.",
    accent: "implant"
  },
  {
    name: "Thẩm mỹ răng sứ",
    description: "Thiết kế nụ cười hài hòa, màu sắc tự nhiên và phù hợp khuôn mặt.",
    accent: "cosmetic"
  },
  {
    name: "Chỉnh nha niềng răng",
    description: "Điều chỉnh khớp cắn, cải thiện thẩm mỹ và sức khỏe răng miệng lâu dài.",
    accent: "ortho"
  },
  {
    name: "Điều trị tổng quát",
    description: "Khám định kỳ, trám răng, lấy cao răng và tư vấn chăm sóc tại nhà.",
    accent: "general"
  }
];

function stripServiceDurationText(description = "") {
  return description
    .replace(/,?\s*thời lượng(?: dự kiến)?\s*\d+\s*phút\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function newestFirst(items) {
  return [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

const faqs = [
  {
    question: "Chi phí cấy ghép Implant tại SmileCare là bao nhiêu?",
    answer:
      "Chi phí phụ thuộc vào loại trụ, tình trạng xương hàm và kế hoạch điều trị. Lễ tân sẽ liên hệ tư vấn chi tiết sau khi bạn gửi thông tin."
  },
  {
    question: "Niềng răng mất bao lâu và có đau không?",
    answer:
      "Thời gian thường dao động theo tình trạng răng. Bác sĩ sẽ kiểm tra, lên lộ trình và hướng dẫn cách giảm ê nhẹ trong giai đoạn đầu."
  },
  {
    question: "Tôi có thể đặt lịch online rồi đổi giờ sau không?",
    answer:
      "Bạn có thể đặt lịch online. Nếu cần đổi giờ, lễ tân sẽ hỗ trợ dời lịch sang slot phù hợp theo lịch làm việc của bác sĩ."
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

function getServiceCards(services) {
  if (!services.length) return serviceFallback;

  return newestFirst(services).map((service, index) => ({
    _id: service._id,
    name: service.name,
    description: stripServiceDurationText(service.description) || serviceFallback[index % serviceFallback.length].description,
    price: service.price,
    accent: serviceFallback[index % serviceFallback.length].accent
  }));
}

function getDoctorPhoto(dentist, index) {
  return dentist.avatarUrl || doctorPhotosByName[dentist.fullName] || doctorPhotoFallbacks[index % doctorPhotoFallbacks.length];
}

function getDoctorExperience(dentist) {
  const years = Number(dentist.yearsOfExperience || dentist.experienceYears || 0);
  return years > 0 ? `${years}+ năm kinh nghiệm` : "Nhiều năm kinh nghiệm điều trị nha khoa";
}

function getDoctorInfo(dentist) {
  return [
    getDoctorExperience(dentist),
    dentist.licenseNo ? `Mã chứng chỉ: ${dentist.licenseNo}` : "Bác sĩ Răng Hàm Mặt",
    dentist.bio || "Tư vấn kế hoạch điều trị rõ ràng, theo dõi sát từng lịch hẹn và chăm sóc bệnh nhân nhẹ nhàng."
  ];
}

function getReviewCards(reviews) {
  return newestFirst(reviews)
    .filter((review) => review.comment)
    .slice(0, 8)
    .map((review) => ({
      _id: review._id,
      name: review.patient?.fullName || "Khách hàng SmileCare",
      service: review.service?.name || "Dịch vụ nha khoa",
      text: review.comment,
      rating: Math.min(Math.max(Number(review.rating || 5), 1), 5)
    }));
}

export default function PublicHome() {
  const { services, dentists, rooms, reviews } = usePublicBootstrap();
  const clinicBranches = useMemo(() => getClinicBranches(), []);
  const dentistCards = useMemo(() => newestFirst(dentists), [dentists]);
  const reviewCards = useMemo(() => getReviewCards(reviews), [reviews]);
  const serviceCards = useMemo(() => getServiceCards(services), [services]);
  const roomCount = rooms.length ? Math.min(rooms.length, 3) : 3;
  const [openFaq, setOpenFaq] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    salutation: "Anh",
    fullName: "",
    phone: "",
    service: ""
  });

  const selectedService = services.find((service) => service._id === form.service);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitConsultation(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const validationError = firstError(validateName(form.fullName), validatePhone(form.phone));
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await api.post("/consultations", {
        fullName: form.fullName,
        phone: form.phone,
        service: form.service || undefined,
        message: [
          `Danh xưng: ${form.salutation}`,
          `Dịch vụ quan tâm: ${selectedService?.name || "Chưa chọn"}`,
          `Chi nhánh: ${branchMap["TP. Hồ Chí Minh"][0]}`,
          "Khách muốn nhận tư vấn đặt lịch."
        ].join(". ")
      });

      setForm({
        salutation: "Anh",
        fullName: "",
        phone: "",
        service: ""
      });
      setMessage("Đã ghi nhận yêu cầu tư vấn. Lễ tân sẽ liên hệ để xác nhận lịch.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="smile-guest-page">
      <Feedback error={error} message={message} onClear={() => { setError(""); setMessage(""); }} />

      <header className="smile-header">
        <a className="smile-brand" href="#home" aria-label="SmileCare">
          SmileCare
        </a>

        <nav className="smile-nav" aria-label="Điều hướng khách">
          <a href="#home">Trang chủ</a>
          <a href="#services">Dịch vụ</a>
          <a href="#about">Giới thiệu</a>
        </nav>

        <div className="smile-header-actions">
          <a className="smile-phone" href="tel:19008888">
            <PhoneCall size={18} />
            <span>1900 8888</span>
          </a>
          <Link className="smile-primary-link" to="/login">
            Đăng nhập
          </Link>
        </div>
      </header>

      <main>
        <section className="smile-hero" id="home">
          <div className="smile-hero-copy">
            <span className="smile-pill">
              <ShieldCheck size={16} />
              Nha khoa uy tín hàng đầu
            </span>
            <h1>
              <span>Nụ Cười Rạng Rỡ,</span>
              <span>Tự Tin Tỏa Sáng</span>
            </h1>
            <p>
              SmileCare mang đến giải pháp chăm sóc răng miệng toàn diện với công nghệ hiện đại và đội ngũ bác sĩ giàu kinh nghiệm.
            </p>
            <div className="smile-hero-actions">
              <a className="smile-primary-link hero-action" href="#consultation">
                Đăng ký tư vấn miễn phí
                <ChevronRight size={18} />
              </a>
              <a className="smile-secondary-link" href="#services">
                Khám phá dịch vụ
                <ChevronRight size={18} />
              </a>
            </div>
          </div>

          <div className="smile-hero-visual" aria-label="Hình ảnh phòng khám SmileCare">
            <div className="smile-hero-image">
              <span>
                <CheckCircle2 size={18} />
                Thăm khám nhẹ nhàng
              </span>
            </div>
          </div>

        </section>

        <section className="smile-section smile-services" id="services">
          <div className="smile-section-heading centered">
            <span className="smile-pill compact">
              <Sparkles size={15} />
              Dịch vụ của chúng tôi
            </span>
            <h2>Chăm Sóc Toàn Diện Cho Nụ Cười Của Bạn</h2>
            <p>Từ kiểm tra định kỳ đến các giải pháp thẩm mỹ nha khoa, SmileCare đồng hành cùng bạn trong từng bước điều trị.</p>
          </div>

          <div className="smile-service-grid">
            {serviceCards.map((service, index) => (
              <article className={`smile-service-card tone-${service.accent}`} key={service._id || service.name}>
                <span className="smile-icon-bubble">
                  <Stethoscope size={22} />
                </span>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
                {service.price !== undefined && service.price !== null && <small>{formatMoney(service.price)}</small>}
              </article>
            ))}
          </div>
        </section>

        <section className="smile-section smile-about" id="about">
          <div className="smile-about-copy">
            <span className="smile-pill compact">
              <CheckCircle2 size={15} />
              Về SmileCare
            </span>
            <h2>Không gian điều trị hiện đại, lịch hẹn rõ ràng</h2>
            <div className="smile-feature-list">
              <span>
                <Clock size={18} />
                Thứ 2 - Thứ 7, 8h-11h30 và 14h-17h30
              </span>
              <span>
                <UsersRound size={18} />
                {dentistCards.length} bác sĩ theo chuyên môn nha khoa
              </span>
            </div>
          </div>

          <div className="smile-clinic-panel">
            {clinicBranches.map((clinic) => (
              <article key={clinic.id}>
                <MapPin size={20} />
                <div>
                  <strong>{clinic.branch}</strong>
                  <span>{clinic.province}</span>
                </div>
              </article>
            ))}
            <article>
              <CalendarDays size={20} />
              <div>
                <strong>{roomCount} phòng điều trị</strong>
                <span>Điều phối lịch khám theo bác sĩ, phòng và slot.</span>
              </div>
            </article>
          </div>
        </section>

        <section className="smile-section smile-dentists">
          <div className="smile-section-heading">
            <span className="smile-pill compact">
              <UsersRound size={15} />
              Đội ngũ bác sĩ
            </span>
            <h2>Bác sĩ đồng hành theo từng kế hoạch điều trị</h2>
          </div>

          {dentistCards.length ? (
            <Carousel className="smile-dentist-carousel single-card" interval={5000}>
              {dentistCards.map((dentist, index) => (
                <Carousel.Item key={dentist._id}>
                  <article className="smile-dentist-card featured">
                    <img src={getDoctorPhoto(dentist, index)} alt={dentist.fullName} />
                    <div>
                      <h3>{dentist.fullName}</h3>
                      <ul>
                        {getDoctorInfo(dentist).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </article>
                </Carousel.Item>
              ))}
            </Carousel>
          ) : (
            <EmptyState title="Chưa có bác sĩ" text="Danh sách bác sĩ sẽ hiển thị sau khi quản trị viên thêm hồ sơ bác sĩ active." />
          )}
        </section>

        <section className="smile-section smile-faq">
          <div className="smile-section-heading">
            <span className="smile-pill compact gold">
              <Sparkles size={15} />
              Tư vấn nhanh
            </span>
            <h2>Giải Đáp Thắc Mắc Về Sức Khỏe Răng Miệng</h2>
          </div>

          <div className="smile-faq-layout">
            <div className="smile-faq-photo" />
            <div className="smile-faq-list">
              {faqs.map((item, index) => (
                <article className={openFaq === index ? "open" : ""} key={item.question}>
                  <button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)}>
                    <span>{item.question}</span>
                    <strong>{openFaq === index ? "×" : "+"}</strong>
                  </button>
                  {openFaq === index && <p>{item.answer}</p>}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="smile-section smile-testimonials">
          <div className="smile-section-heading centered">
            <span className="smile-pill compact gold">
              <Star size={15} />
              Khách hàng nói gì
            </span>
            <h2>Hơn 50.000 Khách Hàng Đã Tin Tưởng SmileCare</h2>
          </div>
          {reviewCards.length ? (
            <div className="smile-testimonial-grid">
              {reviewCards.map((item) => (
                <article key={item._id}>
                  <div className="smile-stars" aria-label={`${item.rating} sao`}>
                    {Array.from({ length: item.rating }).map((_, index) => (
                      <Star size={16} fill="currentColor" key={index} />
                    ))}
                  </div>
                  <p>"{item.text}"</p>
                  <div>
                    <span>{item.name[0]}</span>
                    <strong>{item.name}</strong>
                    <small>{item.service}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có đánh giá"
              text="Đánh giá của khách hàng sẽ hiển thị tại đây sau khi bệnh nhân gửi từ hệ thống."
            />
          )}
        </section>

        <section className="smile-section smile-contact" id="consultation">
          <div className="smile-section-heading centered">
            <span className="smile-pill compact">
              <CalendarDays size={15} />
              Đặt lịch tư vấn
            </span>
            <h2>Đăng Ký Nhận Tư Vấn Miễn Phí Từ Chuyên Gia</h2>
            <p>Để lại thông tin, đội ngũ bác sĩ SmileCare sẽ liên hệ tư vấn trong vòng 24h.</p>
          </div>

          <form className="smile-consult-form" onSubmit={submitConsultation}>
            <div className="smile-segmented" role="radiogroup" aria-label="Danh xưng">
              {salutationOptions.map((option) => (
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

            <label>
              <span>Họ và tên *</span>
              <input
                value={form.fullName}
                onChange={(event) => updateForm("fullName", event.target.value)}
                placeholder="Nguyễn Văn A"
                required
                maxLength={120}
              />
            </label>
            <label>
              <span>Số điện thoại *</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => updateForm("phone", event.target.value)}
                placeholder="0912 345 678"
                required
                maxLength={13}
              />
            </label>
            <label>
              <span>Dịch vụ quan tâm</span>
              <select value={form.service} onChange={(event) => updateForm("service", event.target.value)}>
                <option value="">-- Chọn dịch vụ --</option>
                {services.map((service) => (
                  <option value={service._id} key={service._id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="smile-submit" type="submit">
              <Send size={18} />
              Gửi đăng ký tư vấn miễn phí
            </button>
          </form>
        </section>
      </main>

      <footer className="smile-footer">
        <div className="smile-footer-grid">
          <div>
            <strong className="smile-footer-brand">Smile<span>Care</span></strong>
            <p>Nha khoa SmileCare - Đồng hành cùng nụ cười Việt với dịch vụ chăm sóc răng miệng chất lượng cao.</p>
          </div>
          <div>
            <h3>Dịch vụ</h3>
            {serviceCards.map((item) => (
              <a href="#services" key={item._id || item.name}>{item.name}</a>
            ))}
          </div>
          <div>
            <h3>Về SmileCare</h3>
            <a href="#about">Giới thiệu</a>
            <a href="#about">Đội ngũ bác sĩ</a>
            <a href="#about">Cơ sở vật chất</a>
            <Link to="/login">Đăng nhập</Link>
          </div>
          <div>
            <h3>Hỗ trợ</h3>
            <a href="#consultation">Câu hỏi thường gặp</a>
            <Link to="/register">Tạo tài khoản</Link>
            <Link to="/booking">Hướng dẫn đặt lịch</Link>
            <a href="tel:19008888">1900 8888</a>
          </div>
        </div>
        <div className="smile-footer-bottom">
          <span>© 2026 SmileCare. Tất cả quyền được bảo lưu.</span>
          <span>Chính sách bảo mật · Điều khoản sử dụng</span>
        </div>
      </footer>
    </div>
  );
}
