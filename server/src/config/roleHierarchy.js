export const ROLE_HIERARCHY = {
  user: {
    label: "Người dùng",
    parent: null,
    abstract: true,
    description: "Thực thể tài khoản nền có đăng nhập, hồ sơ, thông báo và mật khẩu."
  },
  clinical_staff: {
    label: "Nhân sự lâm sàng",
    parent: "user",
    abstract: true,
    description: "Nhóm vai trò lâm sàng có thể xem lịch làm việc và thông tin bệnh nhân."
  },
  patient: {
    label: "Bệnh nhân",
    parent: "user",
    abstract: false,
    profileCollection: "patients",
    description: "Bệnh nhân kế thừa từ Người dùng."
  },
  receptionist: {
    label: "Lễ tân",
    parent: "user",
    abstract: false,
    profileCollection: "receptionists",
    description: "Lễ tân kế thừa từ Người dùng."
  },
  dentist: {
    label: "Bác sĩ",
    parent: "clinical_staff",
    abstract: false,
    profileCollection: "dentists",
    description: "Bác sĩ kế thừa từ Nhân sự lâm sàng, sau đó kế thừa từ Người dùng."
  },
  nurse: {
    label: "Y tá",
    parent: "clinical_staff",
    abstract: false,
    profileCollection: "nurses",
    description: "Y tá kế thừa từ Nhân sự lâm sàng, sau đó kế thừa từ Người dùng."
  },
  admin: {
    label: "Quản trị viên",
    parent: "user",
    abstract: false,
    profileCollection: "adminprofiles",
    description: "Quản trị viên kế thừa từ Người dùng."
  }
};

export function getInheritanceChain(roleName) {
  const chain = [];
  let current = roleName;

  while (current && ROLE_HIERARCHY[current]) {
    chain.unshift(ROLE_HIERARCHY[current].label);
    current = ROLE_HIERARCHY[current].parent;
  }

  return chain;
}

export function getConcreteRoles() {
  return Object.entries(ROLE_HIERARCHY)
    .filter(([, value]) => !value.abstract)
    .map(([key]) => key);
}

export function getRoleHierarchyList() {
  return Object.entries(ROLE_HIERARCHY).map(([key, value]) => ({
    role: key,
    ...value,
    inheritanceChain: getInheritanceChain(key)
  }));
}
