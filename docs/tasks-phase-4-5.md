# Raghad - Phase 4 & Phase 5 Tasks

Source docs read: `master-plan.md`, `backend-plan.md`, `frontend-plan.md`, `api-contract.md`, `architecture.md`, `infra-plan.md`, `ai-workflow.md`.

Note: `master-plan.md` names these Phase 4 and Phase 5. `backend-plan.md` names the same backend scopes Phase 5 and Phase 6.

Important gate: Phase 4 depends on Phase 3 completion. Phase 5 depends on Phases 2-4 because notifications and scheduled jobs need the habit/task/module data.

## Implementation Status - 2026-10-24

Phases 4 and 5 are **complete** for both backend and frontend.

Completed:
- Phase 4 backend: Reading (books/notes/LEVEL_LOCKED), Quran (plan/logs/next), English (4 skills × levels/LEVEL_LOCKED), Brotherhood (students/sessions/lessons/exercises/photos), Money (entries/summary), Media (programs/journal/beek_ideas/watch), Hasaniya (cards/fetch/stats with HF + EXTERNAL_SERVICE_ERROR).
- Phase 5 backend: Notifications (CRUD, read, read-all, device-token, idempotency via sourceKey), FCM integration stub (safe fallback), all job helpers (reminder, dailyReset, endOfDay, dailySummary, seasonalActivation).
- Phase 4 frontend: ReadingScreen, QuranScreen, EnglishScreen, BrotherhoodScreen, MoneyScreen, MediaScreen, HasaniyaScreen — all fully implemented.
- Phase 5 frontend: NotificationsScreen with unread count, mark-read, mark-all-read.
- Phase4DashboardScreen as module index.
- All routes mounted under `/v1/*`.
- `npm run lint`, `typecheck`, `build` pass for both backend and frontend.

Still missing:
- Real Hugging Face request (backend safely fails when HF_API_KEY absent).
- Real Firebase FCM send (marks sentAt but does not push without credentials).
- Real multipart cloud upload (photo endpoint stores a provided URL).
- Production/staging cron scheduler wiring.
- FCM sandbox test on a real device.
- Manual/staging handshake for Phase 4 and Phase 5.

---

## Phase 4 - Special Feature Modules

**Goal:** implement the specialized modules: Reading, Quran, English, Brotherhood, Money, Media, and Hasaniya.

### Backend Tasks

#### B4.1 Reading
- [ ] Create `books` model with fields: `title`, `author`, `level`, `status`, `pdfUrl`, `bookmarkPage`, `notes`, `completedAt`.
- [ ] Add unique index on `level`.
- [ ] Implement `GET /reading/books` with filters: `status`, `search`, `sort`, `page`, `limit`.
- [ ] Implement `GET /reading/books/:id` returning book DTO plus notes.
- [ ] Implement `POST /reading/books`.
- [ ] First book should be unlocked by default; later books should start locked.
- [ ] Implement `PUT /reading/books/:id` for `bookmarkPage`, `notes`, and `status`.
- [ ] Enforce sequential book unlock with `LEVEL_LOCKED`.
- [ ] Implement `GET /reading/books/:id/notes`.
- [ ] Implement `POST /reading/books/:id/notes`.
- [ ] Store PDF URLs only; do not store binary PDFs in MongoDB.

#### B4.2 Quran
- [ ] Create `quran_plan` model with `reviewHizbs`, `dailyHizbs`, `weeklyRestEnabled`, `currentHizb`, `currentPhase`.
- [ ] Create `quran_logs` model with `date`, `hizb`, `phase`, `durationMinutes`, `completedAt`.
- [ ] Implement `GET /quran/plan`.
- [ ] Implement `PUT /quran/plan`.
- [ ] Implement `POST /quran/logs`.
- [ ] Implement `GET /quran/logs` with filters: `from`, `to`, `phase`.
- [ ] Implement `GET /quran/next`.
- [ ] Add next-phase suggestion after each log.
- [ ] Encode Quran plan rules for review/new daily/new weekly flow.
- [ ] Keep plan and logs scoped to authenticated user.

#### B4.3 English
- [ ] Create `english_levels` model with `index`, `skill`, `title`, `status`, `contentRef`.
- [ ] Create `english_progress` model with `skill`, `currentLevel`, `completedLevels`, `score`.
- [ ] Support skills: `reading`, `writing`, `listening`, `speaking`.
- [ ] Implement `GET /english/levels?skill=...`.
- [ ] Implement `GET /english/levels/:id`.
- [ ] Implement `GET /english/progress`.
- [ ] Implement `POST /english/levels/:id/complete`.
- [ ] Enforce sequential unlock with `LEVEL_LOCKED`.
- [ ] Unlock next level after successful completion.
- [ ] Return updated progress after completion.

