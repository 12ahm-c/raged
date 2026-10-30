# Raghad - Phase 6 & Phase 7 Tasks

Source docs read: `master-plan.md`, `backend-plan.md`, `frontend-plan.md`, `api-contract.md`, `architecture.md`, `infra-plan.md`, `ai-workflow.md`.

Note: `master-plan.md` names these Phase 6 and Phase 7. `backend-plan.md` groups Progress, Integrations, and Hardening together as backend Phase 7.

Important gate: Phase 6 depends on Phases 2-5. Phase 7 depends on Phases 1-6 and should not begin as a full hardening pass until the product surfaces are feature-complete.

---

## Implementation Status - 2026-10-24

Phase 6 is **complete** for both backend and frontend. Phase 7 (hardening) is **pending**.

Phase 6 completed:
- Backend: GET /progress/overview, GET /progress/projects/:id, GET /dashboard, GET /integrations/status, POST /integrations/maps/route.
- Frontend: Phase6DashboardScreen (todayStats, streaks, integration status), ProgressOverviewScreen (habits/goals/projects), GPSRouteScreen (route entry + save).
- `npm run lint`, `typecheck`, `build` pass for both backend and frontend.

Phase 6 still missing:
- Redis cache integration (optional, deferred unless profiling justifies it).
- Real Maps API provider call (POST /integrations/maps/route stores coordinates but does not call external maps API).
- Manual/staging handshake.

Phase 7 (hardening) not yet started.

---


**Goal:** deliver the full progress map, dashboard, GPS route integration, integration status endpoints, and efficient backend aggregations.

### Backend Tasks

#### B6.1 Progress Overview
- [ ] Implement `GET /progress/overview`.
- [ ] Aggregate project achievement percentages.
- [ ] Aggregate habit daily completion percent.
- [ ] Aggregate total points from `points_ledger`.
- [ ] Aggregate maximum active streak from `streaks`.
- [ ] Aggregate goal counts by achieved/active.
- [ ] Ensure all aggregation is scoped to authenticated user.
- [ ] Avoid N+1 queries by using aggregation pipelines or bounded parallel queries.
- [ ] Return shape matching `api-contract.md` section 21.1.

#### B6.2 Project Progress Detail
- [ ] Implement `GET /progress/projects/:id`.
- [ ] Return `goalAchievement`.
- [ ] Return `milestones`.
- [ ] Return `nodesProgress`.
- [ ] Use `project_nodes`, `goals`, and project metadata to calculate progress.
- [ ] Return `NOT_FOUND` for missing or unauthorized project.
- [ ] Keep response compatible with `api-contract.md` section 21.2.

#### B6.3 Dashboard
- [ ] Implement `GET /dashboard`.
- [ ] Return `todayStats`: `habitsDone`, `habitsTotal`, `tasksDone`, `points`.
- [ ] Return top/current streaks with habit names.
- [ ] Return next five upcoming calendar events.
- [ ] Return unread notification count.
- [ ] Reuse Today/Daily services where possible.
- [ ] Keep response compatible with `api-contract.md` section 21.3.

#### B6.4 Integrations Status
- [ ] Implement `GET /integrations/status`.
- [ ] Report `fcm` status based on Firebase configuration.
- [ ] Report `huggingface` status based on `HF_API_KEY`.
- [ ] Report `maps` status based on `MAPS_API_KEY`.
- [ ] Report `storage` status based on `STORAGE_*`.
- [ ] Do not expose secrets or provider-specific credentials in the response.

#### B6.5 Maps Route Integration
- [ ] Add `MAPS_API_KEY` to `.env.example`.
- [ ] Implement `POST /integrations/maps/route`.
- [ ] Validate `habitId`, `date`, `distanceKm`, and route coordinates.
- [ ] Store GPS route in `habit_logs.metadata.route`.
- [ ] Store `distanceKm` in `habit_logs.metadata.distanceKm`.
- [ ] Create or update the matching habit log for the date.
- [ ] Return HabitLog DTO.
- [ ] Handle external map errors with `EXTERNAL_SERVICE_ERROR` where a provider call is used.

