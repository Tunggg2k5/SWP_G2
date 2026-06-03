# DAS Dental Appointment System

Full-stack project based on `DAS System Requirements (1).docx`.

## Tech stack

- React + Vite for the frontend
- Express.js for the API
- MongoDB + Mongoose for persistence
- JWT role-based access control

## Main implemented scope

- Guest clinic/service/dentist browsing and patient account registration
- Patient online booking by service, dentist and available slot; appointment history, cancel/reschedule before 24 hours
- Receptionist appointment confirmation/rejection, assisted booking, check-in, no-show handling and payment recording
- Dentist work schedule, patient list and treatment result recording
- Nurse clinical support, vital signs, treatment notes and room status updates
- Admin/Manager master data, dashboard, revenue report and patient statistics

## Functional modules by role

Guest:

- View clinic information, working hours and dental services
- View dentist profiles
- Register patient account
- Login or request password reset

Patient:

- Book appointment by service, dentist and available slot
- View appointment history and treatment history
- Reschedule or cancel appointment before 24 hours
- Invoice and payment
- Review and rating
- Notifications

Receptionist:

- Daily appointment board
- Confirm or reject appointment
- Check-in patient, cancel/reschedule on behalf of patient, no-show handling
- Create/search patient account
- Offline booking for patients
- Consultation request management
- Clinic room status overview

Dentist:

- Manage or view weekly work schedule
- View assigned patient list and treatment history
- Record diagnosis, treatment result, treatment plan and prescription

Nurse:

- View assigned work schedule
- Record vital signs and clinical support notes
- Support treatment plan updates
- Update clinic room status

Admin/Manager:

- Account management
- Dental service management
- Dentist and nurse profile management
- Clinic room management
- Clinic information and working-hour management
- Appointment dashboard, revenue report and patient statistics

## Use case baseline

The project follows **Đề Tài A: Hệ Thống Đặt Lịch Phòng Khám Nha Khoa** with 30 baseline use cases:

| ID | Workflow | Actor | Use case |
| --- | --- | --- | --- |
| UCA01 | WF0 Authentication & Authorization | Guest | Register Patient |
| UCA02 | WF0 Authentication & Authorization | User | Login / Logout |
| UCA03 | WF0 Authentication & Authorization | User | Forgot Password |
| UCA04 | WF0 Authentication & Authorization | User | Profile Management |
| UCA05 | WF0 Authentication & Authorization | User | Notification Management |
| UCA06 | WF1 Master Data Setup | Guest | View Clinic Info & Services |
| UCA07 | WF1 Master Data Setup | Admin | Manage Dental Services |
| UCA08 | WF1 Master Data Setup | Admin | Manage Dentist Profiles |
| UCA09 | WF1 Master Data Setup | Admin | Manage Nurse Profiles |
| UCA10 | WF1 Master Data Setup | Admin | Manage Clinic Info |
| UCA11 | WF1 Master Data Setup | Admin | Manage Clinic Rooms |
| UCA12 | WF1 Master Data Setup | Dentist / Nurse | Manage Work Schedule |
| UCA13 | WF2 Core Transaction Flow | Patient | Book Appointment |
| UCA14 | WF2 Core Transaction Flow | Patient | View Appointment History |
| UCA15 | WF2 Core Transaction Flow | Receptionist | Confirm Appointment |
| UCA16 | WF2 Core Transaction Flow | Receptionist | Reject Appointment |
| UCA17 | WF2 Core Transaction Flow | Receptionist | Check-in Patient |
| UCA18 | WF2 Core Transaction Flow | Dentist | Record Treatment Result |
| UCA19 | WF2 Core Transaction Flow | Nurse | Record Vital Signs |
| UCA20 | WF2 Core Transaction Flow | Dentist / Nurse | Manage Treatment Plan |
| UCA21 | WF2 Core Transaction Flow | Dentist | Prescribe Medicine |
| UCA22 | WF2 Core Transaction Flow | Patient / Receptionist | Cancel Appointment before 24h |
| UCA23 | WF2 Core Transaction Flow | Patient / Receptionist | Reschedule Appointment |
| UCA24 | WF2 Core Transaction Flow | Receptionist | Handle No-Show |
| UCA25 | WF2 Core Transaction Flow | Receptionist | Process Invoice / Payment |
| UCA26 | WF2 Core Transaction Flow | Patient | Review Service |
| UCA27 | WF3 Dashboard & Reporting | Receptionist / Admin | Appointment Dashboard |
| UCA28 | WF3 Dashboard & Reporting | Admin | Revenue Report |
| UCA29 | WF3 Dashboard & Reporting | Admin | Patient Statistics |
| UCA30 | WF3 Dashboard & Reporting | Admin | Service & Staff Statistics |

## Role model

The project keeps a shared `User` account and role-specific profile collections for authorization and actor behavior:

