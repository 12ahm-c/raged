# Raghad - Phase 1 Frontend Tasks (Foundation & Auth)

Source docs: `master-plan.md`, `frontend-plan.md`, `api-contract.md`, `architecture.md`, `infra-plan.md`.

**Phase:** 1 â€” Foundation & Auth (Frontend Phase A)
**Goal:** Working React Native (Expo) app with API client, auth flow, main layout with tab navigation, profile/settings screens.

**Gate:** Phase 1 Frontend can start after Backend Phase 1 endpoints are available (`/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `PUT /users/me`, `GET/PUT /users/me/settings`).

---

## Phase 1 Frontend Tasks

### F1.1 Central API Client (`src/api/`)
- [ ] Create `api.ts` with:
  - `baseURL` (`http://localhost:3001/v1` via `EXPO_PUBLIC_API_URL`)
  - Unified request/response wrapper (`{ success, data, error, meta }`)
  - Centralized error handler mapping `api-contract.md` Appendix B codes
  - Access token in memory + automatic refresh on `TOKEN_EXPIRED` (single retry)
  - Request interceptor adding `Authorization: Bearer <accessToken>`
  - Refresh token stored securely (AsyncStorage with encryption or SecureStore)
  - **No access token in unsecure storage**
- [ ] Create `api/mocks.ts` with contract-compatible mocks for offline/dev
- [ ] Create `api/storage.ts` for secure token persistence
- [ ] Add TypeScript types for all DTOs from `api-contract.md` Appendix A

### F1.2 Login Screen (`/auth/login`)
- [ ] Form: email + password fields
- [ ] Client-side validation (required, password â‰¥ 8 chars)
- [ ] Display `AUTH_REQUIRED` / `FORBIDDEN` errors from backend
- [ ] "Login" button calls `POST /auth/login`
- [ ] Loading state during request
- [ ] On success: store tokens â†’ call `GET /auth/me` â†’ redirect to `/today`
- [ ] RTL support for Arabic
- [ ] Accessible form labels and error messages

### F1.3 Main Navigation (`MainLayout` + `TabNavigator`)
- [ ] `AuthLayout` for login screen (no tabs)
- [ ] `MainLayout` with:
  - TabNavigator (7 tabs: Today, Habits, Projects, Goals, Progress, Calendar, Settings)
  - Global Header
  - Notification bell with unread count badge
- [ ] Route protection: redirect unauthenticated users to `/auth/login`
- [ ] Persistence: verify token on app start via `GET /auth/me`
- [ ] Deep linking support for tabs
- [ ] RTL layout for tab bar

### F1.4 Profile & Settings Screens (`/profile`, `/settings`)
- [ ] **Profile** (`/profile`):
  - Display name, email, timezone
  - Edit name / password form (`PUT /users/me`)
  - Password field with min 8 validation
- [ ] **Settings** (`/settings`):
  - Theme toggle: light/dark (`theme`)
  - Language: Arabic (`language`)
  - Notifications enabled toggle (`notificationsEnabled`)
  - Reminder lead minutes (`reminderLeadMinutes`)
  - Load via `GET /users/me/settings`, save via `PUT /users/me/settings`
- [ ] "Logout" button (`POST /auth/logout`) â†’ clear tokens â†’ redirect to `/auth/login`
- [ ] Loading/Error/Empty states for all async operations

### F1.5 Core UI States (Reusable Components)
- [ ] `Skeleton` components for Loading (per list/card, no full-screen spinners)
- [ ] `EmptyState` component: friendly message + action button (e.g., "No data â€” Add...")
- [ ] `ErrorState` component: message per `error.code` + retry button
- [ ] `SuccessState` / optimistic update patterns
- [ ] Full RTL support (flex-direction, margins, text alignment)
- [ ] Accessible: semantic elements, focus states, contrast, touch targets â‰¥ 44px

### F1.6 App Bootstrap & Config
- [ ] Expo project init with TypeScript template
- [ ] `app.config.ts` / `app.json` with:
  - `EXPO_PUBLIC_API_URL`
  - `EXPO_PUBLIC_FCM_SENDER_ID` (optional for Phase 1)
  - Orientation, splash, icons
- [ ] `src/theme/` for light/dark tokens (colors, spacing, typography)
- [ ] `src/hooks/useAuth.ts` for auth state management
- [ ] `src/stores/authStore.ts` (Zustand/Jotai/Redux) for token + user
- [ ] `.env.example` with `EXPO_PUBLIC_API_URL=http://localhost:3001/v1`
- [ ] `.gitignore` excludes `.env.local`, `.env`
- [ ] ESLint + Prettier + TypeScript strict mode config
- [ ] Scripts: `dev`, `build`, `lint`, `typecheck`, `test`

---

## Database Tasks (Frontend-relevant)
- [ ] Confirm MongoDB Atlas cluster accessible
- [ ] Verify seed owner account exists for login testing

---

## Infrastructure Tasks
- [ ] Add `EXPO_PUBLIC_API_URL` to frontend `.env.example`
- [ ] Configure `npm run dev` to run frontend + backend together (concurrently)
- [ ] Backend on `http://localhost:3001/v1`
- [ ] Frontend on `http://localhost:8080` (Expo Web)
- [ ] Staging deployment prep (Expo Web / EAS Hosting)
- [ ] HTTPS enforced for production frontend

---

## Integration Tasks
- [ ] Connect Login screen to real `POST /auth/login`
- [ ] Call `GET /auth/me` after successful login to hydrate user state
- [ ] Implement automatic token refresh on `TOKEN_EXPIRED` (one retry)
- [ ] On refresh failure: clear auth state â†’ redirect to `/auth/login`
- [ ] Verify response shapes match `api-contract.md` exactly (DTOs, error codes, wrapper)

---

## Testing Tasks
- [ ] Unit test: API client token storage/refresh logic
- [ ] Unit test: error code mapping (`AUTH_REQUIRED`, `TOKEN_EXPIRED`, etc.)
- [ ] Integration test (manual): login â†’ me â†’ refresh â†’ logout
- [ ] Manual QA: Login screen validation, error display, RTL layout
- [ ] Manual QA: Profile edit, settings persist, logout clears session
- [ ] Manual QA: Tab navigation, protected routes, unread badge

---

## Phase 1 Completion Criteria (Frontend)
- [ ] `POST /auth/login` returns User DTO + tokens + expiry dates
- [ ] `GET /auth/me` returns authenticated user
- [ ] Post-login redirect works with real token
- [ ] `npm run lint`, `typecheck`, `build` pass (Frontend)
- [ ] Handshake test passes: login â†’ me â†’ refresh â†’ logout
- [ ] No secrets in `.env.example` or repo
- [ ] All 7 tabs render in `MainLayout` (empty but navigable)
- [ ] Profile & Settings screens functional with backend
- [ ] Loading/Empty/Error/Success states implemented and tested
- [ ] RTL verified on mobile and desktop viewports

---

## Cross-Phase Notes
- [ ] Do not start Phase 2 Frontend before Phase 1 handshake accepted
- [ ] Keep all API responses wrapped as `{ success, data, error, meta }`
- [ ] Keep all endpoints authenticated with Bearer tokens
- [ ] Mocks (if used) must match `api-contract.md` exactly
- [ ] Any `api-contract.md` change requires backend + frontend agreement
- [ ] Update `docs/tasks-phase-1-frontend.md` as implementation progresses

---

## API Contract Reference (Phase 1)

### Auth Endpoints
| Method | Path | Auth | Request | Success Response |
|--------|------|------|---------|------------------|
| POST | `/auth/login` | Public | `{ email, password }` | `{ user, accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt }` |
| POST | `/auth/refresh` | Public | `{ refreshToken }` | Same as login |
| POST | `/auth/logout` | Bearer | (empty) | 204 No Content |
| GET | `/auth/me` | Bearer | â€” | User DTO |

### User Endpoints
| Method | Path | Auth | Request | Success Response |
|--------|------|------|---------|------------------|
| PUT | `/users/me` | Bearer | `{ name?, password?, timezone? }` | User DTO |
| GET | `/users/me/settings` | Bearer | â€” | UserSettings DTO |
| PUT | `/users/me/settings` | Bearer | `{ theme, language, notificationsEnabled, reminderLeadMinutes }` | UserSettings DTO |

### User DTO (Appendix A.1)
```json
{
  "_id": "65f...",
  "name": "string",
  "email": "user@example.com",
  "role": "owner",
  "timezone": "Africa/Nouakchott",
  "settings": { "theme": "light", "language": "ar", "notificationsEnabled": true, "reminderLeadMinutes": 5 },
  "createdAt": "2025-06-01T00:00:00.000Z",
  "lastActiveAt": "2025-06-16T14:30:00.000Z"
}
```

### Error Codes (Appendix B)
| Code | HTTP | Description |
|------|------|-------------|
| AUTH_REQUIRED | 401 | Missing/invalid credentials |
| TOKEN_EXPIRED | 401 | Access token expired â€” call `/auth/refresh` |
| TOKEN_INVALID | 401 | Invalid/revoked token |
| FORBIDDEN | 403 | No permission |
| VALIDATION_ERROR | 400 | Invalid input (fields in `error.fields`) |

---

## Suggested File Structure (Phase 1)
```
raghad-app/
â”œâ”€â”€ app.config.ts
â”œâ”€â”€ .env.example
â”œâ”€â”€ package.json
â”œâ”€â”€ tsconfig.json
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ api/
â”‚   â”‚   â”œâ”€â”€ index.ts          # Central API client
â”‚   â”‚   â”œâ”€â”€ mocks.ts          # Contract-compatible mocks
â”‚   â”‚   â”œâ”€â”€ storage.ts        # Secure token storage
â”‚   â”‚   â””â”€â”€ types.ts          # DTO types from api-contract.md
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ ui/               # Button, Input, Card, Skeleton, EmptyState, ErrorState
â”‚   â”‚   â”œâ”€â”€ layout/           # AuthLayout, MainLayout, DetailLayout
â”‚   â”‚   â””â”€â”€ forms/            # FormField, ValidationMessage
â”‚   â”œâ”€â”€ hooks/
â”‚   â”‚   â”œâ”€â”€ useAuth.ts
â”‚   â”‚   â””â”€â”€ useApi.ts
â”‚   â”œâ”€â”€ screens/
â”‚   â”‚   â”œâ”€â”€ auth/
â”‚   â”‚   â”‚   â””â”€â”€ LoginScreen.tsx
â”‚   â”‚   â”œâ”€â”€ profile/
â”‚   â”‚   â”‚   â”œâ”€â”€ ProfileScreen.tsx
â”‚   â”‚   â”‚   â””â”€â”€ SettingsScreen.tsx
â”‚   â”‚   â””â”€â”€ tabs/
â”‚   â”‚       â”œâ”€â”€ TodayTab.tsx (placeholder)
â”‚   â”‚       â”œâ”€â”€ HabitsTab.tsx (placeholder)
â”‚   â”‚       â”œâ”€â”€ ProjectsTab.tsx (placeholder)
â”‚   â”‚       â”œâ”€â”€ GoalsTab.tsx (placeholder)
â”‚   â”‚       â”œâ”€â”€ ProgressTab.tsx (placeholder)
â”‚   â”‚       â”œâ”€â”€ CalendarTab.tsx (placeholder)
â”‚   â”‚       â””â”€â”€ SettingsTab.tsx (links to SettingsScreen)
â”‚   â”œâ”€â”€ stores/
â”‚   â”‚   â”œâ”€â”€ authStore.ts
â”‚   â”‚   â””â”€â”€ settingsStore.ts
â”‚   â”œâ”€â”€ theme/
â”‚   â”‚   â”œâ”€â”€ colors.ts
â”‚   â”‚   â”œâ”€â”€ spacing.ts
â”‚   â”‚   â””â”€â”€ typography.ts
â”‚   â”œâ”€â”€ navigation/
â”‚   â”‚   â”œâ”€â”€ AppNavigator.tsx
â”‚   â”‚   â”œâ”€â”€ AuthNavigator.tsx
â”‚   â”‚   â””â”€â”€ MainTabNavigator.tsx
â”‚   â””â”€â”€ utils/
â”‚       â”œâ”€â”€ date.ts
â”‚       â””â”€â”€ validation.ts
â””â”€â”€ tests/
    â”œâ”€â”€ api-client.test.ts
    â””â”€â”€ auth-flow.test.tsx
```

---

## Phase 1 Status - 2026-10-24

Phase 1 Frontend is **complete**.

**Completed:**
- Expo React Native app with TypeScript, ESLint, Prettier — all pass.
- Central API client (\src/api/client.ts\) with unified wrapper, auto-refresh on TOKEN_EXPIRED, Bearer auth.
- Secure token storage (\src/api/storage.ts\) using expo-secure-store on native, in-memory on web.
- LoginScreen calling \/auth/login\ → stores tokens → calls \/auth/me\ → navigates to tabs.
- MainLayout with 7-tab BottomTabNavigator: يومي، عاداتي، مشاريعي، الأهداف، التقدم، الروزنامة، الإعدادات.
- AppNavigator with auth-guarded routes and bootstrap flow.
- ProfileScreen (\PUT /users/me\) and SettingsScreen (\GET/PUT /users/me/settings\).
- LoadingState, EmptyState/ScreenState, ErrorState reusable components.
- Full RTL support throughout.
- \
pm run lint\, \	ypecheck\, \uild\ all pass.

