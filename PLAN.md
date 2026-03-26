# React Native Implementation Plan

## Phase 1 - Foundation and Design System

### Goals
- Replace Expo starter UI with app shell aligned to the design direction in `design/`.
- Introduce app theme tokens (surfaces, typography, spacing, sharp corners).
- Set up tab routes: Prepare, Practice, Insights, Profile.
- Add first-run API setup route and also expose API key entry in Settings.

### Deliverables
- Shared theme constants and primitive UI wrappers.
- Root navigation and tab layout.
- Placeholder screens with real visual styling (not template screens).

### Visible UI Test
- Start app and verify first screen is API setup when key is missing.
- Enter key -> app navigates to tabs.
- Open Profile/Settings and confirm API key editor exists there too.
- Confirm visual style: sharp edges, no rounded pill components, dark tonal layers.

### Automated Tests
- Navigation gate logic tests (first-run setup gate behavior).
- Theme token existence tests.

---

## Phase 2 - Data Models, Storage, and Session Repository

### Goals
- Implement TypeScript domain models mapped to backend schema:
  - `Difficulty`, `Evaluation`, `Answer`, `Question`, `QuestionList`.
- Add app-level `Session` model with human-friendly id and timestamp suffix.
- Implement plain-text local JSON persistence for settings and sessions.
- Add local audio file indexing support for offline playback.

### Deliverables
- Domain model files and validators.
- Repository layer for sessions/settings.
- Session naming helper using generated friendly name + system timestamp.

### Visible UI Test
- Create a test session from stub data and verify it appears in session list.
- Reload app and confirm session still exists.
- Verify session id/title is human-readable and unique.

### Automated Tests
- Session name/id generation tests.
- Serialization/deserialization tests for session repository.
- Validation tests for question/answer model structures.

---

## Phase 3 - Prepare Flow (Combined Screen)

### Goals
- Build combined Prepare screen with:
  - Input mode toggle: Text Description OR Image Upload.
  - Difficulty selection (default Easy/Medium/Hard).
  - Question count per selected batch (default 20, max 30).
  - Generation progress panel by difficulty.
  - Past sessions on same screen.
- Enforce image constraints: max 5 images, each <= 6MB.

### Deliverables
- Prepare screen and generation controls.
- Input validation and error states.
- Progress states and session list integration.

### Visible UI Test
- Toggle between Text and Image mode; verify mutual exclusivity.
- Try selecting 6 images and verify block/error.
- Try image > 6MB and verify block/error.
- Set batch size > 30 and verify validation failure.
- Run generation and watch progress bars/cards update.

### Automated Tests
- Mode toggle exclusivity tests.
- Image cap and size validation tests.
- Batch size range tests.

---

## Phase 4 - Prompt Templating and Settings-driven Behavior

### Goals
- Implement prompt template engine using settings values:
  - Model variant.
  - Evaluation strictness.
  - System instruction persona.
- Show resolved prompt preview in Settings.
- Persist prompt settings and include snapshot inside each session config.

### Deliverables
- Prompt template resolver.
- Live preview component in Settings.
- Persistence and session snapshot linkage.

### Visible UI Test
- Change strictness/model/persona and confirm preview text updates immediately.
- Start generation and inspect session JSON to verify config snapshot was saved.

### Automated Tests
- Template interpolation tests.
- Strictness/model mapping tests.
- Session snapshot consistency tests.

---

## Phase 5 - Practice Flow with Audio Attempts and Online Evaluation

### Goals
- Build active interview UI and question runner.
- Add configurable recording cap in Settings and enforce in recorder.
- Save each attempt locally (multiple attempts per question allowed).
- Trigger online evaluation only after submit.
- Support offline playback of all saved recordings.
- Queue pending evaluations when offline and auto-run on reconnect.

### Deliverables
- Practice screen with question context, recording controls, attempt history.
- Evaluation pipeline and retry queue.
- Offline playback from local file paths.

### Visible UI Test
- Record two attempts on same question and verify both attempts are listed.
- Submit while offline and verify status shows pending.
- Reconnect and verify pending attempt is auto-evaluated.
- Play old recordings in airplane mode.

### Automated Tests
- Attempt append-only behavior tests.
- Offline pending queue tests.
- Auto-retry on reconnect tests.
- Recording cap enforcement tests.

---

## Phase 6 - Insights Placeholder Dashboard

### Goals
- Build insights UI from current session/evaluation data with placeholder metrics.
- Show readiness score, tier accuracy, recent trend, recommendation cards.
- Mark placeholder logic explicitly for future replacement.

### Deliverables
- Insights screen wired to repository data.
- Placeholder metric calculator utilities.

### Visible UI Test
- Complete several evaluated attempts and verify charts/cards update.
- Switch sessions and verify insight values change accordingly.

### Automated Tests
- Placeholder metric computation tests.
- Empty-state and no-data tests.

---

## Phase 7 - End-to-End Polish and Hardening

### Goals
- Improve loading/error UX, skeleton states, retries, and edge-case handling.
- Add accessibility labels and test IDs for critical controls.
- Validate all user constraints and business rules end-to-end.

### Deliverables
- Production-ready UX pass.
- Expanded tests and QA checklist completion.

### Visible UI Test
- Walk through complete flow:
  - API setup -> Prepare -> Generate -> Practice -> Evaluate -> Insights -> Reload session.
- Verify no crashes during interrupted network or app restarts.

### Automated Tests
- High-value integration tests for happy path and failure path.
- Regression tests for key constraints.

---

## Exit Criteria
- All automated tests pass.
- All phase UI checks are manually verified.
- Core constraints enforced:
  - Text/image mode is exclusive.
  - Max 5 images, each <= 6MB.
  - Max 30 questions per selected batch.
  - Multiple answer attempts per question.
  - Post-submit evaluation only.
  - Offline recordings playable.
  - Pending evaluations auto-run on reconnect.