#### B6.6 Aggregation Performance
- [ ] Audit indexes for progress/dashboard queries.
- [ ] Add or confirm indexes for `habit_logs(userId,date,status)`, `tasks(userId,date,status)`, `points_ledger(userId,date)`, `project_nodes(userId,projectId,status)`, `calendar_events(userId,date)`.
- [ ] Add optional Redis cache integration only if profiling shows need.
- [ ] If Redis is enabled, use TTL of 5 minutes for dashboard/progress aggregates.
- [ ] Make cached responses user-scoped.
- [ ] Add cache invalidation notes for habit/task/project/goal changes.

### Frontend Tasks

#### F6.1 Progress Map UI
- [ ] Build progress map screen.
- [ ] Display project achievement percentages from `GET /progress/overview`.
- [ ] Display habit completion percent, total points, and active streak max.
- [ ] Display goals achieved/active counts.
- [ ] Add project progress detail view using `GET /progress/projects/:id`.
- [ ] Add charts for progress line, bars, and streaks.
- [ ] Provide Loading, Empty, Error, and Success states.
- [ ] Preserve RTL and responsive behavior.

#### F6.2 Dashboard UI
- [ ] Build dashboard screen or dashboard section in Today.
- [ ] Display `todayStats`.
- [ ] Display current/top streaks.
- [ ] Display five upcoming events.
- [ ] Display unread notification count.
- [ ] Ensure dashboard data comes from backend only.

#### F6.3 GPS Exercise Flow
- [ ] Add exercise tracking flow for morning exercise habit.
- [ ] Capture route coordinates.
- [ ] Display map with red route line.
- [ ] Calculate/display kilometers.
- [ ] Submit route using `POST /integrations/maps/route`.
- [ ] Display saved route from habit log metadata.
- [ ] Handle permission denied and location unavailable states.

### Database Tasks
- [ ] Confirm indexes for all progress/dashboard aggregations.
- [ ] Confirm `habit_logs.metadata.route` can store route arrays safely.
- [ ] Confirm route payload size limits.
- [ ] Add any missing indexes for calendar/dashboard query performance.
- [ ] Document Redis keys if Redis is enabled.

### Infrastructure Tasks
- [ ] Add `MAPS_API_KEY` to `.env.example`.
- [ ] Add `REDIS_URL` to `.env.example` as optional.
- [ ] Configure Redis locally only if used.
- [ ] Configure Redis in staging/production only if used.
- [ ] Ensure map provider settings are environment-driven.
- [ ] Add metrics/logging for slow aggregation queries.

### Integration Tasks
- [ ] Save GPS route to habit log metadata.
- [ ] Display GPS route from saved metadata.
- [ ] Verify progress overview uses backend aggregates only.
- [ ] Verify dashboard uses backend aggregates only.
- [ ] Verify integration status reflects actual environment configuration.

### Testing Tasks
- [ ] Integration test: `GET /progress/overview` returns project, habit, point, streak, and goal aggregates.
- [ ] Integration test: `GET /progress/projects/:id` returns project progress detail.
- [ ] Integration test: `GET /dashboard` returns Today stats, streaks, events, unread notifications.
- [ ] Integration test: `GET /integrations/status` does not leak secrets.
- [ ] Integration test: GPS route save creates/updates habit log metadata.
- [ ] Performance test: progress/dashboard queries do not perform N+1 query patterns.
- [ ] Frontend/manual QA: progress charts render correctly on mobile and desktop.
- [ ] Frontend/manual QA: GPS route capture/save/display flow.

### Phase 6 Completion Criteria
- [ ] Progress map shows project and habit progress.
- [ ] Dashboard responds efficiently and matches contract.
- [ ] GPS route is stored and displayed.
- [ ] Aggregations are indexed and avoid N+1 patterns.
- [ ] Integration status endpoint is safe and accurate.
- [ ] Phase 6 handshake passes: save GPS route -> route appears in habit history/progress; dashboard/progress match backend data.

---

## Phase 7 - Testing and Hardening

**Goal:** stabilize quality, security, performance, accessibility, observability, backup/restore readiness, and production confidence.

### Testing Tasks