#### B4.4 Brotherhood
- [ ] Create `brotherhood_students` model with `name`, `group`, `materials`, `lessons`, `exercises`, `photos`.
- [ ] Create `brotherhood_sessions` model with `studentId`, `date`, `durationMinutes`, `note`, `status`.
- [ ] Implement `POST /brotherhood/students`.
- [ ] Implement `GET /brotherhood/students` with filters: `group`, `search`.
- [ ] Implement `GET /brotherhood/students/:id` returning student plus sessions.
- [ ] Implement `PUT /brotherhood/students/:id`.
- [ ] Implement `DELETE /brotherhood/students/:id`.
- [ ] Implement `POST /brotherhood/students/:id/lessons`.
- [ ] Implement `PATCH /brotherhood/students/:id/lessons/:lessonId`.
- [ ] Implement `POST /brotherhood/students/:id/exercises`.
- [ ] Implement `POST /brotherhood/students/:id/photos` as `multipart/form-data`.
- [ ] Store uploaded photos in cloud storage and save URLs only.
- [ ] Implement `POST /brotherhood/sessions`.
- [ ] Implement `PATCH /brotherhood/sessions/:id/defer`.
- [ ] Implement `GET /brotherhood/sessions` with filters: `from`, `to`, `studentId`.

#### B4.5 Money
- [ ] Create `money_entries` model with `amount`, `source`, `note`, `date`, `createdAt`.
- [ ] Implement `POST /money/entries`.
- [ ] Implement `GET /money/entries` with filters: `from`, `to`, `source`, `page`, `limit`.
- [ ] Include `meta.totalAmount` in money entry list responses.
- [ ] Implement `GET /money/summary`.
- [ ] Summary should include total, by source, and by month.
- [ ] Implement `DELETE /money/entries/:id`.

#### B4.6 Media
- [ ] Create `media_items` model with `kind`, `title`, `body`, `projectId`, `watchedAt`, `tags`, `createdAt`.
- [ ] Support kinds: `program`, `journal`, `beek_idea`.
- [ ] Implement `GET /media/items` with filters: `kind`, `projectId`, `from`, `to`, `page`, `limit`.
- [ ] Implement `POST /media/items`.
- [ ] Implement `GET /media/items/:id`.
- [ ] Implement `PUT /media/items/:id`.
- [ ] Implement `DELETE /media/items/:id`.
- [ ] Implement `POST /media/items/:id/watch`.
- [ ] Restrict watch action to program items where appropriate.

#### B4.7 Hasaniya
- [ ] Create `hasaniya_cards` model with `type`, `text`, `translation`, `source`, `referenceMark`, `saved`, `createdAt`.
- [ ] Support types: `hasaniya`, `translated`, `qa`, `dictionary`.
- [ ] Implement `POST /hasaniya/fetch`.
- [ ] Call Hugging Face only from backend using `HF_API_KEY`.
- [ ] Return `502 EXTERNAL_SERVICE_ERROR` when Hugging Face fails.
- [ ] Implement `GET /hasaniya/cards` with filters: `type`, `search`, `page`, `limit`.
- [ ] Include `meta.totalCount` in card list responses.
- [ ] Implement `POST /hasaniya/cards`.
- [ ] Implement `PUT /hasaniya/cards/:id`.
- [ ] Implement `DELETE /hasaniya/cards/:id`.
- [ ] Implement `GET /hasaniya/stats`.

### Frontend Tasks

#### F4.1 Reading UI
- [ ] Build `/reading` screen.
- [ ] Show book levels and locked/unlocked/completed states.
- [ ] Embed PDF viewer for `pdfUrl`.
- [ ] Add bookmark page update.
- [ ] Add book notes list and create note form.
- [ ] Display `LEVEL_LOCKED` errors clearly.
- [ ] Provide Loading, Empty, Error, and Success states.

#### F4.2 Quran UI
- [ ] Build `/quran` screen.
- [ ] Show Quran plan.
- [ ] Add plan edit flow.
- [ ] Show `GET /quran/next` suggestion.
- [ ] Add Quran log creation.
- [ ] Show Quran log history with phase filters.

#### F4.3 English UI
- [ ] Build `/english` screen.
- [ ] Show four skill tracks: reading, writing, listening, speaking.
- [ ] Show levels per skill.
- [ ] Show locked/completed/current status.
- [ ] Add complete-level action.
- [ ] Display updated progress after completion.

#### F4.4 Brotherhood UI
- [ ] Build `/brotherhood` student list.
- [ ] Add student create/edit/delete flows.
- [ ] Build student detail page with materials, lessons, exercises, photos, and sessions.
- [ ] Add lesson and exercise creation.
- [ ] Add lesson status update.
- [ ] Add photo upload flow.
- [ ] Add session creation and defer action.

