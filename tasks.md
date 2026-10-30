# Phase 6 Frontend Tasks — Progress, Dashboard, and Integrations

**Scope:** `raghad-app/` — React Native + Expo frontend  
**Goal:** Implement the progress map, dashboard, and GPS/exercise integration surfaces using backend-owned aggregates and route data.  
**Sources of truth:** `docs/master-plan.md`, `docs/frontend-plan.md`, `docs/backend-plan.md`, `docs/api-contract.md`, and `docs/tasks-phase-6-7.md`.

## Phase Gate

- [ ] Phase 4 and Phase 5 must be accepted and stable before beginning Phase 6 frontend work.
- [ ] Confirm `GET /progress/overview`, `GET /dashboard`, `GET /integrations/status`, and `POST /integrations/maps/route` against the running backend before shipping UI logic.
- [ ] Keep all aggregation, score, streak, and GPS route logic backend-owned unless the API contract explicitly expects client-side display-only behavior.
- [ ] Do not expose provider keys, route metadata beyond what is returned by the backend, or any secrets in client runtime configuration.

## F6.1 Progress Map UI

- [ ] Add typed API support for `GET /progress/overview` and `GET /progress/projects/:id`.
- [ ] Add stable query keys and refresh patterns for dashboard/progress state.
- [ ] Build a progress map screen with project achievement percentages and aggregate counts.
- [ ] Display habit completion percent, total points, and maximum active streak from backend data.
- [ ] Display goals achieved/active counts from backend data.
- [ ] Add project progress detail view showing goal achievement, milestones, and node progress.
- [ ] Add progress visualization elements (bars, lines, or cards) driven by backend values.
- [ ] Provide Loading, Empty, Error, and Success states.
- [ ] Preserve Arabic RTL and responsive layouts across mobile and web.

## F6.2 Dashboard UI

- [ ] Add typed API support for `GET /dashboard`.
- [ ] Build dashboard screen or section showing `todayStats` (habits done, total habits, tasks done, points).
- [ ] Display current/top streaks using backend values.
- [ ] Display the next upcoming calendar events from backend data.
- [ ] Display unread notification count from backend data.
- [ ] Ensure dashboard content is backend-driven only, with no local score calculation.
- [ ] Add loading, empty, error/retry, and success states.
- [ ] Ensure dashboard links are consistent with the broader app navigation flow.

## F6.3 GPS Exercise Flow

- [ ] Add typed API support for `POST /integrations/maps/route`.
- [ ] Add exercise tracking flow for the exercise habit.
- [ ] Capture route coordinates and distance if the platform supports it.
- [ ] Show a map or route preview with a red path line.
- [ ] Display route distance in kilometers from the backend-returned log metadata.
- [ ] Submit the route using the backend endpoint and refresh the relevant habit/history state after success.
- [ ] Handle permission denied, location unavailable, and provider errors gracefully.
- [ ] Display saved route data from backend metadata when available.
- [ ] Provide loading, error, and success states for the exercise flow.

## F6.4 Shared API, State, and UX

- [ ] Extend the centralized API client with Phase 6 DTOs and typed methods.
- [ ] Add query keys for progress overview, project progress detail, dashboard, integration status, and route save flow.
- [ ] Reuse shared loading, empty, error/retry, validation, and success UI patterns.
- [ ] Ensure authenticated-only data access for all protected endpoints.
- [ ] Preserve accessibility, touch target sizing, and keyboard support throughout the new screens.
- [ ] Keep the app Arabic-first, responsive, and web-friendly.

## F6.5 Testing and Integration

- [ ] Unit-test progress/dashboard request construction and response normalization.
- [ ] Add component/integration tests for progress cards, dashboard rendering, and GPS save flow.
- [ ] Test permission-denied and route-upload error handling.
- [ ] Test progress dashboard states without local score recomputation.
- [ ] Run frontend lint, typecheck, unit tests, and web production build.
- [ ] Perform manual QA for mobile/web dashboard and GPS flow.
- [ ] Verify the backend handshake for `progress`/`dashboard`/route save flows.

## Phase 6 Completion Criteria

- [ ] Progress map and dashboard render backend-owned values correctly.
- [ ] GPS route capture and save flow works end-to-end.
- [ ] Integration status and route payload handling respect backend contract and security rules.
- [ ] The frontend does not compute progress or summaries locally when the backend provides them.
- [ ] The Phase 6 frontend is ready only after the backend contract is confirmed in a live environment.

## Suggested Implementation Order

1. Add DTOs and API methods for progress/dashboard/integration endpoints.
2. Build the progress map and detail screens.
3. Build the dashboard screen and unread notification summary.
4. Add the GPS route capture and submission flow.
5. Add tests and manual QA.

## Notes for Execution

- The backend remains the source of truth for aggregate metrics, notifications, and route data.
- GPS exercise flows should respect user permission and gracefully fail if location services are unavailable.
- Use the existing shared screen and button primitives for consistency with the earlier phases.ned data.- [ ] Brotherhood students, sessions, lessons/exercises, and photo upload work with backend endpoints.- [ ] Money entries and summaries are backend-sourced and refresh after mutations.
- [ ] Media CRUD and program watch tracking work.
- [ ] Hasaniya fetch, review, card CRUD, and statistics work without exposing external credentials.
- [ ] All feature screens provide loading, empty, error/retry, validation, and success feedback.
- [ ] Lint, typecheck, tests, web build, Android bundle build, manual QA, and Phase 4 handshake pass.

## Out of Scope

- Backend schemas, business rules, level sequencing, Quran scheduling, points, totals, and progression calculations.
- Client-side calls directly to Hugging Face or storage providers.
- Notifications/FCM and scheduled reminders beyond endpoints explicitly documented for this phase.
- Offline mutation queues or new dependencies unless separately approved.
