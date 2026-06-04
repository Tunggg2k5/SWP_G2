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
import { Link } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import { usePublicBootstrap } from "../hooks/usePublicBootstrap.js";
import { api, getErrorMessage } from "../services/api.js";
import { formatMoney } from "../utils/format.js";
import { firstError, validateName, validatePhone } from "../utils/validation.js";

const branchMap = {
  "TP. Hồ Chí Minh": ["SmileCare Quận 1 - 150 Hai Bà Trưng"]
};

const salutationOptions = ["Anh", "Chị", "Khác"];

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
    description: "Phụ trách khám chuyên sâu, phục hồi răng mất và phẫu thuật miệng."
  },
  {
    _id: "fallback-dentist-3",
    fullName: "BS. Lê Thanh Vy",
    specialty: "Nha khoa tổng quát",
    description: "Khám ban đầu, tư vấn dịch vụ và chăm sóc răng miệng định kỳ."
  }
];

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

const testimonials = [
  {
    name: "Chị Minh Anh",
    service: "Cấy ghép Implant",
    text: "Tôi đã cấy 2 răng Implant tại SmileCare. Bác sĩ rất tận tâm, quy trình chuyên nghiệp và ăn nhai thoải mái."
  },
  {
    name: "Anh Tuấn Hưng",
    service: "Niềng răng Invisalign",
    text: "Niềng răng trong suốt rất tiện lợi. Sau 18 tháng hàm răng đều đẹp hơn, đội ngũ theo dõi sát."
  },
  {
    name: "Chị Hải Yến",
    service: "Bọc răng sứ thẩm mỹ",
    text: "Màu răng tự nhiên, nụ cười sáng hơn nhưng vẫn hài hòa. Tôi rất hài lòng với kết quả."
  },
  {
    name: "Bé Gia Bảo",
    service: "Nha khoa trẻ em",
    text: "Bé nhà mình rất sợ đi nha sĩ nhưng khi đến đây lại hợp tác, các cô chú nhẹ nhàng và thân thiện."
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

export default function PublicHome() {
  const { services, dentists, rooms } = usePublicBootstrap();
  const clinicBranches = useMemo(() => getClinicBranches(), []);
  const dentistCards = dentists.length ? newestFirst(dentists).slice(0, 3) : fallbackDentists;
  const serviceCards = useMemo(() => getServiceCards(services), [services]);
  const roomCount = rooms.length ? Math.min(rooms.length, 3) : 3;
  const [openFaq, setOpenFaq] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    salutation: "Anh",
    fullName: "",
    phone: "",
    service: "",
    note: ""
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
          form.note ? `Ghi chú: ${form.note}` : "Khách muốn nhận tư vấn đặt lịch."
        ].join(". ")
      });

      setForm({
        salutation: "Anh",
        fullName: "",
        phone: "",
        service: "",
        note: ""
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
          <a href="#contact">Liên hệ</a>
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
              <a className="smile-primary-link hero-action" href="#contact">
                Đăng ký tư vấn miễn phí
                <ChevronRight size={18} />
              </a>
              <a className="smile-secondary-link" href="#services">
                Khám phá dịch vụ
                <ChevronRight size={18} />
              </a>
            </div>
            <div className="smile-stats" aria-label="Thống kê SmileCare">
              <span>
                <strong>15+</strong>
                Năm Kinh Nghiệm
              </span>
              <span>
                <strong>{roomCount}</strong>
                Phòng Điều Trị
              </span>
              <span>
                <strong>98%</strong>
                Hài Lòng
              </span>
              <span>
                <strong>{dentistCards.length}</strong>
                Bác Sĩ Chuyên Khoa
              </span>
            </div>
          </div>

          <div className="smile-hero-gallery" aria-label="Hình ảnh phòng khám SmileCare">
            <div className="smile-photo smile-photo-main" />
            <div className="smile-photo smile-photo-smile" />
            <div className="smile-photo smile-photo-room" />
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
              <article className={`smile-service-card ${index === 0 ? "large" : ""} tone-${service.accent}`} key={service._id || service.name}>
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

          <div className="smile-dentist-grid">
            {dentistCards.map((dentist) => (
              <article className="smile-dentist-card" key={dentist._id}>
                <span>{dentist.fullName?.trim()?.[0]?.toUpperCase() || "B"}</span>
                <h3>{dentist.fullName}</h3>
                <strong>{dentist.specialty || "Nha khoa tổng quát"}</strong>
                <p>{dentist.description || "Khám, tư vấn và theo dõi kế hoạch điều trị cho bệnh nhân."}</p>
              </article>
            ))}
          </div>
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
          <div className="smile-testimonial-grid">
            {testimonials.map((item) => (
              <article key={item.name}>
                <div className="smile-stars" aria-label="5 sao">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star size={16} fill="currentColor" key={index} />
                  ))}
                </div>
                <p>“{item.text}”</p>
                <div>
                  <span>{item.name[0]}</span>
                  <strong>{item.name}</strong>
                  <small>{item.service}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="smile-section smile-contact" id="contact">
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
            <label className="wide">
              <span>Ghi chú thêm</span>
              <textarea
                value={form.note}
                onChange={(event) => updateForm("note", event.target.value)}
                placeholder="Mô tả ngắn gọn tình trạng răng miệng hoặc yêu cầu của bạn..."
                rows="4"
                maxLength={500}
              />
              <small>{form.note.length}/500 ký tự</small>
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
            <a href="#contact">Câu hỏi thường gặp</a>
            <Link to="/register">Tạo tài khoản</Link>
            <Link to="/booking">Hướng dẫn đặt lịch</Link>
            <a href="tel:19008888">Liên hệ</a>
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