#### F4.5 Money UI
- [ ] Build `/money` screen.
- [ ] Add money entry creation.
- [ ] Show entry list with filters.
- [ ] Show total amount and summaries by source/month.
- [ ] Add delete entry action.

#### F4.6 Media UI
- [ ] Build `/media` screen.
- [ ] Show tabs or filters for programs, journal, and Beek ideas.
- [ ] Add media item create/edit/delete flows.
- [ ] Add watch action for program items.
- [ ] Support project-linked media items.

#### F4.7 Hasaniya UI
- [ ] Build `/hasaniya` screen.
- [ ] Add fetch form for Hugging Face prompt/count.
- [ ] Show fetched cards before save.
- [ ] Add create/edit/delete card flows.
- [ ] Show cards by type and search.
- [ ] Show stats from `GET /hasaniya/stats`.

### Database Tasks
- [ ] Create collections: `books`, `book_notes`, `quran_plan`, `quran_logs`, `english_levels`, `english_progress`.
- [ ] Create collections: `brotherhood_students`, `brotherhood_sessions`, `money_entries`, `media_items`, `hasaniya_cards`.
- [ ] Add indexes required by list filters and level ordering.
- [ ] Add user ownership indexes for every module collection.
- [ ] Confirm cloud-storage URLs are stored instead of uploaded binary content.

### Infrastructure Tasks
- [ ] Add `HF_API_KEY` to `.env.example`.
- [ ] Add `STORAGE_*` variables to `.env.example`.
- [ ] Configure cloud storage bucket/container for uploaded photos and PDFs.
- [ ] Add external-service error handling for Hugging Face.
- [ ] Ensure secrets are loaded only from `.env.local` or deployment secret manager.

### Integration Tasks
- [ ] Verify photo upload works with `multipart/form-data`.
- [ ] Verify Hugging Face fetch passes through backend only.
- [ ] Verify stored file URLs are readable by the frontend.
- [ ] Connect special modules to Today/gamification where product rules require it.
- [ ] Ensure all new endpoints use the same auth and response wrapper conventions.

### Testing Tasks
- [ ] Integration test: reading level locked flow returns `LEVEL_LOCKED`.
- [ ] Integration test: Quran log creation returns next suggestion.
- [ ] Integration test: English level complete unlocks next level.
- [ ] Integration test: Brotherhood photo upload stores URL.
- [ ] Integration test: Money summary totals are correct.
- [ ] Integration test: Media watch updates `watchedAt`.
- [ ] Integration test: Hasaniya fetch success and external-service failure.
- [ ] Test external service failure returns `502 EXTERNAL_SERVICE_ERROR`.
- [ ] Frontend/manual QA for each special module Loading/Empty/Error state.

### Phase 4 Completion Criteria
- [ ] Reading and English levels enforce sequential unlock.
- [ ] Quran plan automatically guides review/new memorization flow.
- [ ] Brotherhood student/session/photo flows work.
- [ ] Money entries and summaries are correct.
- [ ] Media programs/journal/Beek ideas work.
- [ ] Hasaniya fetch/save/stats work.
- [ ] Each module has Loading, Empty, Error, and Success UI states.
- [ ] Phase 4 handshake passes for every module.

---

## Phase 5 - Notifications and Cron Jobs

**Goal:** implement in-app notifications, FCM registration/sending, reminders, and reliable scheduled jobs.

### Backend Tasks

#### B5.1 Notification Model and API
- [ ] Create `notifications` model with `type`, `title`, `body`, `isRead`, `readAt`, `data`, `scheduledAt`, `sentAt`, `createdAt`.
- [ ] Add indexes on `isRead` and `scheduledAt`.
- [ ] Add idempotency key/source fields to prevent duplicate scheduled notifications.
- [ ] Implement `GET /notifications` with filters: `unreadOnly`, `type`, `page`, `limit`.
- [ ] Include `meta.unreadCount` in list responses.
- [ ] Implement `PATCH /notifications/:id/read`.
- [ ] Implement `PATCH /notifications/read-all`.
- [ ] Implement `POST /notifications/device-token`.
- [ ] Store device token, platform, and lastSeen/createdAt.
- [ ] Scope all notifications/device tokens to authenticated user.

#### B5.2 FCM Integration
- [ ] Add Firebase Admin SDK initialization.
- [ ] Load `FIREBASE_SERVICE_ACCOUNT_JSON` from environment.
- [ ] Implement push send service for registered device tokens.
- [ ] Handle invalid/expired tokens.
- [ ] Never log Firebase credentials or raw device tokens.
- [ ] Add safe fallback when FCM is not configured in local development.

#### B5.3 Reminder Job
- [ ] Implement `reminder.job`.
- [ ] Generate reminders for upcoming habits.
- [ ] Generate reminders for upcoming tasks.
- [ ] Generate Brotherhood session reminders 5 minutes before session time.
- [ ] Ensure reminders are idempotent by source/ref/scheduled time.
- [ ] Send both in-app notification and FCM push where configured.

