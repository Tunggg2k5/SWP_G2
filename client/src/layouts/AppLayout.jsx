import {
  Bell,
  CalendarPlus,
  Camera,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  LockKeyhole,
  LogOut,
  PhoneCall,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserPen,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api, getErrorMessage } from "../services/api.js";
import { canUsePublicLookup, roleLabels } from "../utils/roles.js";
import { firstError, validateName, validatePassword, validatePhone } from "../utils/validation.js";

const receptionistTabs = [
  { id: "appointments", label: "Lịch hẹn", icon: ClipboardList },
  { id: "booking", label: "Đặt lịch hộ", icon: CalendarPlus },
  { id: "consultations", label: "Tư vấn", icon: PhoneCall }
];

const genderOptions = [
  { value: "unknown", label: "Chưa chọn" },
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
  { value: "other", label: "Other" }
];

function navForRole(role) {
  if (role === "patient") return [];
  if (role === "receptionist") return receptionistTabs.map((item) => ({ ...item, to: `/dashboard?tab=${item.id}`, isTab: true }));

  const base = [];
  if (canUsePublicLookup(role)) {
    base.push({ to: "/", label: "Tổng quan", icon: Search });
  }

  if (!role) return base;

  const dashboardIcon = role === "admin" ? ShieldCheck : role === "patient" ? UserRound : Stethoscope;
  return [
    ...base,
    { to: "/profile", label: "Hồ sơ", icon: UserRound },
    { to: "/dashboard", label: "Dashboard", icon: dashboardIcon }
  ];
}

