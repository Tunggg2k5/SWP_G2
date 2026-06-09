import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("das_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getErrorMessage(error) {
  const data = error?.response?.data;

  if (Array.isArray(data?.details) && data.details[0]?.message) {
    const field = data.details[0]?.path?.join?.(".");
    return field ? `${field}: ${data.details[0].message}` : data.details[0].message;
  }

  if (error.message === "Network Error") return "Không thể kết nối đến máy chủ.";

  return data?.message || error.message || "Đã có lỗi xảy ra";
}