- `User` is the base account entity.
- `Patient` stores patient-specific fields in `patients`.
- `Receptionist` stores receptionist-specific fields in `receptionists`.
- `Clinical Staff` is an internal group for dentist and nurse permissions.
- `Dentist` stores dentist-specific fields in `dentists`.
- `Nurse` stores nurse-specific fields in `nurses`.
- `Admin/Manager` stores admin-specific fields in `adminprofiles`.

At runtime, users include an `inheritanceChain` field, for example:

```json
{
  "role": "dentist",
  "inheritanceChain": ["User", "Clinical Staff", "Dentist"],
  "profileCollection": "dentists"
}
```

The `roles` collection stores abstract permission groups (`user`, `clinical_staff`) and concrete roles (`patient`, `receptionist`, `dentist`, `nurse`, `admin`) so authorization remains explicit in the database and admin UI.

## ERD coverage

The backend includes the ERD collections from `DAS ERD - Final Version.docx`, plus abstract-role metadata in the `roles` collection:

`roles`, `users`, `patients`, `receptionists`, `dentists`, `nurses`, `adminprofiles`, `clinicworkinghours`, `timeslots`, `staffschedules`, `dentalservices`, `dentistservices`, `clinicrooms`, `roomstatuses`, `appointmentslots`, `appointments`, `consultationrequests`, `treatmentrecords`, `treatmentplans`, `prescriptions`, `invoices`, `payments`, `reviews`, and `notifications`.

Some API responses keep the original frontend-friendly shape, while the database now stores the ERD support collections and references needed for role profiles, staff schedules, room status history, appointment slots, treatment plans, prescriptions, payments, and notifications.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start MongoDB:

```bash
docker compose up -d mongo
```

If you already have MongoDB running, skip Docker and use your own connection string.

3. Configure environment when you need custom values:

```bash
copy server\.env.example server\.env
```

Without `server\.env`, the API defaults to `mongodb://127.0.0.1:27017/das` and a local development JWT secret.

4. Seed demo data:

```bash
npm run seed
```

The seed recreates all ERD collections, including 5 rooms, 8 dentists, 8 nurses, 4 receptionists, role profiles, working hours, staff schedules, dentist-service mapping, appointment slots, and demo operational records.

5. Start the app:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

API: `http://localhost:4000/api`

## Deploy to Vercel

This repository is configured for Vercel:

- `client/dist` is the static frontend output.
- `api/index.js` adapts the Express app to a Vercel Serverless Function.
- `vercel.json` rewrites `/api/*` through the API adapter and all other routes to the React SPA.

Use MongoDB Atlas or another hosted MongoDB instance. Local MongoDB at `127.0.0.1` will not be reachable from Vercel.

Required Vercel environment variables:

```bash
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=7d
```

Optional:

```bash
CLIENT_ORIGIN=https://your-project.vercel.app
```

Do not set `VITE_API_URL` for the normal Vercel deployment. The frontend calls the same-origin `/api` path by default.

### Deploy through the Vercel dashboard

1. Push this project to GitHub.
2. In Vercel, create a new project and import the GitHub repository.
3. Keep the project root as the repository root.
4. Vercel will use `vercel.json`:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `client/dist`
5. Add the environment variables above in Project Settings.
6. Deploy.

### Deploy with Vercel CLI

```bash
npm install -g vercel
vercel login
vercel link
vercel env add MONGODB_URI production
vercel env add JWT_SECRET production
vercel env add JWT_EXPIRES_IN production
vercel deploy --prod
```

### Seed production data

After creating the Atlas database, seed it from your machine by pointing `MONGODB_URI` to Atlas:

```powershell
$env:MONGODB_URI="mongodb+srv://..."
npm run seed
```

This creates the demo users, rooms, services, schedules, role hierarchy, and ERD collections in the hosted database.

## Demo accounts

All seeded users use password `Password123!`.

- Admin: `0900000000`
- Receptionist: `0901000001`
- Dentist: `0902000001`
- Nurse: `0903000001`
- Patient: `0911000001`

## Scheduling rules from the document

- Clinic works Monday to Saturday, closed Sunday.
- Morning session: 07:00-11:30.
- Afternoon session: 13:30-17:30.
- Booking flow: Patient selects service, dentist, available slot, then confirms.
- Available appointment start times are generated on a 30-minute slot grid inside working sessions.
- Service duration is still respected by selected service, and each appointment reserves a 10-minute turnover buffer after the service.
- Patients with appointments before 08:00 arrive at the displayed time.
- Patients with appointments at or after 08:00 arrive 1 hour early.
- Receptionist confirmation/contact deadline is 12 hours.
- Patient or receptionist cancel/reschedule is allowed only at least 24 hours before appointment time.
- No-show is handled when the patient has not checked in after the arrival/check-in time.
