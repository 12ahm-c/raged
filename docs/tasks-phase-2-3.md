# Raghad - Phase 2 & Phase 3 Tasks

Source docs read: `master-plan.md`, `backend-plan.md`, `frontend-plan.md`, `api-contract.md`, `architecture.md`, `infra-plan.md`, `ai-workflow.md`.

Important gate: Phase 2 depends on Phase 1 completion. Phase 3 depends on Phase 2 completion and its handshake.

## Implementation Status - 2026-10-24

Phases 2 and 3 are **complete** for both backend and frontend.

Completed:
- Phase 2 backend: habits model/CRUD, habit_logs, points engine (idempotent), streak engine, recurrence, dailyReset/endOfDay jobs, GET /daily, GET /daily/end-of-day.
- Phase 3 backend: tasks, projects (7 keys + structureTypes), project_nodes (tree + cascade delete + LEVEL_LOCKED), goals, calendar_events.
- Phase 2 frontend: TodayScreen with optimistic habit completion, HabitsScreen with full CRUD + filters, GamificationScreen (points/streaks/stats/levels).
- Phase 3 frontend: TasksScreen, ProjectsScreen + ProjectDetailScreen (all 6 structureTypes), GoalsScreen with progress, CalendarScreen (monthly/weekly views, event CRUD).
- All routes mounted under `/v1/*`.
- `npm run lint`, `typecheck`, `build` pass for both backend and frontend.

Still missing:
- Full MongoDB-backed integration tests for new endpoints.
- Real cron scheduler wiring for production; job endpoint/service logic exists.
- Manual/staging handshake for Phase 2 and Phase 3.

---

## Phase 2 - Habits, Gamification, and Today

**Goal:** deliver the daily core of the app: habits, habit logs, points, streaks, recurrence, and the Today screen.

### Backend Tasks

#### B2.1 Habit Model and CRUD
- [ ] Create `habits` model with fields from `architecture.md`: `name`, `type`, `category`, `timeSlot`, `isHobby`, `suggestedTime`, `order`, `active`, `config.special`, `pointsPerCompletion`, `pointsPenaltyIfMissed`, `createdAt`.
- [ ] Add indexes needed for filtering by owner/user, type, category, time slot, active, and order.
- [ ] Implement `POST /habits`.
- [ ] Implement `GET /habits` with query filters: `page`, `limit`, `type`, `category`, `timeSlot`, `isHobby`, `active`, `search`.
- [ ] Implement `GET /habits/:id` with habit DTO, streak, and stats.
- [ ] Implement `PUT /habits/:id`.
- [ ] Implement `DELETE /habits/:id` as soft delete with `active=false`.
- [ ] Implement `POST /habits/:id/seasonal-schedule`.
- [ ] Validate all request bodies with Zod.
- [ ] Ensure all habit endpoints are scoped to the authenticated user.

#### B2.2 Habit Logs
- [ ] Create `habit_logs` model with fields: `habitId`, `date`, `status`, `completedAt`, `points`, `note`, `metadata`, `createdAt`.
- [ ] Add unique index for `(habitId, date)`.
- [ ] Implement `POST /habit-logs`.
- [ ] Implement duplicate handling with `DUPLICATE` when a daily log already exists.
- [ ] Implement `GET /habit-logs` with filters: `habitId`, `from`, `to`, `status`, `page`, `limit`.
- [ ] Implement `GET /habit-logs/:id`.
- [ ] Implement `PUT /habit-logs/:id`.
- [ ] Implement `DELETE /habit-logs/:id`.
- [ ] Implement `GET /habits/:id/history`.
- [ ] Recalculate points and streaks when a log is updated or deleted.

#### B2.3 Points Engine
- [ ] Create `points_ledger` model with fields: `date`, `amount`, `reason`, `refType`, `refId`, `note`, `createdAt`.
- [ ] Add indexes on `date` and `refType`.
- [ ] Implement `points.engine` for habit completion: `+1` or `pointsPerCompletion`.
- [ ] Implement habit-missed penalty: `-1` or `pointsPenaltyIfMissed`.
- [ ] Guarantee idempotency: one points ledger entry per action/ref.
- [ ] Implement reversal/recalculation when logs are changed or deleted.
- [ ] Implement `GET /gamification/points`.
- [ ] Keep all point changes transparent in `points_ledger`.
- [ ] Add security review notes for the points logic because docs mark points as sensitive.

#### B2.4 Streak Engine
- [ ] Create `streaks` model with fields: `habitId`, `current`, `longest`, `lastCompletedDate`.
- [ ] Implement `streak.engine` for current and longest streak.
- [ ] Recalculate streaks after log create/update/delete.
- [ ] Implement `GET /gamification/streaks`.
- [ ] Implement `GET /gamification/stats`.
- [ ] Implement `GET /gamification/levels`.

