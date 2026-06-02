import { BarChart3, CalendarDays, DoorOpen, Download, KeyRound, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../components/EmptyState.jsx";
import Feedback from "../components/Feedback.jsx";
import FeatureTabs from "../components/FeatureTabs.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { api, getErrorMessage } from "../lib/api.js";
import { formatDateTime, formatMoney, todayInput } from "../lib/format.js";
import { formatInheritanceChain, roleLabels } from "../lib/roles.js";
import { firstError, requireValue, validateDate, validateEmail, validateName, validateNote, validatePhone } from "../lib/validation.js";

const adminFeatures = [
  { id: "overview", label: "Thống kê", icon: BarChart3 },
  { id: "users", label: "Tài khoản", icon: UsersRound },
  { id: "services", label: "Dịch vụ", icon: Settings2 },
  { id: "rooms", label: "Phòng khám", icon: DoorOpen },
  { id: "workingHours", label: "Giờ làm", icon: CalendarDays },
  { id: "schedules", label: "Lịch nhân sự", icon: CalendarDays },
  { id: "reports", label: "Báo cáo", icon: Download }
];

const staffRoles = ["dentist", "nurse", "receptionist"];
const dayNames = {
  1: "Thứ 2",
  2: "Thứ 3",
  3: "Thứ 4",
  4: "Thứ 5",
  5: "Thứ 6",
  6: "Thứ 7"
};
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const clinicSessions = [
  { start: "07:00", end: "11:30" },
  { start: "13:30", end: "17:30" }
];

export default function AdminDashboard() {
  const [activeFeature, setActiveFeature] = useState("overview");
  const [stats, setStats] = useState(null);
  const [roleHierarchy, setRoleHierarchy] = useState([]);
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [workingHours, setWorkingHours] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    description: "",
    durationMinutes: 30,
    price: 0,
    requiresPrepayment: true,
    isConsultation: false
  });
  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "patient",
    specialty: ""
  });
  const [workingHourForm, setWorkingHourForm] = useState({
    dayOfWeek: 1,
    shiftName: "Ca sáng",
    startTime: "07:00",
    endTime: "11:30"
  });
  const [scheduleForm, setScheduleForm] = useState({
    userId: "",
    timeSlotId: "",
    roomId: "",
    workDate: todayInput(),
    startTime: "07:00",
    endTime: "11:30"
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/admin/dashboard");
      setStats(res.data.stats);
      setUsers(res.data.users);
      setServices(res.data.services);
      setRooms(res.data.rooms);
      setRoleHierarchy(res.data.roleHierarchy);
      setWorkingHours(res.data.workingHours);
      setTimeSlots(res.data.timeSlots);
      setScheduleForm((current) => ({
        ...current,
        userId: current.userId || res.data.users.find((item) => ["dentist", "nurse", "receptionist"].includes(item.role))?._id || "",
        timeSlotId: current.timeSlotId || res.data.timeSlots[0]?._id || "",
        roomId: current.roomId || res.data.rooms[0]?._id || "",
        workDate: current.workDate || todayInput()
      }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (activeFeature === "schedules" && !schedulesLoaded) {
      loadSchedules();
    }
  }, [activeFeature, schedulesLoaded]);

  async function loadSchedules() {
    try {
      const res = await api.get("/admin/staff-schedules", { params: { limit: 80 } });
      setSchedules(res.data.schedules);
      setSchedulesLoaded(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function createService(event) {
    event.preventDefault();
    const validationError = firstError(
      validateName(serviceForm.name, "Tên dịch vụ"),
      validateNote(serviceForm.description),
      Number(serviceForm.durationMinutes) >= 10 ? "" : "Thời lượng dịch vụ tối thiểu 10 phút.",
      Number(serviceForm.price) >= 0 ? "" : "Giá dịch vụ không được âm."
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setError("");
      setMessage("");
      await api.post("/admin/services", {
        ...serviceForm,
        durationMinutes: Number(serviceForm.durationMinutes),
        price: Number(serviceForm.price)
      });
      setServiceForm({
        name: "",
        description: "",
        durationMinutes: 30,
        price: 0,
        requiresPrepayment: true,
        isConsultation: false
      });
      setMessage("Đã tạo dịch vụ.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function createUser(event) {
    event.preventDefault();
    const validationError = firstError(validateName(userForm.fullName), validateEmail(userForm.email), validatePhone(userForm.phone));
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setError("");
      setMessage("");
      await api.post("/admin/users", {
        ...userForm,
        password: "Password123!"
      });
      setUserForm({ fullName: "", email: "", phone: "", role: "patient", specialty: "" });
      setMessage("Đã tạo tài khoản. Mật khẩu mặc định: Password123!");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function updateUserStatus(id, status) {
    try {
      setError("");
      setMessage("");
      await api.patch(`/admin/users/${id}`, { status });
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function resetUserPassword(user) {
    const confirmed = window.confirm(`Đặt lại mật khẩu cho ${user.fullName}? Mật khẩu cũ sẽ không thể xem lại.`);
    if (!confirmed) return;

    try {
      setError("");
      setMessage("");
      const res = await api.post(`/admin/users/${user._id}/reset-password`);
      setUsers((current) => current.map((item) => (item._id === user._id ? res.data.user : item)));
      setMessage(`Đã đặt lại mật khẩu cho ${user.fullName}. Mật khẩu tạm thời: ${res.data.temporaryPassword}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function updateRoom(roomId, status) {
    try {
      setError("");
      setMessage("");
      await api.patch(`/admin/rooms/${roomId}`, { status });
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function createWorkingHour(event) {
    event.preventDefault();
    const validationError = firstError(
      validateName(workingHourForm.shiftName, "Tên ca"),
      validateTimeRange(workingHourForm.startTime, workingHourForm.endTime)
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setError("");
      setMessage("");
      await api.post("/admin/working-hours", {
        ...workingHourForm,
        dayOfWeek: Number(workingHourForm.dayOfWeek)
      });
      setMessage("Đã thêm giờ làm.");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function toggleWorkingHour(id, status) {
    try {
      setError("");
      setMessage("");
      await api.patch(`/admin/working-hours/${id}`, { status });
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function createSchedule(event) {
    event.preventDefault();
    const validationError = firstError(
      requireValue(scheduleForm.userId, "Nhân sự"),
      requireValue(scheduleForm.timeSlotId, "Ca làm"),
      validateDate(scheduleForm.workDate),
      validateTimeRange(scheduleForm.startTime, scheduleForm.endTime)
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setError("");
      setMessage("");
      await api.post("/admin/staff-schedules", {
        ...scheduleForm,
        roomId: scheduleForm.roomId || undefined
      });
      setMessage("Đã tạo lịch nhân sự.");
      await loadSchedules();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function updateScheduleStatus(id, status) {
    try {
      setError("");
      setMessage("");
      await api.patch(`/admin/staff-schedules/${id}`, { status });
      await loadSchedules();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function exportReport() {
    try {
      setError("");
      setMessage("");
      const res = await api.get("/admin/reports/export");
      setReport(res.data);
      downloadJson(res.data, "das-report.json");
      setMessage("Đã tạo file báo cáo JSON.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const assignableUsers = users.filter((user) => staffRoles.includes(user.role));

  return (
    <div className="page-grid">
      <Feedback error={error} message={message} />
      <FeatureTabs items={adminFeatures} active={activeFeature} onChange={setActiveFeature} />

      {activeFeature === "overview" && (
        <>
          {loading ? (
            <section className="panel">
              <EmptyState title="Đang tải thống kê" text="Hệ thống đang lấy dữ liệu mới nhất." />
            </section>
          ) : (
            <section className="metrics-grid">
              <Metric icon={BarChart3} label="Doanh thu" value={formatMoney(stats?.revenue || 0)} />
              <Metric icon={UsersRound} label="Bệnh nhân" value={stats?.patientCount || 0} />
              <Metric icon={ShieldCheck} label="Vắng mặt" value={stats?.noShowCount || 0} />
              <Metric icon={Settings2} label="Đánh giá" value={Number(stats?.review?.average || 0).toFixed(1)} />
            </section>
          )}

          <section className="panel">
            <div className="section-title">
              <ShieldCheck size={20} />
              <h2>Quan hệ kế thừa vai trò</h2>
            </div>
            {loading ? (
              <EmptyState title="Đang tải phân quyền" text="Hệ thống đang lấy dữ liệu mới nhất." />
            ) : (
            <div className="inheritance-grid">
              {roleHierarchy.map((role) => (
                <article className="inheritance-card" key={role.role}>
                  <strong>{role.label}</strong>
                  <span>{formatInheritanceChain(role.inheritanceChain, role.label)}</span>
                  <small>{role.abstract ? "Vai trò nền" : `Hồ sơ: ${formatProfileCollection(role.profileCollection)}`}</small>
                </article>
              ))}
            </div>
            )}
          </section>
        </>
      )}

      {activeFeature === "users" && (
        <>
          <section className="panel">
            <div className="section-title">
              <UsersRound size={20} />
              <h2>Tạo tài khoản</h2>
            </div>
            <form className="form-grid" onSubmit={createUser}>
              <label className="field">
                <span>Họ tên</span>
                <input value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} required />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
              </label>
              <label className="field">
                <span>Số điện thoại</span>
                <input value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
              </label>
              <label className="field">
                <span>Vai trò</span>
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                  <option value="patient">Bệnh nhân</option>
                  <option value="receptionist">Lễ tân</option>
                  <option value="dentist">Bác sĩ</option>
                  <option value="nurse">Y tá</option>
                  <option value="admin">Quản trị viên</option>
                </select>
              </label>
              <label className="field wide">
                <span>Chuyên môn</span>
                <input value={userForm.specialty} onChange={(e) => setUserForm({ ...userForm, specialty: e.target.value })} />
              </label>
              <button className="button secondary">Tạo tài khoản</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-title">
              <UsersRound size={20} />
              <h2>Tài khoản hệ thống</h2>
            </div>
            {loading ? (
              <EmptyState title="Đang tải tài khoản" text="Hệ thống đang lấy dữ liệu mới nhất." />
            ) : users.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tên</th>
                      <th>Email</th>
                      <th>Vai trò</th>
                      <th>Kế thừa</th>
                      <th>Trạng thái</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user._id}>
                        <td>{user.fullName}</td>
                        <td>{user.email}</td>
                        <td>{roleLabels[user.role] || user.role}</td>
                        <td>{formatInheritanceChain(user.inheritanceChain, user.role)}</td>
                        <td>
                          <StatusBadge value={user.status} />
                        </td>
                        <td>
                          <div className="row-actions account-actions">
                            <button className="button small ghost" type="button" onClick={() => resetUserPassword(user)} title="Đặt lại mật khẩu">
                              <KeyRound size={15} />
                              Đặt lại MK
                            </button>
                            <button
                              className="button small"
                              type="button"
                              onClick={() => updateUserStatus(user._id, user.status === "active" ? "inactive" : "active")}
                            >
                              {user.status === "active" ? "Ngưng" : "Kích hoạt"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState />
            )}
          </section>
        </>
      )}

      {activeFeature === "services" && (
        <>
          <section className="panel">
            <div className="section-title">
              <Settings2 size={20} />
              <h2>Thêm dịch vụ nha khoa</h2>
            </div>
            <form className="stack" onSubmit={createService}>
              <label className="field">
                <span>Tên dịch vụ</span>
                <input value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} required />
              </label>
              <label className="field">
                <span>Mô tả</span>
                <textarea value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} rows="3" />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>Thời lượng</span>
                  <input
                    type="number"
                    min="10"
                    value={serviceForm.durationMinutes}
                    onChange={(e) => setServiceForm({ ...serviceForm, durationMinutes: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Giá</span>
                  <input type="number" min="0" value={serviceForm.price} onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })} />
                </label>
              </div>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={serviceForm.requiresPrepayment}
                  onChange={(e) => setServiceForm({ ...serviceForm, requiresPrepayment: e.target.checked })}
                />
                <span>Thanh toán khi bệnh nhân đến khám</span>
              </label>
              <button className="button primary">Thêm dịch vụ</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-title">
              <Settings2 size={20} />
              <h2>Dịch vụ</h2>
            </div>
            {loading ? (
              <EmptyState title="Đang tải dịch vụ" text="Hệ thống đang lấy dữ liệu mới nhất." />
            ) : (
            <div className="mini-list">
              {services.map((service) => (
                <div className="mini-row" key={service._id}>
                  <span>{service.name}</span>
                  <span>{service.durationMinutes} phút</span>
                  <span>{formatMoney(service.price)}</span>
                </div>
              ))}
            </div>
            )}
          </section>
        </>
      )}

      {activeFeature === "rooms" && (
        <section className="panel">
          <div className="section-title">
            <DoorOpen size={20} />
            <h2>Phòng khám</h2>
          </div>
          <div className="mini-list">
            {loading ? (
              <EmptyState title="Đang tải phòng khám" text="Hệ thống đang lấy dữ liệu mới nhất." />
            ) : rooms.map((room) => (
              <div className="mini-row" key={room._id}>
                <span>{room.name}</span>
                <StatusBadge value={room.status} />
                <button className="button small" onClick={() => updateRoom(room._id, room.status === "maintenance" ? "available" : "maintenance")}>
                  {room.status === "maintenance" ? "Mở" : "Bảo trì"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeFeature === "workingHours" && (
        <>
          <section className="panel">
            <div className="section-title">
              <CalendarDays size={20} />
              <h2>Quản lý giờ làm phòng khám</h2>
            </div>
            <form className="form-grid" onSubmit={createWorkingHour}>
              <label className="field">
                <span>Ngày trong tuần</span>
                <select
                  value={workingHourForm.dayOfWeek}
                  onChange={(event) => setWorkingHourForm({ ...workingHourForm, dayOfWeek: event.target.value })}
                >
                  {Object.entries(dayNames).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Tên ca</span>
                <input value={workingHourForm.shiftName} onChange={(event) => setWorkingHourForm({ ...workingHourForm, shiftName: event.target.value })} />
              </label>
              <label className="field">
                <span>Bắt đầu</span>
                <input
                  type="time"
                  value={workingHourForm.startTime}
                  onChange={(event) => setWorkingHourForm({ ...workingHourForm, startTime: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Kết thúc</span>
                <input
                  type="time"
                  value={workingHourForm.endTime}
                  onChange={(event) => setWorkingHourForm({ ...workingHourForm, endTime: event.target.value })}
                />
              </label>
              <button className="button primary">Thêm giờ làm</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-title">
              <CalendarDays size={20} />
              <h2>Ca làm hiện tại</h2>
            </div>
            {loading ? (
              <EmptyState title="Đang tải giờ làm" text="Hệ thống đang lấy dữ liệu mới nhất." />
            ) : workingHours.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Ca</th>
                      <th>Giờ</th>
                      <th>Trạng thái</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {workingHours.map((item) => (
                      <tr key={item._id}>
                        <td>{dayNames[item.dayOfWeek]}</td>
                        <td>{item.shiftName}</td>
                        <td>
                          {item.startTime} - {item.endTime}
                        </td>
                        <td>
                          <StatusBadge value={item.status} />
                        </td>
                        <td>
                          <button
                            className="button small"
                            onClick={() => toggleWorkingHour(item._id, item.status === "active" ? "inactive" : "active")}
                          >
                            {item.status === "active" ? "Tạm ngưng" : "Kích hoạt"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState />
            )}
          </section>

          <section className="panel">
            <div className="section-title">
              <CalendarDays size={20} />
              <h2>Khung giờ dùng để xếp lịch</h2>
            </div>
            <div className="mini-list">
              {loading ? (
                <EmptyState title="Đang tải khung giờ" text="Hệ thống đang lấy dữ liệu mới nhất." />
              ) : timeSlots.map((slot) => (
                <div className="mini-row" key={slot._id}>
                  <span>{formatTimeSlotName(slot.slotName)}</span>
                  <span>
                    {slot.startTime} - {slot.endTime}
                  </span>
                  <span>10 phút chuyển phòng</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {activeFeature === "schedules" && (
        <>
          <section className="panel">
            <div className="section-title">
              <CalendarDays size={20} />
              <h2>Quản lý lịch nhân sự</h2>
            </div>
            <form className="form-grid" onSubmit={createSchedule}>
              <label className="field">
                <span>Nhân sự</span>
                <select value={scheduleForm.userId} onChange={(event) => setScheduleForm({ ...scheduleForm, userId: event.target.value })}>
                  <option value="">Chọn nhân sự</option>
                  {assignableUsers.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.fullName} - {roleLabels[user.role] || user.role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Phòng</span>
                <select value={scheduleForm.roomId} onChange={(event) => setScheduleForm({ ...scheduleForm, roomId: event.target.value })}>
                  <option value="">Không gán phòng</option>
                  {rooms.map((room) => (
                    <option key={room._id} value={room._id}>
                      {room.name} - {room.status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Ngày làm</span>
                <input type="date" value={scheduleForm.workDate} onChange={(event) => setScheduleForm({ ...scheduleForm, workDate: event.target.value })} />
              </label>
              <label className="field">
                <span>Ca làm</span>
                <select
                  value={scheduleForm.timeSlotId}
                  onChange={(event) => {
                    const slot = timeSlots.find((item) => item._id === event.target.value);
                    setScheduleForm({
                      ...scheduleForm,
                      timeSlotId: event.target.value,
                      startTime: slot?.startTime || scheduleForm.startTime,
                      endTime: slot?.endTime || scheduleForm.endTime
                    });
                  }}
                >
                  <option value="">Chọn ca</option>
                  {timeSlots.map((slot) => (
                    <option key={slot._id} value={slot._id}>
                      {formatTimeSlotName(slot.slotName)} ({slot.startTime} - {slot.endTime})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Bắt đầu</span>
                <input type="time" value={scheduleForm.startTime} onChange={(event) => setScheduleForm({ ...scheduleForm, startTime: event.target.value })} />
              </label>
              <label className="field">
                <span>Kết thúc</span>
                <input type="time" value={scheduleForm.endTime} onChange={(event) => setScheduleForm({ ...scheduleForm, endTime: event.target.value })} />
              </label>
              <button className="button primary">Tạo lịch</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-title">
              <CalendarDays size={20} />
              <h2>Lịch làm việc</h2>
            </div>
            {!schedulesLoaded ? (
              <EmptyState title="Đang tải lịch nhân sự" text="Hệ thống đang lấy dữ liệu mới nhất." />
            ) : schedules.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Nhân sự</th>
                      <th>Vai trò</th>
                      <th>Ca</th>
                      <th>Phòng</th>
                      <th>Trạng thái</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((schedule) => (
                      <tr key={schedule._id}>
                        <td>{formatDate(schedule.workDate)}</td>
                        <td>{schedule.user?.fullName || "-"}</td>
                        <td>{roleLabels[schedule.user?.role] || schedule.user?.role || "-"}</td>
                        <td>
                          {schedule.startTime} - {schedule.endTime}
                        </td>
                        <td>{schedule.room?.name || "-"}</td>
                        <td>
                          <StatusBadge value={schedule.status} />
                        </td>
                        <td>
                          <div className="row-actions">
                            <button className="button small" onClick={() => updateScheduleStatus(schedule._id, "completed")}>
                              Hoàn tất
                            </button>
                            <button className="button small ghost" onClick={() => updateScheduleStatus(schedule._id, "off")}>
                              Nghỉ
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState />
            )}
          </section>
        </>
      )}

      {activeFeature === "reports" && (
        <>
          <section className="metrics-grid">
            <Metric icon={BarChart3} label="Doanh thu đã thu" value={formatMoney(stats?.revenue || 0)} />
            <Metric icon={UsersRound} label="Bệnh nhân" value={stats?.patientCount || 0} />
            <Metric icon={ShieldCheck} label="Vắng mặt" value={stats?.noShowCount || 0} />
            <Metric icon={Settings2} label="Đánh giá TB" value={Number(stats?.review?.average || 0).toFixed(1)} />
          </section>

          <section className="panel">
            <div className="section-title">
              <Download size={20} />
              <h2>Xuất báo cáo</h2>
            </div>
            <div className="stack">
              <p className="muted">Báo cáo gồm doanh thu, thống kê bệnh nhân, đánh giá, vắng mặt và tổng lịch hẹn.</p>
              <button className="button primary" onClick={exportReport}>
                <Download size={18} />
                Tải báo cáo JSON
              </button>
              {report && (
                <div className="table-wrap">
                  <table>
                    <tbody>
                      <tr>
                        <th>Thời điểm</th>
                        <td>{formatDateTime(report.generatedAt)}</td>
                      </tr>
                      <tr>
                        <th>Tổng lịch hẹn</th>
                        <td>{report.appointments}</td>
                      </tr>
                      <tr>
                        <th>Vắng mặt</th>
                        <td>{report.noShowCount}</td>
                      </tr>
                      <tr>
                        <th>Đánh giá</th>
                        <td>
                          {Number(report.reviewSummary?.average || 0).toFixed(1)} ({report.reviewSummary?.count || 0} lượt)
                        </td>
                      </tr>
                      <tr>
                        <th>Hóa đơn</th>
                        <td>{summarizeInvoices(report.invoiceSummary)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <article className="metric-card">
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function validateTimeRange(startTime, endTime) {
  if (!timePattern.test(startTime) || !timePattern.test(endTime)) return "Giờ phải theo định dạng HH:mm.";
  if (startTime >= endTime) return "Giờ bắt đầu phải trước giờ kết thúc.";
  if (!clinicSessions.some((session) => startTime >= session.start && endTime <= session.end)) {
    return "Thời gian phải nằm trong ca sáng 07:00 - 11:30 hoặc ca chiều 13:30 - 17:30.";
  }
  return "";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("vi-VN");
}

function summarizeInvoices(items = []) {
  if (!items.length) return "Chưa có hóa đơn";
  return items.map((item) => `${item._id}: ${formatMoney(item.total)} (${item.count})`).join(", ");
}

function formatProfileCollection(value) {
  const labels = {
    patients: "Bệnh nhân",
    receptionists: "Lễ tân",
    dentists: "Bác sĩ",
    nurses: "Y tá",
    adminprofiles: "Quản trị viên"
  };
  return labels[value] || value || "-";
}

function formatTimeSlotName(value) {
  const labels = {
    Morning: "Ca sáng",
    Afternoon: "Ca chiều",
    "Morning Shift": "Ca sáng",
    "Afternoon Shift": "Ca chiều"
  };
  return labels[value] || value;
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