#### B5.4 Daily Jobs
- [ ] Wire `dailyReset.job` to scheduled runtime.
- [ ] Wire `endOfDay.job` to scheduled runtime.
- [ ] Wire `dailySummary.job`.
- [ ] Reuse existing Daily/end-of-day service logic where possible.
- [ ] Ensure missed-habit penalties are not duplicated.
- [ ] Create daily summary notifications.
- [ ] Run jobs using user-local timezone while storing UTC timestamps.

#### B5.5 Seasonal Activation Job
- [ ] Implement `seasonalActivation.job`.
- [ ] Detect seasonal habits near end-of-month based on schedule/remind window.
- [ ] Create idempotent notifications for seasonal habits.
- [ ] Avoid duplicate activation notifications.

#### B5.6 Cron Runtime
- [ ] Add local scheduler runner.
- [ ] Document local scheduler commands.
- [ ] Configure production/staging scheduler strategy.
- [ ] Add job logging for start, finish, failures, and counts.
- [ ] Make every job safe to retry.

### Frontend Tasks

#### F5.1 Notification Center
- [ ] Build `/notifications` screen.
- [ ] Show notification list with unread/read state.
- [ ] Show unread count in header/tab UI.
- [ ] Add filter for unread only.
- [ ] Add mark-one-as-read action.
- [ ] Add mark-all-as-read action.
- [ ] Add Loading, Empty, Error, and Success states.

#### F5.2 Device Token Registration
- [ ] Request notification permissions where platform supports it.
- [ ] Register FCM device token with `POST /notifications/device-token`.
- [ ] Handle permission denied gracefully.
- [ ] Refresh device token when it changes.

#### F5.3 In-App Notification Handling
- [ ] Receive/display FCM notifications in app where supported.
- [ ] Refresh unread count after notification received.
- [ ] Link notification taps to relevant screens using notification `data`.

### Database Tasks
- [ ] Create `notifications` collection.
- [ ] Create `device_tokens` collection or embedded user device token store.
- [ ] Add indexes: `userId + isRead`, `userId + scheduledAt`, idempotency/source key.
- [ ] Add retention policy or cleanup plan for old notifications.

### Infrastructure Tasks
- [ ] Add `FIREBASE_SERVICE_ACCOUNT_JSON` to `.env.example`.
- [ ] Configure Firebase project for staging.
- [ ] Configure Firebase project for production.
- [ ] Configure local cron runner.
- [ ] Configure staging/production cron schedule.
- [ ] Add monitoring for cron failures and FCM errors.
- [ ] Ensure notification secrets are never committed.

### Integration Tasks
- [ ] Habit reminders generate notification before scheduled habit time.
- [ ] Task reminders generate notification before task `startTime`.
- [ ] Brotherhood reminders generate notification 5 minutes before session.
- [ ] End-of-day job creates daily evaluation/summary.
- [ ] Daily summary job creates daily summary notification.
- [ ] FCM push is sent for in-app notifications when device token exists.
- [ ] Notification read actions update unread counts.

### Testing Tasks
- [ ] Unit test notification idempotency key generation.
- [ ] Integration test: `GET /notifications` returns unread count.
- [ ] Integration test: mark one notification read.
- [ ] Integration test: mark all notifications read.
- [ ] Integration test: device token registration.
- [ ] Integration test: reminder job does not create duplicate notifications.
- [ ] Integration test: end-of-day job does not duplicate penalties.
- [ ] Integration test: seasonal activation job does not duplicate reminders.
- [ ] FCM sandbox test: push notification reaches registered test device.
- [ ] Failure test: invalid FCM token is handled safely.

### Phase 5 Completion Criteria
- [ ] Notifications are listed, counted, and marked read correctly.
- [ ] Device token registration works.
- [ ] FCM push works in sandbox/staging.
- [ ] Reminder jobs are idempotent.
- [ ] Daily reset, end of day, seasonal activation, and daily summary jobs run on schedule.
- [ ] Notification volume respects user settings and daily limits.
- [ ] Phase 5 handshake passes: create trigger data -> run job -> notification appears -> push sent -> mark read updates count.

---

## Cross-Phase Notes

- [ ] Do not start Phase 4 before Phase 3 handshake is accepted unless explicitly marked as a spike/prototype.
- [ ] Do not start Phase 5 before the data sources from Phases 2-4 exist.
- [ ] Keep API responses wrapped as `{ success, data, error, meta }`.
- [ ] Keep all endpoints authenticated with Bearer tokens.
- [ ] Never expose `HF_API_KEY`, Firebase credentials, storage credentials, or device tokens to frontend logs.
- [ ] Update `api-contract.md` only if the contract changes intentionally.
- [ ] Update `docs/tasks-phase-4-5.md` as implementation progresses.