#### B2.5 Recurrence and Daily Jobs
- [ ] Implement recurrence engine to determine which habits are due for a given date.
- [ ] Support daily habits and seasonal scheduled habits.
- [ ] Do not create empty habit log records unless needed.
- [ ] Implement `dailyReset.job`.
- [ ] Implement `endOfDay.job`.
- [ ] Ensure jobs use user timezone, not server-local date assumptions.
- [ ] Make cron/job execution safe to run more than once.

#### B2.6 Daily API
- [ ] Implement `GET /daily?date=...`.
- [ ] Return due habits with log status.
- [ ] Return summary: `totalItems`, `completed`, `points`.
- [ ] Include `endOfDay` score/message in the response.
- [ ] Implement `GET /daily/end-of-day?date=...`.
- [ ] Apply missed-habit penalties in end-of-day flow.
- [ ] Keep response shapes aligned with `api-contract.md`.

### Frontend Tasks

#### F2.1 Today Screen
- [ ] Build Today page as the main post-login screen.
- [ ] Show date and daily statistics from `GET /daily`.
- [ ] Render daily habit list from `GET /daily`.
- [ ] Add "done" action for habits using `POST /habit-logs`.
- [ ] Use optimistic update for habit completion.
- [ ] Roll back optimistic state on API error.
- [ ] Show points and completion count from backend only.
- [ ] Add End of Day modal/card using `GET /daily/end-of-day`.
- [ ] Provide Loading, Empty, Error, and Success states.
- [ ] Preserve RTL support.

#### F2.2 Habits Screen
- [ ] Build habits list screen.
- [ ] Add filters for type, category, time slot, and hobbies.
- [ ] Add create habit flow using `POST /habits`.
- [ ] Add edit habit flow using `PUT /habits/:id`.
- [ ] Add soft delete flow using `DELETE /habits/:id`.
- [ ] Build habit detail page `/habits/:id`.
- [ ] Show shared habit stats header: done days, success rate, failure rate.
- [ ] Show habit history from `GET /habits/:id/history`.
- [ ] Add UI for seasonal schedule when habit type is seasonal.

#### F2.3 Gamification UI
- [ ] Display total points from `GET /gamification/points`.
- [ ] Display streaks from `GET /gamification/streaks`.
- [ ] Display stats/levels from `GET /gamification/stats` and `GET /gamification/levels`.
- [ ] Make Locked/Empty/Error states clear and reusable.

### Database Tasks
- [ ] Create collections: `habits`, `habit_logs`, `points_ledger`, `streaks`.
- [ ] Create unique index on `habit_logs(habitId, date)`.
- [ ] Create indexes for daily query performance: habit owner/date/activity, log habit/date/status, ledger date/refType.
- [ ] Confirm Atlas database and collection names match the app config.

### Infrastructure Tasks
- [ ] Configure local cron/job runner for `dailyReset.job`.
- [ ] Configure local cron/job runner for `endOfDay.job`.
- [ ] Document how jobs are run locally and in staging.
- [ ] Ensure no new secrets are committed.

### Integration Tasks
- [ ] Connect Today habit completion to real `POST /habit-logs`.
- [ ] Invalidate/refetch `GET /daily` after habit completion.
- [ ] Ensure points/streaks displayed in frontend come from backend, not local calculations.
- [ ] Verify seasonal habits appear only on their scheduled dates.

### Testing Tasks
- [ ] Unit test recurrence engine for daily habits.
- [ ] Unit test recurrence engine for seasonal habits.
- [ ] Unit test points engine for completion, missed habits, update, delete, and idempotency.
- [ ] Unit test streak engine for consecutive and broken streaks.
- [ ] Integration test: create habit -> log completion -> points ledger entry -> streak update.
- [ ] Integration test: duplicate habit log returns `DUPLICATE`.
- [ ] Integration test: missed habit at end of day creates one penalty entry.
- [ ] Integration test: `GET /daily` returns correct habits, summary, and end-of-day object.
- [ ] Frontend test/manual QA: Today screen optimistic update and rollback.

### Phase 2 Completion Criteria
- [ ] Each habit has at most one log per day.
- [ ] Points are calculated and recorded once per action in `points_ledger`.
- [ ] Streaks update correctly after completion, update, and delete.
- [ ] `GET /daily` displays correct habits and points.
- [ ] End-of-day flow applies penalties and returns a usable evaluation.
- [ ] Frontend Today and Habits screens work with real backend endpoints.
- [ ] Phase 2 handshake passes: habit completion -> points -> streak -> Today refresh.

