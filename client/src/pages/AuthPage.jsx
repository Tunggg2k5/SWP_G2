import { LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api, getErrorMessage } from "../services/api.js";
import { firstError, validateEmail, validateName, validatePassword, validatePhone } from "../utils/validation.js";

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationError = isRegister
      ? firstError(validateName(form.fullName), validateEmail(form.email), validatePhone(form.phone), validatePassword(form.password))
      : firstError(validateEmail(form.email), form.password ? "" : "Mật khẩu là bắt buộc.");

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        await register(form);
      } else {
        await login(form.email, form.password);
      }
      navigate("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function forgotPassword() {
    setError("");
    setMessage("");

    if (validateEmail(form.email)) {
      setError("Nhập email hợp lệ trước khi yêu cầu quên mật khẩu.");
      return;
    }

    try {
      const res = await api.post("/auth/forgot-password", { email: form.email });
      setMessage(res.data.message);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <section className="auth-grid">
      <div className="panel auth-panel">
        <p className="eyebrow">{isRegister ? "Tạo tài khoản" : "Đăng nhập"}</p>
        <h2>{isRegister ? "Tạo tài khoản bệnh nhân" : "Đăng nhập DAS"}</h2>

        <form className="stack" onSubmit={handleSubmit}>
          {isRegister && (
            <label className="field">
              <span>Họ và tên</span>
              <div className="input-icon">
                <UserRound size={18} />
                <input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} required maxLength={120} />
              </div>
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <div className="input-icon">
              <Mail size={18} />
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required maxLength={160} />
            </div>
          </label>

          {isRegister && (
            <label className="field">
              <span>Số điện thoại</span>
              <div className="input-icon">
                <Phone size={18} />
                <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} required maxLength={13} />
              </div>
            </label>
          )}

          <label className="field">
            <span>Mật khẩu</span>
            <div className="input-icon">
              <LockKeyhole size={18} />
              <input
                type="password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                required
                minLength={8}
                maxLength={72}
              />
            </div>
          </label>

          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}

          <button className="button primary full" disabled={loading}>
            {loading ? "Đang xử lý..." : isRegister ? "Tạo tài khoản" : "Đăng nhập"}
          </button>
          {!isRegister && (
            <button type="button" className="button ghost full" onClick={forgotPassword}>
              Quên mật khẩu
            </button>
          )}
        </form>

        <p className="muted">
          {isRegister ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
          <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Đăng nhập" : "Tạo tài khoản"}</Link>
        </p>
      </div>

      <div className="panel demo-panel">
        <h3>Tài khoản demo sau khi seed</h3>
        <ul className="demo-list">
          <li>admin@das.local</li>
          <li>receptionist1@das.local</li>
          <li>dentist1@das.local</li>
          <li>nurse1@das.local</li>
          <li>patient1@das.local</li>
        </ul>
        <p className="muted">Mật khẩu chung: Password123!</p>
      </div>
    </section>
  );
}
