import {
  CalendarClock,
  ClipboardList,
  DoorOpen,
  LogOut,
  Search,
  ShieldCheck,
  Stethoscope,
  UserRound
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { canUsePatientBooking, canUsePublicLookup, formatInheritanceChain, roleLabels } from "../utils/roles.js";

function navForRole(role) {
  const base = [];

  if (canUsePublicLookup(role)) {
    base.push({ to: "/", label: "Tổng quan", icon: Search });
  }

  if (canUsePatientBooking(role)) {
    base.push({ to: "/booking", label: "Đặt lịch", icon: CalendarClock });
  }

  if (!role) return base;

  const dashboardIcon =
    role === "admin" ? ShieldCheck : role === "receptionist" ? ClipboardList : role === "patient" ? UserRound : Stethoscope;

  return [
    ...base,
    { to: "/profile", label: "Hồ sơ", icon: UserRound },
    { to: "/dashboard", label: "Dashboard", icon: dashboardIcon }
  ];
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const items = navForRole(user?.role);

  if (location.pathname === "/" || location.pathname === "/dat-lich-hen") {
    return <Outlet />;
  }

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="app-shell top-nav-shell">
      <header className="app-topnav">
        <Link className="top-brand" to="/">
          <DoorOpen size={24} />
          <span>Phòng khám DAS</span>
        </Link>

        <nav className="top-nav-list" aria-label="Điều hướng chính">
          {items.map((item) => {
            const Icon = item.icon;
            return (
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
              <div className="user-meta">
                <strong>{user.fullName}</strong>
                <span>{formatInheritanceChain(user.inheritanceChain, roleLabels[user.role])}</span>
              </div>
              <button className="icon-button" onClick={handleLogout} title="Đăng xuất">
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <div className="auth-links">
              <Link className="button ghost" to="/login">
                Đăng nhập
              </Link>
              <Link className="button primary" to="/register">
                Tạo tài khoản
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="content top-nav-content">
        <Outlet />
      </main>
    </div>
  );
}