#### T7.1 Critical Flow Integration Tests
- [ ] Test auth: login -> me -> refresh -> logout.
- [ ] Test habit flow: create habit -> log completion -> points ledger -> streak update -> Today refresh.
- [ ] Test missed habit flow: end-of-day -> missed penalty -> points ledger idempotency.
- [ ] Test task flow: create task -> complete task -> points awarded once -> appears in Today.
- [ ] Test project level flow: create level project -> locked level returns `LEVEL_LOCKED` -> unlock after previous done.
- [ ] Test Quran flow: plan -> log -> next suggestion.
- [ ] Test English flow: complete level -> unlock next.
- [ ] Test notification flow: trigger data -> run job -> notification appears -> mark read updates count.
- [ ] Test GPS flow: submit route -> route stored in habit log metadata.

#### T7.2 Contract Tests
- [ ] Add contract tests against `api-contract.md` response wrappers.
- [ ] Verify all success responses use `{ success, data, error, meta }`.
- [ ] Verify validation errors return `VALIDATION_ERROR`.
- [ ] Verify locked-level errors return `LEVEL_LOCKED`.
- [ ] Verify external-service errors return `EXTERNAL_SERVICE_ERROR`.
- [ ] Verify auth failures return `AUTH_REQUIRED`, `TOKEN_INVALID`, or `TOKEN_EXPIRED`.
- [ ] Verify all protected endpoints require Bearer auth.

#### T7.3 Regression and Smoke Tests
- [ ] Ensure `npm run lint` passes.
- [ ] Ensure `npm run typecheck` passes.
- [ ] Ensure `npm run build` passes.
- [ ] Ensure backend unit and integration test suites pass.
- [ ] Add smoke test for backend health endpoint.
- [ ] Add smoke test for app startup with required env vars.
- [ ] Add staging smoke checklist.

### Backend Hardening Tasks

#### B7.1 Structured Logging and Request IDs
- [ ] Add request ID middleware.
- [ ] Include request ID in responses and logs.
- [ ] Add structured JSON logs for backend and jobs.
- [ ] Log request method, path, status, duration, and request ID.
- [ ] Do not log passwords, JWTs, refresh tokens, DB URLs, Firebase secrets, HF keys, Maps keys, storage secrets, or raw device tokens.
- [ ] Add error logging that preserves error code/status without leaking secrets.

#### B7.2 Security Review
- [ ] Review auth middleware and token rotation.
- [ ] Review refresh token storage/revocation.
- [ ] Review user ownership scoping for every collection.
- [ ] Review points ledger idempotency and tamper resistance.
- [ ] Review streak recalculation and locked-level rules.
- [ ] Review scheduled job idempotency.
- [ ] Review external service credential handling.
- [ ] Add rate limiting for public/auth endpoints if not already present.
- [ ] Verify Helmet and CORS configuration for staging/production.
- [ ] Run dependency audit and document accepted risks.

#### B7.3 Performance and Index Audit
- [ ] Audit Mongo indexes against all list and aggregation endpoints.
- [ ] Check slow aggregation paths for dashboard/progress.
- [ ] Confirm no unbounded list endpoints.
- [ ] Confirm pagination on list endpoints.
- [ ] Add payload size limits for GPS routes and uploads.
- [ ] Add or document Redis cache only where profiling justifies it.
- [ ] Add performance notes for expected MVP load.

#### B7.4 Error Handling Consistency
- [ ] Normalize all app errors through central middleware.
- [ ] Ensure Zod errors include field-level details.
- [ ] Ensure external service failures use `502 EXTERNAL_SERVICE_ERROR`.
- [ ] Ensure duplicate records use `DUPLICATE`.
- [ ] Ensure not found responses use `NOT_FOUND`.
- [ ] Ensure forbidden/permission failures use `FORBIDDEN` where applicable.

### Frontend Hardening Tasks

#### F7.1 Accessibility
- [ ] Run accessibility pass across all screens.
- [ ] Ensure touch targets are large enough.
- [ ] Ensure forms have labels and helpful errors.
- [ ] Ensure color contrast passes.
- [ ] Ensure RTL layout remains correct.
- [ ] Ensure keyboard navigation works on web.

