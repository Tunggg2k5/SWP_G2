import Appointment from "../models/Appointment.js";
import AppointmentSlot from "../models/AppointmentSlot.js";
import ClinicRoom from "../models/ClinicRoom.js";
import DentalService from "../models/DentalService.js";
import DentistService from "../models/DentistService.js";
import User from "../models/User.js";
import {
  WORKING_SESSIONS,
  TURNOVER_MINUTES,
  addMinutes,
  assertTwelveHourRule,
  calculateArrivalAt,
  combineDateAndTime,
  endOfLocalDay,
  isWorkingDate,
  minutesBetween,
  startOfLocalDay
} from "../utils/time.js";

const BLOCKING_STATUSES = ["scheduled", "confirmed", "checked_in", "in_treatment"];

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function sameId(a, b) {
  return a?.toString() === b?.toString();
}

function hasTimeConflict(appointments, startAt, endAt) {
  return appointments.some((appointment) => {
    const blockedEnd = addMinutes(appointment.endAt, TURNOVER_MINUTES);
    return startAt < blockedEnd && endAt > appointment.startAt;
  });
}

function hasDirectTimeConflict(appointments, startAt, endAt) {
  return appointments.some((appointment) => startAt < appointment.endAt && endAt > appointment.startAt);
}

async function getAppointmentsForDate(date, excludeAppointmentId) {
  const query = {
    status: { $in: BLOCKING_STATUSES },
    startAt: { $lt: endOfLocalDay(date) },
    endAt: { $gt: startOfLocalDay(date) }
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  return Appointment.find(query).sort({ startAt: 1 }).lean();
}

async function getPatientAppointmentsForDate(patientId, date, excludeAppointmentId) {
  const query = {
    patient: patientId,
    status: { $in: BLOCKING_STATUSES },
    startAt: { $lt: endOfLocalDay(date) },
    endAt: { $gt: startOfLocalDay(date) }
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  return Appointment.find(query).select("startAt endAt").sort({ startAt: 1 }).lean();
}

async function assertPatientHasNoTimeConflict(patientId, startAt, endAt, excludeAppointmentId, knownAppointments) {
  if (knownAppointments && hasDirectTimeConflict(knownAppointments, startAt, endAt)) {
    throw httpError("Bệnh nhân đã có lịch hẹn trùng thời gian.", 409);
  }

  const query = {
    patient: patientId,
    status: { $in: BLOCKING_STATUSES },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt }
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  const existing = await Appointment.findOne(query)
    .select("startAt endAt")
    .lean();

  if (existing) {
    throw httpError("Bệnh nhân đã có lịch hẹn trùng thời gian.", 409);
  }
}

async function assertAppointmentResourcesAvailable({ patientId, dentistId, nurseId, roomId, startAt, endAt, excludeAppointmentId }) {
  const resourceChecks = [
    { room: roomId },
    { dentist: dentistId },
    { patient: patientId }
  ];

  if (nurseId) {
    resourceChecks.push({ nurse: nurseId });
  }

  const query = {
    status: { $in: BLOCKING_STATUSES },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
    $or: resourceChecks
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  const conflict = await Appointment.findOne(query).select("room dentist nurse patient").lean();
  if (!conflict) return;

  if (sameId(conflict.patient, patientId)) {
    throw httpError("Bệnh nhân đã có lịch hẹn trùng thời gian.", 409);
  }
  if (sameId(conflict.room, roomId)) {
    throw httpError("Phòng khám đã có lịch hẹn trùng thời gian.", 409);
  }
  if (sameId(conflict.dentist, dentistId)) {
    throw httpError("Bác sĩ đã có lịch hẹn trùng thời gian.", 409);
  }
  if (nurseId && sameId(conflict.nurse, nurseId)) {
    throw httpError("Y tá đã có lịch hẹn trùng thời gian.", 409);
  }
}

export async function findAvailableSlots({ date, serviceId, excludeAppointmentId }) {
  if (!isWorkingDate(date)) {
    return [];
  }

  const service = await DentalService.findById(serviceId).lean();
  if (!service || !service.isActive) {
    throw httpError("Không tìm thấy dịch vụ nha khoa.", 404);
  }

  const dentistServices = await DentistService.find({ service: serviceId }).lean();
  const capableDentistIds = new Set(dentistServices.map((item) => item.dentist.toString()));

  const [rooms, appointments] = await Promise.all([
    ClinicRoom.find({
      isActive: true,
      status: { $ne: "maintenance" }
    })
      .populate("assignedDentist", "fullName specialty yearsOfExperience bio email phone")
      .lean(),
    getAppointmentsForDate(date, excludeAppointmentId)
  ]);

  const slots = [];

  for (const room of rooms) {
    if (!room.assignedDentist) continue;
    if (capableDentistIds.size && !capableDentistIds.has(room.assignedDentist._id.toString())) continue;

    const roomAppointments = appointments.filter((item) => sameId(item.room, room._id));
    const dentistAppointments = appointments.filter((item) => sameId(item.dentist, room.assignedDentist._id));

    for (const session of WORKING_SESSIONS) {
      const sessionStart = combineDateAndTime(date, session.start);
      const sessionEnd = combineDateAndTime(date, session.end);
      let pointer = sessionStart;

      const sessionAppointments = roomAppointments.filter(
        (item) => item.startAt < sessionEnd && item.endAt > sessionStart
      );

      for (const appointment of sessionAppointments) {
        if (appointment.startAt > pointer && minutesBetween(pointer, appointment.startAt) >= service.durationMinutes) {
          const startAt = pointer;
          const endAt = addMinutes(startAt, service.durationMinutes);

          if (!hasTimeConflict(dentistAppointments, startAt, endAt)) {
            slots.push(buildSlot({ room, service, startAt, endAt, session }));
          }
        }

        const blockedEnd = addMinutes(appointment.endAt, service.transitionTime ?? TURNOVER_MINUTES);
        if (blockedEnd > pointer) {
          pointer = blockedEnd;
        }
      }

      if (minutesBetween(pointer, sessionEnd) >= service.durationMinutes) {
        const startAt = pointer;
        const endAt = addMinutes(startAt, service.durationMinutes);

        if (!hasTimeConflict(dentistAppointments, startAt, endAt)) {
          slots.push(buildSlot({ room, service, startAt, endAt, session }));
        }
      }
    }
  }

  return slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

function buildSlot({ room, service, startAt, endAt, session }) {
  return {
    startAt,
    endAt,
    arrivalAt: calculateArrivalAt(startAt),
    session: session.label,
    turnoverMinutes: service.transitionTime ?? TURNOVER_MINUTES,
    service: {
      _id: service._id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      transitionTime: service.transitionTime ?? TURNOVER_MINUTES,
      price: service.price,
      requiresPrepayment: service.requiresPrepayment
    },
    room: {
      _id: room._id,
      name: room.name,
      status: room.status,
      equipment: room.equipment
    },
    dentist: room.assignedDentist
  };
}

async function selectAvailableNurse(startAt, endAt, date) {
  const [nurses, appointments] = await Promise.all([
    User.find({ role: "nurse", status: "active" }).sort({ fullName: 1 }).lean(),
    getAppointmentsForDate(date)
  ]);

  return nurses.find((nurse) => {
    const nurseAppointments = appointments.filter((item) => sameId(item.nurse, nurse._id));
    return !hasTimeConflict(nurseAppointments, startAt, endAt);
  });
}

export async function createAppointmentFromSlot({ requester, patientId, serviceId, date, startAt, roomId, channel, note }) {
  const patient = await User.findById(patientId).lean();
  if (!patient || patient.role !== "patient") {
    throw httpError("Không tìm thấy tài khoản bệnh nhân.", 404);
  }

  const requestedStart = startAt ? new Date(startAt) : null;
  const [slots, patientAppointments] = await Promise.all([
    findAvailableSlots({ date, serviceId }),
    getPatientAppointmentsForDate(patient._id, date)
  ]);
  const selected = requestedStart
    ? slots.find(
        (slot) =>
          slot.startAt.getTime() === requestedStart.getTime() &&
          (!roomId || sameId(slot.room._id, roomId))
      )
    : slots.find((slot) => !hasDirectTimeConflict(patientAppointments, slot.startAt, slot.endAt));

  if (!selected) {
    throw httpError("Không còn lịch trống phù hợp với dịch vụ hoặc ngày đã chọn.", 409);
  }

  await assertPatientHasNoTimeConflict(patient._id, selected.startAt, selected.endAt, undefined, patientAppointments);

  const nurse = await selectAvailableNurse(selected.startAt, selected.endAt, date);
  const service = await DentalService.findById(serviceId).lean();
  await assertAppointmentResourcesAvailable({
    patientId: patient._id,
    dentistId: selected.dentist._id,
    nurseId: nurse?._id,
    roomId: selected.room._id,
    startAt: selected.startAt,
    endAt: selected.endAt
  });

  const appointmentSlot = await AppointmentSlot.create({
    dentist: selected.dentist._id,
    room: selected.room._id,
    slotDate: selected.startAt,
    startAt: selected.startAt,
    endAt: selected.endAt,
    status: "booked"
  });

  return Appointment.create({
    patient: patient._id,
    createdBy: requester._id,
    dentist: selected.dentist._id,
    receptionist: ["receptionist", "admin"].includes(requester.role) ? requester._id : undefined,
    nurse: nurse?._id,
    room: selected.room._id,
    service: selected.service._id,
    appointmentSlot: appointmentSlot._id,
    channel,
    bookingType: channel,
    startAt: selected.startAt,
    endAt: selected.endAt,
    arrivalAt: selected.arrivalAt,
    paymentStatus: service.requiresPrepayment ? "pending_checkin" : "not_required",
    patientNote: note
  });
}

export async function rescheduleAppointmentFromSlot({ appointment, serviceId, date, startAt, roomId }) {
  assertTwelveHourRule(appointment.startAt);

  const requestedStart = startAt ? new Date(startAt) : null;
  const targetServiceId = serviceId || appointment.service.toString();
  const [slots, patientAppointments] = await Promise.all([
    findAvailableSlots({
      date,
      serviceId: targetServiceId,
      excludeAppointmentId: appointment._id
    }),
    getPatientAppointmentsForDate(appointment.patient, date, appointment._id)
  ]);

  const selected = requestedStart
    ? slots.find(
        (slot) =>
          slot.startAt.getTime() === requestedStart.getTime() &&
          (!roomId || sameId(slot.room._id, roomId))
      )
    : slots.find((slot) => !hasDirectTimeConflict(patientAppointments, slot.startAt, slot.endAt));

  if (!selected) {
    throw httpError("Không còn lịch trống phù hợp để đổi lịch.", 409);
  }

  await assertPatientHasNoTimeConflict(appointment.patient, selected.startAt, selected.endAt, appointment._id, patientAppointments);
  const nurse = await selectAvailableNurse(selected.startAt, selected.endAt, date);
  await assertAppointmentResourcesAvailable({
    patientId: appointment.patient,
    dentistId: selected.dentist._id,
    nurseId: nurse?._id,
    roomId: selected.room._id,
    startAt: selected.startAt,
    endAt: selected.endAt,
    excludeAppointmentId: appointment._id
  });

  if (appointment.appointmentSlot) {
    await AppointmentSlot.findByIdAndUpdate(appointment.appointmentSlot, { status: "cancelled" });
  }
  const appointmentSlot = await AppointmentSlot.create({
    dentist: selected.dentist._id,
    room: selected.room._id,
    slotDate: selected.startAt,
    startAt: selected.startAt,
    endAt: selected.endAt,
    status: "booked"
  });

  appointment.service = selected.service._id;
  appointment.room = selected.room._id;
  appointment.dentist = selected.dentist._id;
  appointment.nurse = nurse?._id;
  appointment.appointmentSlot = appointmentSlot._id;
  appointment.startAt = selected.startAt;
  appointment.endAt = selected.endAt;
  appointment.arrivalAt = selected.arrivalAt;
  appointment.status = "scheduled";
  return appointment.save();
}
