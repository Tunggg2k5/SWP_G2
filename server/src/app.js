import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import adminRoutes from "./routes/adminRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import clinicalRoutes from "./routes/clinicalRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import receptionRoutes from "./routes/receptionRoutes.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
if (process.env.NODE_ENV !== "production" || process.env.ENABLE_HTTP_LOGS === "true") {
  app.use(morgan("dev"));
}

app.use("/api", publicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/reception", receptionRoutes);
app.use("/api/clinical", clinicalRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
