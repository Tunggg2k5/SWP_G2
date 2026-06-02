import {
  CalendarClock,
  ClipboardList,
  DoorOpen,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Stethoscope,
  UserRound
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { canUsePatientBooking, canUsePublicLookup, formatInheritanceChain, roleLabels } from "../lib/roles.js";

function navForRole(role) {
  const base = [];

  if (canUsePublicLookup(role)) {
    base.push({ to: "/", label: "Tra cứu", icon: Search });
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
    { to: "/dashboard", label: "Bảng điều khiển", icon: dashboardIcon }
  ];
}

export default function Layout() {
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
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <DoorOpen size={26} />
          <span>Phòng khám DAS</span>
        </Link>

        <nav className="nav-list" aria-label="Điều hướng chính">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-menu">
            <Menu size={22} />
          </div>
          <div>
            <p className="eyebrow">Hệ thống đặt lịch nha khoa</p>
            <h1>Quản lý đặt lịch phòng khám nha khoa</h1>
          </div>

          <div className="user-box">
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

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
