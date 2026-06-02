# DAS Dental Appointment System

Full-stack project based on `DAS System Requirements (1).docx`.

## Tech stack

- React + Vite for the frontend
- Express.js for the API
- MongoDB + Mongoose for persistence
- JWT role-based access control

## Main implemented scope

- Guest service browsing, dentist profiles, clinic room availability, consultation request
- Patient booking with dynamic service duration, 10-minute turnover buffer, arrival-time rule, cancel/reschedule 12-hour rule, waitlist
- Receptionist appointment board, offline booking support, check-in/no-show/status updates, waitlist handling, consultation management
- Dentist/Nurse clinical schedule and treatment record updates
- Admin overview, service/room/account management surfaces, revenue and appointment statistics

## Functional modules by role

Guest:

- View dental services
- View dentist profiles
- View clinic room information
- Create consultation request
- Register or login before booking

Patient:

- Appointment management: book, view, reschedule, cancel
- Waitlist management
- Invoice and payment
- Treatment record, treatment plan, and prescription viewing
- Review and rating
- Notifications

Receptionist:

- Daily appointment board
- Appointment status update, check-in, no-show handling
- Create/search patient account
- Offline booking for patients
- Consultation request management
- Waitlist follow-up
- Clinic room status overview

Clinical staff:

- Work schedule
- Patient appointment information
- Vital signs, diagnosis, treatment note, treatment result
- Treatment plan and prescription updates
- Room status update for nurses

Admin:

- Revenue, patient, no-show, and rating statistics
- Account management
- Dental service management
- Clinic room management

## Inheritance model

The requirements document defines actor inheritance separately from the ERD profile-table relationships. The project now represents both:

- `User` is the base account entity.
- `Patient` inherits from `User` and stores patient-specific fields in `patients`.
- `Receptionist` inherits from `User` and stores receptionist-specific fields in `receptionists`.
- `Clinical Staff` inherits from `User` and is represented as an abstract role.
- `Dentist` inherits from `Clinical Staff`, then `User`, and stores dentist-specific fields in `dentists`.
- `Nurse` inherits from `Clinical Staff`, then `User`, and stores nurse-specific fields in `nurses`.
- `Admin` inherits from `User` and stores admin-specific fields in `adminprofiles`.

At runtime, users include an `inheritanceChain` field, for example:

```json
{
  "role": "dentist",
  "inheritanceChain": ["User", "Clinical Staff", "Dentist"],
  "profileCollection": "dentists"
}
```

The `roles` collection also stores abstract roles (`user`, `clinical_staff`) and concrete roles (`patient`, `receptionist`, `dentist`, `nurse`, `admin`) so the inheritance hierarchy is visible in the database and admin UI.

## ERD coverage

The backend includes the 25 ERD collections from `DAS ERD - Final Version.docx`, plus abstract-role metadata in the `roles` collection:

`roles`, `users`, `patients`, `receptionists`, `dentists`, `nurses`, `adminprofiles`, `clinicworkinghours`, `timeslots`, `staffschedules`, `dentalservices`, `dentistservices`, `clinicrooms`, `roomstatuses`, `appointmentslots`, `appointments`, `waitlistentries`, `consultationrequests`, `treatmentrecords`, `treatmentplans`, `prescriptions`, `invoices`, `payments`, `reviews`, and `notifications`.

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

- Admin: `admin@das.local`
- Receptionist: `receptionist1@das.local`
- Dentist: `dentist1@das.local`
- Nurse: `nurse1@das.local`
- Patient: `patient1@das.local`

## Scheduling rules from the document

- Clinic works Monday to Saturday, closed Sunday.
- Morning session: 07:00-11:30.
- Afternoon session: 13:30-17:30.
- Service duration is dynamic by selected service, not fixed hourly slots.
- Each appointment reserves a 10-minute turnover buffer after the service.
- Patients with appointments before 08:00 arrive at the displayed time.
- Patients with appointments at or after 08:00 arrive 1 hour early.
- Receptionist confirmation/contact deadline is 12 hours.
- Patient cancel/reschedule is allowed only at least 12 hours before appointment time.