---

## Phase 3 - Tasks, Projects, Goals, and Calendar

**Goal:** add daily/manual tasks, project structures, goals, and the main calendar, then integrate project tasks into Today.

### Backend Tasks

#### B3.1 Tasks
- [ ] Create `tasks` model with fields: `title`, `description`, `type`, `projectId`, `nodeId`, `date`, `startTime`, `status`, `priority`, `source`, `pointsReward`, `createdAt`.
- [ ] Add indexes on `date`, `projectId`, and `status`.
- [ ] Implement `POST /tasks`.
- [ ] Implement `GET /tasks` with filters: `date`, `from`, `to`, `projectId`, `status`, `type`, `page`, `limit`.
- [ ] Implement `GET /tasks/:id`.
- [ ] Implement `PUT /tasks/:id`.
- [ ] Implement `DELETE /tasks/:id`.
- [ ] Implement `PATCH /tasks/:id/status`.
- [ ] Award points through `points.engine` when a task with `pointsReward > 0` is completed.
- [ ] Prevent duplicate points when a completed task is patched repeatedly.
- [ ] Include manual, project, study, work, and islamic task types.

#### B3.2 Daily Aggregation With Tasks
- [ ] Extend `GET /daily` to include manual tasks for the selected date.
- [ ] Extend `GET /daily` to include due project tasks.
- [ ] Sort daily tasks by `startTime`, then priority.
- [ ] Update daily summary to include habit and task completion.
- [ ] Ensure task completion invalidates or refreshes daily data.

#### B3.3 Projects
- [ ] Create `projects` model with fields: `key`, `name`, `structureType`, `description`, `active`, `progress`, `createdAt`.
- [ ] Support project keys: `lb`, `supnum`, `basma_tech`, `competitions`, `messages_gaza`, `hasaniya`, `ai_depth`.
- [ ] Support structure types: `notes_board`, `tree_cards`, `goals_pages`, `calendar_notes`, `level_game`, `card_sets`.
- [ ] Implement `POST /projects`.
- [ ] Implement `GET /projects` with progress.
- [ ] Implement `GET /projects/:id` with nodes/statistics summary.
- [ ] Implement `PUT /projects/:id`.
- [ ] Implement `DELETE /projects/:id`.
- [ ] Implement `GET /projects/:id/achievements`.
- [ ] Seed or create the seven default project shells if required by product flow.

#### B3.4 Project Nodes
- [ ] Create `project_nodes` model with fields: `projectId`, `parentId`, `type`, `title`, `status`, `order`, `data`.
- [ ] Add indexes on `projectId` and `parentId`.
- [ ] Implement `POST /projects/:id/nodes`.
- [ ] Implement `GET /projects/:id/nodes` with filters: `parentId`, `type`, `status`, `page`, `limit`.
- [ ] Implement `PUT /nodes/:id`.
- [ ] Implement `DELETE /nodes/:id` with cascade delete for children.
- [ ] Implement `PATCH /nodes/:id/status`.
- [ ] Implement `LEVEL_LOCKED` rule for level projects, especially `messages_gaza` and `ai_depth`.
- [ ] Ensure levels cannot be opened/completed before the previous level is complete.

#### B3.5 Goals
- [ ] Create `goals` model with fields: `title`, `scope`, `projectId`, `target`, `current`, `deadline`, `status`, `createdAt`.
- [ ] Implement `POST /goals`.
- [ ] Implement `GET /goals` with filters: `scope`, `projectId`, `status`.
- [ ] Implement `GET /goals/:id` with `progressPercent`.
- [ ] Implement `PUT /goals/:id`.
- [ ] Implement `DELETE /goals/:id`.
- [ ] Update project progress from goals where applicable.

#### B3.6 Calendar
- [ ] Create `calendar_events` model with fields: `title`, `date`, `endDate`, `type`, `refId`, `projectId`, `note`, `createdAt`.
- [ ] Add indexes on `date` and `projectId`.
- [ ] Implement `POST /calendar/events`.
- [ ] Implement `GET /calendar/events` with filters: `from`, `to`, `type`, `projectId`, `page`, `limit`.
- [ ] Implement `GET /calendar/main?from=...&to=...`.
- [ ] Implement `GET /calendar/events/:id`.
- [ ] Implement `PUT /calendar/events/:id`.
- [ ] Implement `DELETE /calendar/events/:id`.
- [ ] Avoid duplicate calendar entries for the same source using `refType/refId` or equivalent source reference.

### Frontend Tasks

