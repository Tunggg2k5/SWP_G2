import { Home, LockKeyhole, Phone, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../redux/AuthContext.jsx";
import { api, getErrorMessage } from "../utils/api.js";
import { firstError, requireValue, validatePassword, validatePhone } from "../utils/validation.js";

const genderOptions = [
  { value: "unknown", label: "Chưa chọn" },
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
  { value: "other", label: "Other" }
];

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    phone: "",
    gender: "unknown",
    address: "",
    password: "",
    confirmPassword: ""
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
      ? firstError(
          validatePhone(form.phone),
          requireValue(form.gender, "Giới tính"),
          validatePassword(form.password),
          form.confirmPassword === form.password ? "" : "Mật khẩu nhập lại không khớp."
        )
      : firstError(validatePhone(form.phone), form.password ? "" : "Mật khẩu là bắt buộc.");

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        const res = await register(form);
        setMessage(res.message || "Đăng ký thành công. Vui lòng đăng nhập.");
        setTimeout(() => navigate("/login"), 700);
      } else {
        await login(form.phone, form.password);
        navigate("/dashboard");
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function forgotPassword() {
    setError("");
    setMessage("");

    if (validatePhone(form.phone)) {
      setError("Nhập số điện thoại hợp lệ trước khi yêu cầu quên mật khẩu.");
      return;
    }

    try {
      const res = await api.post("/auth/forgot-password", { phone: form.phone });
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
          <label className="field">
            <span>Số điện thoại</span>
            <div className="input-icon">
              <Phone size={18} />
              <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} required maxLength={13} />
            </div>
          </label>

          {isRegister && (
            <>
              <label className="field">
                <span>Gender</span>
                <div className="input-icon">
                  <UserRound size={18} />
                  <select value={form.gender} onChange={(e) => update("gender", e.target.value)} required>
                    {genderOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Address</span>
                <div className="input-icon">
                  <Home size={18} />
                  <input value={form.address} onChange={(e) => update("address", e.target.value)} maxLength={255} />
                </div>
              </label>
            </>
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

          {isRegister && (
            <label className="field">
              <span>Nhập lại mật khẩu</span>
              <div className="input-icon">
                <LockKeyhole size={18} />
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  required
                  minLength={8}
                  maxLength={72}
                />
              </div>
            </label>
          )}

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
          <li>Admin: 0900000000</li>
          <li>Lễ tân: 0901000001</li>
          <li>Bác sĩ: 0902000001</li>
          <li>Y tá: 0903000001</li>
          <li>Bệnh nhân: 0911000001</li>
        </ul>
        <p className="muted">Mật khẩu chung: Password123!</p>
      </div>
    </section>
  );
}