export default function AppLayout() {
  const { user, logout, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const items = navForRole(user?.role);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ fullName: "", phone: "", gender: "unknown", address: "", bio: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [feedback, setFeedback] = useState({ message: "", error: "" });
  const fileInputRef = useRef(null);

  const activeTab = new URLSearchParams(location.search).get("tab") || "appointments";
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const userInitial = useMemo(() => user?.fullName?.trim()?.[0]?.toUpperCase() || "D", [user?.fullName]);

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      fullName: user.fullName || "",
      phone: user.phone || "",
      gender: user.gender || "unknown",
      address: user.address || "",
      bio: user.bio || ""
    });
    loadNotifications();
  }, [user?._id, user?.fullName, user?.phone, user?.gender, user?.address, user?.bio]);

  if (location.pathname === "/" || location.pathname === "/dat-lich-hen") {
    return <Outlet />;
  }

  async function loadNotifications() {
    try {
      const res = await api.get("/auth/notifications");
      setNotifications(res.data.notifications || []);
    } catch (_error) {
      setNotifications([]);
    }
  }

  function clearFeedback() {
    setFeedback({ message: "", error: "" });
  }

  function handleLogout() {
    logout();
    navigate("/");
  }

  async function saveProfile(event) {
    event.preventDefault();
    const validationError = firstError(validateName(profileForm.fullName), validatePhone(profileForm.phone));
    if (validationError) {
      setFeedback({ message: "", error: validationError });
      return;
    }

    try {
      const res = await api.patch("/auth/me", profileForm);
      updateUser(res.data.user);
      setProfileOpen(false);
      setShowAccountMenu(false);
      setFeedback({ message: "Đã cập nhật thông tin cá nhân.", error: "" });
    } catch (error) {
      setFeedback({ message: "", error: getErrorMessage(error) });
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    const validationError = firstError(
      passwordForm.currentPassword ? "" : "Mật khẩu hiện tại là bắt buộc.",
      validatePassword(passwordForm.newPassword)
    );
    if (validationError) {
      setFeedback({ message: "", error: validationError });
      return;
    }

    try {
      await api.patch("/auth/change-password", passwordForm);
      setPasswordForm({ currentPassword: "", newPassword: "" });
      setPasswordOpen(false);
      setShowAccountMenu(false);
      setFeedback({ message: "Đã đổi mật khẩu.", error: "" });
    } catch (error) {
      setFeedback({ message: "", error: getErrorMessage(error) });
    }
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const avatarUrl = await fileToCompressedAvatar(file);
      const res = await api.patch("/auth/me", { avatarUrl });
      updateUser(res.data.user);
      setShowAccountMenu(false);
      setFeedback({ message: "Đã cập nhật avatar.", error: "" });
    } catch (error) {
      setFeedback({ message: "", error: error.message || getErrorMessage(error) });
    }
  }

  async function markNotificationRead(notification) {
    if (!notification?._id || notification.isRead) return;
    try {
      await api.patch(`/auth/notifications/${notification._id}/read`);
      await loadNotifications();
    } catch (error) {
      setFeedback({ message: "", error: getErrorMessage(error) });
    }
  }

  return (
    <div className={`app-shell top-nav-shell role-shell role-${user?.role || "guest"}`}>
      <Feedback error={feedback.error} message={feedback.message} onClear={clearFeedback} />
      <header className="app-topnav">
        <Link className="top-brand" to={user?.role === "patient" ? "/dashboard" : "/"}>
          <DoorOpen size={24} />
          <span>Phòng khám DAS</span>
        </Link>

        <nav className="top-nav-list" aria-label="Điều hướng chính">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.isTab ? activeTab === item.id && location.pathname === "/dashboard" : undefined;
            return item.isTab ? (
              <Link key={item.id} to={item.to} className={`top-nav-item ${active ? "active" : ""}`}>
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            ) : (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `top-nav-item ${isActive ? "active" : ""}`}>
                <Icon size={17} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="top-user-box">
          {user ? (
            <>
              <button className="top-notification-button" onClick={() => setShowNotifications((value) => !value)} title="Thông báo">
                <Bell size={18} />
                {unreadCount > 0 && <span>{unreadCount}</span>}
              </button>
              <button className="top-avatar-button" onClick={() => setShowAccountMenu((value) => !value)} title="Tài khoản">
                {user.avatarUrl ? <img src={user.avatarUrl} alt={user.fullName || "Avatar"} /> : <span>{userInitial}</span>}
              </button>
            </>
          ) : null}
        </div>

        {showNotifications && (
          <div className="notification-popover">
            <div className="notification-popover-head">
              <div>
                <p className="eyebrow">Hoạt động mới</p>
                <strong>Thông báo hệ thống</strong>
              </div>
              <button className="icon-button" onClick={() => setShowNotifications(false)} title="Đóng">
                <X size={18} />
              </button>
            </div>
            <div className="notification-popover-list">
              {notifications.length ? (
                notifications.map((item) => (
                  <button
                    className={`notification-card ${item.isRead ? "read" : ""}`}
                    key={item._id}
                    onClick={() => markNotificationRead(item)}
                  >
                    <span className="notification-avatar">{userInitial}</span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.message}</small>
                      <em>{new Date(item.createdAt).toLocaleString("vi-VN")}</em>
                    </span>
                  </button>
                ))
              ) : (
                <div className="notification-empty">Chưa có thông báo mới.</div>
              )}
            </div>
          </div>
        )}

        {showAccountMenu && user && (
          <div className="account-popover">
            <div className="account-profile-card">
              <span className="account-avatar">
                {user.avatarUrl ? <img src={user.avatarUrl} alt={user.fullName || "Avatar"} /> : userInitial}
              </span>
              <strong>{user.fullName}</strong>
              <small>{roleLabels[user.role] || user.role}</small>
            </div>
            <button onClick={() => { setProfileOpen(true); setShowAccountMenu(false); }}>
              <UserPen size={19} />
              <span>Thay đổi thông tin cá nhân</span>
              <ChevronRight size={18} />
            </button>
            <button onClick={() => fileInputRef.current?.click()}>
              <Camera size={19} />
              <span>Đổi avatar từ thư viện</span>
              <ChevronRight size={18} />
            </button>
            <button onClick={() => { setPasswordOpen(true); setShowAccountMenu(false); }}>
              <LockKeyhole size={19} />
              <span>Đổi mật khẩu</span>
              <ChevronRight size={18} />
            </button>
            <button onClick={handleLogout}>
              <LogOut size={19} />
              <span>Đăng xuất</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={uploadAvatar} />
          </div>
        )}
      </header>

      <main className="content top-nav-content">
        <Outlet />
      </main>

      {profileOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="account-modal panel" onSubmit={saveProfile}>
            <div className="section-title">
              <Settings size={20} />
              <h2>Thông tin cá nhân</h2>
            </div>
            <label className="field">
              <span>Họ tên</span>
              <input value={profileForm.fullName} onChange={(event) => setProfileForm({ ...profileForm, fullName: event.target.value })} required />
            </label>
            <label className="field">
              <span>Số điện thoại</span>
              <input type="tel" value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} required />
            </label>
            <div className="form-grid account-form-grid">
              <label className="field">
                <span>Giới tính</span>
                <select value={profileForm.gender} onChange={(event) => setProfileForm({ ...profileForm, gender: event.target.value })}>
                  {genderOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Địa chỉ</span>
                <input value={profileForm.address} onChange={(event) => setProfileForm({ ...profileForm, address: event.target.value })} maxLength={255} />
              </label>
            </div>
            <label className="field">
              <span>Ghi chú hồ sơ</span>
              <textarea value={profileForm.bio} onChange={(event) => setProfileForm({ ...profileForm, bio: event.target.value })} rows="3" maxLength={1000} />
            </label>
            <div className="row-actions">
              <button type="button" className="button ghost" onClick={() => setProfileOpen(false)}>
                Hủy
              </button>
              <button className="button primary">
                <Save size={17} />
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}

      {passwordOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="account-modal panel" onSubmit={changePassword}>
            <div className="section-title">
              <LockKeyhole size={20} />
              <h2>Đổi mật khẩu</h2>
            </div>
            <label className="field">
              <span>Mật khẩu hiện tại</span>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Mật khẩu mới</span>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                required
                minLength={8}
                maxLength={72}
              />
            </label>
            <div className="row-actions">
              <button type="button" className="button ghost" onClick={() => setPasswordOpen(false)}>
                Hủy
              </button>
              <button className="button primary">Đổi mật khẩu</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function fileToCompressedAvatar(file) {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Chỉ hỗ trợ file ảnh."));
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const maxSize = 360;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Không đọc được file ảnh."));
    };
    image.src = objectUrl;
  });
}