#### F7.2 Responsive and Performance
- [ ] Verify mobile viewport.
- [ ] Verify desktop viewport.
- [ ] Verify tablet/intermediate widths where relevant.
- [ ] Add lazy loading for heavy screens or charts.
- [ ] Avoid oversized bundles/assets.
- [ ] Ensure text does not overflow buttons/cards.
- [ ] Ensure loading/empty/error/success states are consistent.

#### F7.3 Frontend Environment Audit
- [ ] Ensure frontend uses only safe `EXPO_PUBLIC_*` variables.
- [ ] Ensure no private keys are bundled.
- [ ] Ensure API base URL is environment-driven.
- [ ] Ensure staging/production config is documented.

### Infrastructure Tasks

#### I7.1 Monitoring and Alerts
- [ ] Configure structured stdout/stderr logs for backend.
- [ ] Add API error-rate monitoring.
- [ ] Add p95/p99 response-time monitoring.
- [ ] Add cron job success/failure monitoring.
- [ ] Add FCM error-rate monitoring.
- [ ] Add MongoDB slow query monitoring.
- [ ] Add alert for API error rate > 5% for 5 minutes.
- [ ] Add alert for failed backup.
- [ ] Add alert when `dailySummary` fails by 01:00.

#### I7.2 Secrets and Environment Readiness
- [ ] Confirm all configuration is externalized.
- [ ] Confirm `.env.example` contains placeholders only.
- [ ] Confirm `.env.local` and local secret files are ignored.
- [ ] Confirm staging secrets are in platform secret manager.
- [ ] Confirm production secrets are in platform secret manager.
- [ ] Rotate any secret suspected of exposure.
- [ ] Document required secrets: `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `HF_API_KEY`, `MAPS_API_KEY`, `STORAGE_*`, optional `REDIS_URL`.

#### I7.3 Backup, Restore, and Runbook
- [ ] Confirm Atlas automatic backups.
- [ ] Confirm storage/PDF/photo backup strategy.
- [ ] Execute documented restore test.
- [ ] Document RPO <= 24h and RTO <= 4h.
- [ ] Create runbook for DB outage.
- [ ] Create runbook for Redis outage if Redis is enabled.
- [ ] Create runbook for FCM quota/failure.
- [ ] Create runbook for failed cron jobs.

#### I7.4 Production Readiness Checklist
- [ ] HTTPS enforced for frontend and backend.
- [ ] Rate limiting enabled for public endpoints.
- [ ] MongoDB indexes created.
- [ ] Monitoring and alerts active.
- [ ] Backups verified and restore tested.
- [ ] Secrets rotated/verified.
- [ ] Expected-load test completed.
- [ ] Staging environment has latest build.

### Integration Tasks
- [ ] Run full staging handshake for every completed phase.
- [ ] Verify dashboard/progress on staging-sized data.
- [ ] Verify notification jobs on staging.
- [ ] Verify external service fallbacks for HF/Maps/FCM.
- [ ] Verify rollback plan for contract-breaking issues.
- [ ] Verify staging deployment can be rolled back.

### Phase 7 Completion Criteria
- [ ] Critical flows are covered by integration tests.
- [ ] Contract tests pass against `api-contract.md`.
- [ ] No lint/typecheck/build errors.
- [ ] Security review passed.
- [ ] Index/performance audit passed.
- [ ] A11y and responsive audits passed.
- [ ] Monitoring and alerts are configured.
- [ ] Backup restore test is documented and passed.
- [ ] Runbook is ready.
- [ ] System is stable enough to enter Phase 8 deployment/release.

---

## Cross-Phase Notes

- [ ] Do not start Phase 6 before Phases 2-5 data sources exist.
- [ ] Do not treat Phase 7 as complete without backend and frontend verification.
- [ ] Keep all API responses wrapped as `{ success, data, error, meta }`.
- [ ] Keep all protected endpoints authenticated with Bearer tokens.
- [ ] Do not expose secrets in logs, docs, PR descriptions, screenshots, or frontend bundles.
- [ ] Any change to `api-contract.md` requires backend and frontend agreement.
- [ ] Update `docs/tasks-phase-6-7.md` as implementation progresses.