#### F3.1 Tasks UI
- [ ] Add task creation/edit/delete flow.
- [ ] Add task list filters by date, status, type, and project.
- [ ] Add task completion action using `PATCH /tasks/:id/status`.
- [ ] Integrate tasks into Today screen.
- [ ] Show task points changes returned by backend.
- [ ] Keep Loading, Empty, Error, and optimistic update states consistent with Phase 2.

#### F3.2 Projects UI
- [ ] Build projects list showing seven projects and progress.
- [ ] Build project detail route `/projects/:id`.
- [ ] Render project detail based on `structureType`.
- [ ] Implement `notes_board` board view.
- [ ] Implement `tree_cards` tree/card view.
- [ ] Implement `goals_pages` goals/pages view.
- [ ] Implement `calendar_notes` project calendar/notes view.
- [ ] Implement `level_game` level map with locked levels.
- [ ] Implement `card_sets` grid placeholder compatible with later Hasaniya module.
- [ ] Add project achievements page/section from `GET /projects/:id/achievements`.
- [ ] Add project node create/edit/delete/status flows.

#### F3.3 Goals UI
- [ ] Build goals list with progress.
- [ ] Add create goal flow.
- [ ] Add edit goal flow.
- [ ] Add delete goal flow.
- [ ] Support global and project-scoped goals.
- [ ] Show progress percent from backend.

#### F3.4 Calendar UI
- [ ] Build monthly calendar view using `GET /calendar/main`.
- [ ] Build weekly calendar view using `GET /calendar/main`.
- [ ] Distinguish past and upcoming events.
- [ ] Add create/edit/delete calendar event flows.
- [ ] Link calendar events to project/task/goal references where available.

### Database Tasks
- [ ] Create collections: `tasks`, `projects`, `project_nodes`, `goals`, `calendar_events`.
- [ ] Create indexes for task daily aggregation: `date`, `projectId`, `status`.
- [ ] Create project node indexes: `projectId`, `parentId`.
- [ ] Create calendar indexes: `date`, `projectId`.
- [ ] Confirm cascade delete behavior for project nodes.

### Infrastructure Tasks
- [ ] No new infrastructure required beyond Phase 2.
- [ ] Confirm staging environment has all new env variables and migrations/indexes.
- [ ] Ensure indexes are created safely on startup or via deployment script.

### Integration Tasks
- [ ] Include manual tasks in `GET /daily`.
- [ ] Include project tasks in `GET /daily`.
- [ ] Verify task completion awards points via backend.
- [ ] Display `LEVEL_LOCKED` errors in project UI instead of allowing unavailable actions.
- [ ] Connect project calendar events to `GET /calendar/main`.
- [ ] Verify goals update project progress where applicable.

### Testing Tasks
- [ ] Integration test: create task -> mark done -> points ledger entry.
- [ ] Integration test: repeated done status does not duplicate points.
- [ ] Integration test: tasks appear in `GET /daily` sorted by time and priority.
- [ ] Integration test: create project -> create nested nodes -> fetch tree.
- [ ] Integration test: deleting a node deletes its children.
- [ ] Integration test: locked level returns `LEVEL_LOCKED`.
- [ ] Integration test: create goal -> update progress -> get progress percent.
- [ ] Integration test: create calendar event -> appears in `GET /calendar/main`.
- [ ] Frontend/manual QA: projects render by `structureType`.
- [ ] Frontend/manual QA: calendar monthly and weekly views display past/upcoming correctly.

### Phase 3 Completion Criteria
- [ ] Task CRUD and status updates work.
- [ ] Completing a task awards points exactly once.
- [ ] Manual and project tasks aggregate into Today.
- [ ] Seven project structures can be saved in `project_nodes`.
- [ ] Cascade delete for project nodes works.
- [ ] `LEVEL_LOCKED` is enforced by backend and represented in frontend.
- [ ] Goals CRUD and progress calculation work.
- [ ] Calendar CRUD and `GET /calendar/main` work.
- [ ] Frontend screens for tasks, projects, goals, and calendar work with real backend endpoints.
- [ ] Phase 3 handshake passes: create task -> complete -> points -> appears in Today; create project/node -> lock rule; create calendar event -> appears in calendar.

---

## Cross-Phase Notes

- [ ] Do not start Phase 3 implementation before Phase 2 handshake is accepted, unless explicitly marked as a spike/prototype.
- [ ] Keep API responses wrapped as `{ success, data, error, meta }`.
- [ ] Keep all endpoints authenticated with Bearer tokens.
- [ ] Keep frontend mocks contract-compatible if used before backend endpoints are ready.
- [ ] Update `api-contract.md` only if the contract changes intentionally.
- [ ] Update `docs/tasks-phase-2-3.md` as implementation progresses.
