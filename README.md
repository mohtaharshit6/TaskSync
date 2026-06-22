# TaskSync

A full-stack, real-time **collaborative task management** application — think a lightweight Trello with live updates, team chat, and role-based access control.

Teams create projects, invite members with a code, and manage work on a Kanban board (To Do / In Progress / Done) where changes appear **instantly for everyone** via WebSockets. Tasks support priorities, due dates, assignees, labels, subtask checklists, comments with @mentions, and a full activity log.

> Built as a CodeAlpha internship project.

---

## ✨ Features

- **Authentication** — register, email-OTP verification, login, and OTP-based password reset
- **Projects & roles** — create projects, invite members via code, with **admin / member** role-based permissions
- **Kanban board** — drag tasks across To Do → In Progress → Done; only an admin can move a completed task back
- **Rich tasks** — priority, due dates (with overdue flags), assignee, color labels, subtask checklists
- **Real-time collaboration** — task moves, edits, new members, and chat all update live via Socket.io
- **Comments with @mentions** — mention teammates in task discussions and notify them
- **Per-project chat** — team chat panel with admin freeze and a 10-second undo on delete
- **Notifications** — in-app bell with unread counts (task assigned, moved, mentioned)
- **My Tasks** — cross-project view of everything assigned to you
- **Dark mode** — persisted, with no flash on reload
- **Responsive** — works on mobile, tablet, and desktop

---

## 🛠 Tech Stack

**Frontend**
- React 18 + Vite
- React Router 6
- Tailwind CSS
- Axios (with silent token-refresh interceptor)
- Socket.io client

**Backend**
- Node.js + Express
- Prisma ORM + PostgreSQL
- JWT auth (access + rotating refresh tokens)
- Socket.io (real-time)
- bcrypt, Helmet, express-rate-limit, express-validator

**Deployment**
- Frontend on Vercel · Backend + PostgreSQL on Render · Email via Brevo HTTP API

---

## 🏗 Architecture

```
TaskSync/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Data model (User, Project, Task, Comment, …)
│   │   └── migrations/
│   ├── src/
│   │   ├── routes/                # Express route definitions
│   │   ├── controllers/           # Request handlers / business logic
│   │   ├── middleware/            # Auth, project-membership, roles, rate limiting, errors
│   │   ├── validators/            # express-validator input rules
│   │   ├── services/              # Email (Brevo)
│   │   └── socket.js              # Socket.io setup + handshake auth
│   └── server.js                  # App entry point
│
└── frontend/
    └── src/
        ├── components/            # Auth, Dashboard, Project, Task, Comment, Layout, UI
        ├── pages/                 # MyTasks, VerifyEmail, ForgotPassword, …
        ├── context/               # AuthContext, SocketContext
        ├── api/api.js             # Axios instance + token-refresh logic
        └── hooks/                 # useDarkMode
```

**Request flow (backend):** `route → authMiddleware → requireProjectMember → requireProjectRole → validate → controller`. A single membership lookup is reused downstream to avoid redundant queries.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (local or hosted)

### 1. Clone
```bash
git clone https://github.com/mohtaharshit6/TaskSync.git
cd TaskSync
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env        # then edit .env (see below)
npx prisma migrate dev      # create the database schema
npm run dev                 # starts on http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                 # starts on http://localhost:5173
```

The Vite dev server proxies `/api` and `/socket.io` to the backend, so no frontend env file is needed for local development.

---

## 🔑 Environment Variables (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `PORT` | — | Backend port (default `5000`) |
| `JWT_SECRET` | ✅ | Secret for signing access tokens |
| `JWT_EXPIRES_IN` | — | Access token lifetime (default `1h`) |
| `REFRESH_TOKEN_SECRET` | ✅ | Secret for signing refresh tokens |
| `REFRESH_TOKEN_EXPIRES_IN` | — | Refresh token lifetime (default `7d`) |
| `NODE_ENV` | — | `development` or `production` |
| `BREVO_API_KEY` | — | Brevo API key for sending OTP emails. **If unset, the OTP is returned in the API response (demo mode)** so the app works without email setup. |
| `FROM_EMAIL` | — | Verified sender address (required if email is enabled) |

> **Note on email:** Render's free tier blocks outbound SMTP ports, so email is sent via Brevo's HTTP API. Without a `BREVO_API_KEY`, the app runs in demo mode and shows the verification code on screen — convenient for local development and reviewers.

---

## 🔒 Security Highlights

- Passwords hashed with **bcrypt** (cost 12)
- OTPs **stored hashed** (SHA-256), single-use, with 15-minute expiry
- **Refresh-token rotation** persisted in the database; tokens revoked on logout / password reset
- **Email-enumeration protection** on password reset (uniform responses)
- Role-based authorization enforced **server-side** (the frontend only hides controls)
- Socket connections authenticated at handshake and re-checked for project membership
- Helmet, CORS, per-route rate limiting, and input validation on every endpoint

---

## 📡 API Overview

Base path: `/api`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Create account (sends/returns OTP) |
| `POST` | `/auth/verify-email` | Verify email with OTP |
| `POST` | `/auth/login` | Log in |
| `POST` | `/auth/refresh` | Rotate tokens |
| `POST` | `/auth/forgot-password` · `/auth/reset-password` | Password reset via OTP |
| `GET/POST` | `/projects` | List / create projects |
| `POST` | `/projects/join` | Join a project via invite code |
| `GET/POST/PUT/DELETE` | `/tasks` | Manage tasks |
| `GET/POST` | `/comments` · `/messages` · `/notifications` · `/labels` · `/subtasks` | Supporting resources |

---

## 📄 License

Released for educational purposes as part of the CodeAlpha internship program.
