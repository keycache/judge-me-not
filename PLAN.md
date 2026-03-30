# React Native Implementation Plan

## Status Snapshot
- Phase 1: Complete
- Phase 2: Complete
- Phase 3: Complete
- Phase 4: Complete
- Phase 5: In progress (re-scoped below)
- Phase 6: Complete
- Phase 6.1: Complete
- Phase 7: In progress
- Phase 8: In progress (8A complete)

---

## Phase 1 - Foundation and Design System (Complete)

### Goals
- Replace Expo starter UI with app shell aligned to the design direction in `design/`.
- Introduce app theme tokens (surfaces, typography, spacing, sharp corners).
- Set up tab routes: Prepare, Practice, Insights, Profile.
- Add first-run API setup route and expose API key entry in Profile.

### Deliverables
- Shared theme constants and primitive UI wrappers.
- Root navigation and tab layout.
- First-run gate and API setup screen.

---

## Phase 2 - Data Models, Storage, and Session Repository (Complete)

### Goals
- Implement local session/settings storage with JSON-backed repository behavior.
- Persist generated sessions, questions, and attempt metadata locally.

### Deliverables
- Domain model and repository scaffolding.
- Serialization/deserialization path for sessions and settings.

---

## Phase 3 - Prepare Flow (Complete)

### Goals
- Combined Prepare screen with text/image mode, difficulty selection, batch size, and progress.
- Session list surfaced on the same screen.

### Deliverables
- Input validation and progress UI.
- Session creation and listing from local storage.

---

## Phase 4 - Prompt Templating and Settings Integration (Complete, Needs Enhancement in Phase 5)

### Goals
- Prompt templating wired to Profile settings.
- Snapshot prompt config into session metadata.
- Plan migration of model provider wiring to Google GenAI SDK (`@google/genai`) for multimodal text outputs.

### Deliverables
- Prompt resolver and Profile editing flow.
- Saved settings used by generation/evaluation pipeline.
- Provider integration plan:
  - Use `GoogleGenAI` client as the primary LLM interface.
  - Use API key from app settings/env (`GEMINI_API_KEY`) through a repository-backed provider config.
  - Keep prompt composition provider-agnostic while request execution is provider-specific.

---

## Phase 5 - Practice + Schema/Prompt Alignment + Session UX (In Progress)

### Progress Tracker (Implemented vs Remaining)
- Implemented:
  - Schema alignment foundation migrated to Python-style fields for interview domain objects.
  - Practice session/question selection UI implemented as dropdown-based selectors + random no-repeat cycle behavior.
  - Selected-question details panel implemented (full question + category + difficulty + expected-answer focus).
  - Past answers in Practice moved into collapsible section under selected question details.
  - Evaluator prompt composer has core + strictness + schema JSON embedding baseline.
  - Phase 5B kickoff in code:
    - one-liner session naming utility (60-char cap) wired into Prepare generation.
    - compact Past Sessions rows (title + metadata only).
    - session details modal implemented (text details + image carousel with index/dots).
    - row-level session delete action implemented with confirmation.
  - Phase 5C completed in code:
    - session details modal now shows generation settings (model, strictness, persona).
    - text sessions display source description in details modal.
    - image sessions display carousel count/index metadata with URI previews.
  - Phase 5D completed in code:
    - Google GenAI SDK integrated for question generation and answer evaluation.
    - schema-validated JSON parsing added for generated question lists and evaluations.
    - online evaluation now falls back to pending-queue retry when live evaluation fails.
    - request builder + parser tests added for text, image, and audio flows.
- Remaining in Phase 5:
  - Session naming from model-generated one-liner title (currently deterministic local helper; replace with LLM output path).
  - Complete broader integration coverage for full end-to-end generation/evaluation flows in app-level tests.

### Sub-Phases
- Phase 5A - Completed Core Foundations
  - Domain schema rename/refactor and repository baseline migration.
  - Practice selection + random cycle baseline.
  - Prompt template architecture baseline.
- Phase 5B - Session Naming + Prepare Session UX
  - Generate a concise user-friendly session name using LLM output (one-liner), then append timestamp/identity suffix for uniqueness.
  - Update Prepare > Past Sessions cards to show only concise title + metadata, not full source text blob.
  - Add tap-to-open session details and delete-session affordance.
- Phase 5C - Session Details Modal + Media/Text Context
  - Completed: text sessions now show source description and generation settings.
  - Completed: image sessions now show carousel view with count/index.
- Phase 5D - GenAI Production Integration + Validation
  - Completed: replaced mock generation/evaluation with Google GenAI SDK request paths.
  - Completed: parse and validate JSON responses against schema.
  - Completed: added resiliency/error handling and regression tests for request/parse/retry behavior.

### Locked Product Decisions (Mar 27, 2026)
- Session one-liner title max length: 60 characters.
- Session details presentation: modal on Prepare screen.
- Delete session control: trash icon on each Past Sessions row.

### Goals
- Add explicit session/question controls in Practice:
  - Session dropdown (single-select).
  - Question dropdown filtered by selected session (single-select, user-friendly one-line labels).
  - Random question picker button that draws from the same filtered list.
- Show selected question in a dedicated details panel with full text and metadata.
- Show user past answers in a collapsible section under the selected question details.
- Random picker must avoid repeats until all questions for the selected session are exhausted, then reset cycle.
- Align TS data structures to match the Python Pydantic schema fields exactly (no backward compatibility migration).
- Keep session-as-JSON approach as the primary persistence model.
- Use Google GenAI multimodal calls for both required model interactions:
  - Question generation from image input (Prepare image mode).
  - Evaluation from question + ideal answer + recorded audio.
- Improve Prepare session management UX:
  - LLM-generated one-line user-friendly session names.
  - Past Sessions list should not repeat full source text under title.
  - Session details view on tap (text detail or image carousel).
  - Session delete action.

### Required Schema Alignment
- `Difficulty`: `Easy | Medium | Hard`.
- `Evaluation`:
  - `score`
  - `candidate_answer`
  - `feedback`
  - `gaps_identified`
  - `model_answer`
- `Answer`:
  - `audio_file_path`
  - `timestamp`
  - `evaluation` (optional)
- `Question`:
  - `value`
  - `category`
  - `difficulty`
  - `answer`
  - `answers` (optional list)
- `QuestionList`:
  - `questions`

### Prompt Architecture Requirements
- Use one evaluator system prompt template that is dynamically composed from:
  - Invariant core evaluator instructions.
  - Strictness block (3 variants: lenient, balanced, strict).
  - Profile-provided custom prompt text appended after core + strictness.
- Embed schema JSON in system prompt text for structured output requirements.
- Keep generator/evaluator prompt composition deterministic and testable.
- Ensure generated model output is parsed and validated against schema after every call (question generation + evaluation).

### Deliverables
- Practice screen UX update (session dropdown, question dropdown, random-no-repeat picker).
- Practice selected-question details card and collapsible past-answers area.
- Model/repository refactor to schema-aligned field names.
- Evaluator prompt composer with strictness-specific fragments.
- Schema JSON embed utility reused by prompt builder.
- Prepare session UX enhancements:
  - Session title generation utility using LLM one-liner response + timestamp-safe identity.
  - Session list card compaction (title-only/short metadata).
  - Session details screen/modal with text/image source rendering.
  - Delete session action + confirmation + state refresh.
- Google GenAI SDK integration deliverables:
  - Shared `GenAIClient` wrapper around `GoogleGenAI`.
  - Multimodal question generation request builder:
    - Text-only path (description mode).
    - Image + text path using file upload (`ai.files.upload`) and URI parts.
  - Multimodal evaluation request builder:
    - Prompt payload includes question + ideal answer + audio file reference.
  - Structured JSON parsing + schema validation layer on response text.

### Visible UI Test
- Select session in Practice and verify question dropdown updates accordingly.
- Verify session and question selectors render as dropdown controls (not row-chip lists).
- Verify dropdown option labels are concise one-liners for sessions/questions.
- Click random picker repeatedly and confirm no repeated questions until full cycle completion.
- Switch session and confirm picker state is isolated per selected session.
- After selecting a question, verify full question details + metadata are shown in details panel.
- Expand/collapse past answers section and verify prior attempts are shown/hidden correctly.
- Record and submit attempts; verify saved session JSON uses schema-matching field names.
- Generate session from long text; verify displayed title is a one-liner and not the whole prompt text.
- Tap session row:
  - text mode: source text is visible in details view.
  - image mode: selected images render in a carousel.
- Delete a session and verify it disappears immediately and remains deleted after app restart.

### Automated Tests
- Session-to-question filtering tests.
- Dropdown selector rendering and selection tests.
- Random question no-repeat cycle tests.
- Selected-question details rendering tests.
- Collapsible past-answers visibility tests.
- Schema shape validation tests (generated/evaluated payloads).
- Prompt composer tests:
  - Core block always present.
  - Correct strictness fragment selected.
  - Profile text appended.
  - Schema JSON embedded.
- Prepare session UX tests:
  - Session title derived from one-liner naming output.
  - Session list does not render full source text body inline.
  - Session details routing + content mode (text vs image carousel).
  - Session delete flow and persistence.

### Automated Test Cases (Detailed)
1. `practice_session_dropdown_lists_sessions`
- Seed multiple sessions and assert session selector options match persisted sessions.
2. `practice_question_dropdown_filters_by_selected_session`
- Select `sessionA` and assert only `sessionA.questionList.questions` appear.
3. `practice_question_selection_resets_when_session_changes`
- Pick a question in `sessionA`, switch to `sessionB`, assert stale question id is cleared.
4. `practice_random_picker_no_repeat_until_cycle_complete`
- For `N` questions, trigger random picker `N` times and assert all picked ids are unique.
5. `practice_random_picker_resets_after_cycle`
- After first full cycle, trigger one more pick and assert cycle restarts without crash.
6. `practice_random_picker_state_isolated_per_session`
- Advance random state in `sessionA`, switch to `sessionB`, assert `sessionB` starts fresh.
7. `schema_difficulty_enum_accepts_only_easy_medium_hard`
- Validate parser rejects non-enum values and accepts exact values.
8. `schema_evaluation_requires_required_fields`
- Assert `score`, `candidate_answer`, `feedback`, `gaps_identified`, `model_answer` are required.
9. `schema_answer_requires_audio_file_path_and_timestamp`
- Assert missing `audio_file_path` or `timestamp` fails validation.
10. `schema_question_requires_value_category_difficulty_answer`
- Assert required question fields are enforced and `answers` remains optional list.
11. `session_json_roundtrip_preserves_schema_fields`
- Save/load session JSON and assert exact schema keys are retained.
12. `prompt_template_contains_invariant_core_block`
- Render evaluator prompt and assert invariant section is always present.
13. `prompt_template_injects_lenient_fragment`
- Strictness `lenient` renders lenient block and excludes strict-only directives.
14. `prompt_template_injects_balanced_fragment`
- Strictness `balanced` renders balanced block.
15. `prompt_template_injects_strict_fragment`
- Strictness `strict` renders strict block and tighter evaluation instructions.
16. `prompt_template_appends_profile_custom_prompt_last`
- Assert Profile custom text appears after core + strictness blocks.
17. `prompt_template_embeds_schema_json`
- Assert prompt includes serialized schema JSON with expected top-level keys.
18. `offline_pending_queue_processes_on_reconnect_with_schema_fields`
- Queue pending evaluations offline, reconnect, assert completion payload matches schema.
19. `genai_question_request_text_mode_builds_expected_contents`
- Assert `generateContent` payload contains text prompt only for text input mode.
20. `genai_question_request_image_mode_builds_expected_contents`
- Assert file upload + URI part are included for image mode question generation.
21. `genai_evaluation_request_includes_question_model_answer_and_audio`
- Assert evaluation request payload includes all required contextual fields and audio reference.
22. `genai_response_parser_rejects_non_json_text`
- Assert non-JSON model text fails parsing and returns typed error.
23. `genai_response_parser_accepts_schema_conformant_json`
- Assert valid JSON is accepted and mapped into schema-aligned domain model.
24. `prepare_session_title_uses_one_liner_name`
- For long text input, ensure generated session title is a concise one-liner string.
25. `prepare_session_list_hides_full_source_text`
- Assert long source text is not shown inline in Past Sessions rows.
26. `prepare_session_details_text_mode_shows_source_text`
- Tap text-mode session and assert source text is visible in details view.
27. `prepare_session_details_image_mode_shows_carousel`
- Tap image-mode session and assert carousel renders selected image URIs.
28. `prepare_delete_session_removes_from_storage_and_ui`
- Delete from list, assert repository no longer contains session and UI updates immediately.
29. `practice_session_selector_renders_dropdown_not_chip_list`
- Assert Practice shows a single session dropdown trigger and opens modal list on tap.
30. `practice_question_selector_renders_dropdown_not_chip_list`
- Assert Practice shows a single question dropdown trigger filtered by selected session.
31. `practice_dropdown_labels_are_user_friendly_one_liners`
- Assert visible selector labels are single-line previews and not full multi-line payload text.
32. `practice_selected_question_details_shows_full_question_and_metadata`
- Select question and assert full value/category/difficulty/expected-answer fields render.
33. `practice_past_answers_collapsible_toggles_visibility`
- Toggle collapsible and assert attempt rows appear/disappear without losing state.
34. `practice_question_change_resets_collapsible_state`
- Open past answers, change question, assert collapsible resets to default collapsed state.

---

## Phase 6 - Profile Data Management + Insights Baseline

### Progress Tracker
- Implemented:
  - Repository-level full local reset path for sessions, settings, pending evaluations, and API key.
  - Profile `Clear All Data` destructive action with confirmation UX.
  - Insights baseline summary now reads schema-aligned session/question/answer/evaluation data and renders an empty state when no evaluations exist.
  - Empty-state regression coverage added for Prepare, Practice, Insights, and app boot routing after clear-all.
  - Insights expanded beyond baseline aggregates into per-session/session-switch views.

### Status
- Complete.

### Goals
- Add Profile action to clear all app data and reset to clean slate:
  - Sessions
  - Answers
  - Pending queues
  - Cached/local JSON stores
  - Any derived prompt/session snapshots
- Keep API key behavior explicit (clear-all should define whether key is retained or removed; default: removed for full clean slate).
- Bring Insights to baseline compatibility with schema-aligned data.

### Deliverables
- `Clear All Data` destructive action in Profile with confirmation UX.
- Repository-level reset function(s) for complete local wipe.
- Insights baseline read path updated for new schema fields.

### Visible UI Test
- Create sessions/attempts, then run `Clear All Data` and verify app returns to empty state.
- Restart app and confirm cleared state persists.
- Confirm Practice/Prepare/Insights all handle empty state after reset.

### Automated Tests
- Full reset repository tests.
- Empty-state regression tests for all tabs after reset.

### Automated Test Cases (Detailed)
1. `profile_clear_all_removes_sessions`
- Seed sessions, execute clear-all, assert session repository is empty.
2. `profile_clear_all_removes_answers_and_evaluations`
- Seed answers/evaluations, execute clear-all, assert no answer artifacts remain.
3. `profile_clear_all_removes_pending_queue`
- Seed pending evaluation queue, execute clear-all, assert queue length is zero.
4. `profile_clear_all_removes_prompt_snapshots_and_settings`
- Seed prompt snapshot/settings, execute clear-all, assert defaults restored.
5. `profile_clear_all_removes_api_key`
- Persist API key, execute clear-all, assert key store is empty.
6. `clear_all_is_idempotent`
- Run clear-all twice and assert second run succeeds with no side effects/errors.
7. `app_boot_after_clear_all_routes_to_setup`
- After clear-all + app restart, assert navigation gate routes to setup screen.
8. `prepare_empty_state_after_clear_all`
- Assert no sessions shown and generation screen remains functional.
9. `practice_empty_state_after_clear_all`
- Assert session/question selectors and controls handle empty data safely.
10. `insights_empty_state_after_clear_all`
- Assert insights renders no-data placeholder without exceptions.

---

## Phase 6.1 - Practice Tab UX Refinement and Playback Polish

### Progress Tracker
- Implemented:
  - Practice answer cards now use numbered attempt titles (`Attempt #n`) instead of timestamps as the primary label.
  - Draft, pending, and completed attempts render compact status badges with icon-based state indicators.
  - Playback control moved into the attempt header as an icon button and replay now correctly restarts finished audio from the beginning.
  - Playback scrub bar now persists for every attempt that has local audio instead of only appearing while active.
  - Audio file-path text was removed from Practice answer surfaces before and after submission.
  - Evaluated attempts now render tabbed answer details for `candidate_answer`, `feedback`, `gaps_identified`, and `model_answer`.
  - Attempt score styling was increased for clearer scanability.
  - Selected Question Details was simplified to use the question text as the main title, removed expected-answer copy, and converted category/difficulty metadata into subtle inline badges.
  - Practice screen layout was reordered so `Question Runner` appears before `Past Answers`, with `Past Answers` now anchored as the last section on the page.
  - Draft attempt submission now shows an in-flight spinner and disables repeat taps until the submit request settles.

### Status
- Complete.

### Goals
- Improve scanability and usability of Practice attempt cards.
- Reduce unnecessary visual noise in question details and answer history.
- Make playback behavior reliable and consistently discoverable.
- Prevent duplicate submits for draft attempts during evaluation handoff.

### Deliverables
- Practice attempt card redesign with compact header actions and status affordances.
- Persistent playback timeline for attempts with local recordings.
- Tabbed evaluated-answer detail panel.
- Simplified selected-question summary card.
- Reordered Practice layout with `Past Answers` at the bottom.
- Disabled submit + loading indicator state for in-flight draft submissions.

### Visible UI Test
- Open Practice, select a question, and verify the question text is the primary title in Selected Question Details.
- Verify Category and Difficulty render as subtle badge-style labels on one row.
- Expand `Past Answers` and verify numbered attempts, compact status display, header-level playback icon, and always-visible playback bar for recorded attempts.
- Play an attempt to completion, then tap play again and verify the same clip replays immediately.
- Submit a draft attempt and verify the Submit control disables and shows a spinner until the request resolves.
- Confirm `Question Runner` appears above `Past Answers` in the overall page order.

### Automated Tests
- Practice selector rendering and session-to-question filtering tests.
- Selected-question detail rendering tests.
- Past-answer collapsible visibility and reset tests.
- Evaluated-attempt tab content tests.
- Persistent playback panel rendering tests.
- Draft submit in-flight loading-state test.

### Automated Test Cases (Detailed)
1. `practice_disables_draft_submit_and_shows_spinner_while_submission_is_in_flight`
- Mocks a pending submit request, presses Submit on a draft attempt, and asserts the submit action is only invoked once while spinner UI is visible.
2. `practice_renders_session_and_question_dropdown_triggers`
- Verifies the two selector entry points render on initial load.
3. `practice_question_dropdown_filters_by_selected_session`
- Switches sessions and asserts the question dropdown only shows questions for the selected session.
4. `practice_selected_question_details_render_question_title_and_metadata_badges`
- Asserts the selected question text renders as the primary detail content and that `Category` / `Difficulty` badges appear without the old expected-answer text block.
5. `practice_selector_labels_are_user_friendly_one_line_previews`
- Verifies session and question dropdown options use truncated one-line preview labels for long content.
6. `practice_past_answers_collapsible_resets_when_question_changes`
- Opens `Past Answers`, confirms attempt content is shown, switches questions, and asserts the collapsible returns to its default closed state.
7. `practice_evaluated_answer_details_render_inside_tabbed_panels`
- Confirms evaluated attempts expose tabbed `candidate_answer`, `feedback`, `gaps_identified`, and `model_answer` content.
8. `practice_attempt_playback_panel_is_visible_for_recorded_attempts`
- Verifies attempts with local audio render a persistent playback panel even before playback begins.

---

## Phase 7 - End-to-End Hardening and QA

### Progress Tracker
- Implemented:
  - Refreshed the cross-screen Prepare -> Practice integration test to match the current Practice UI and verified evaluated-attempt state renders correctly.
  - Extended integration coverage through Insights so the happy path now validates derived readiness metrics after evaluation.
  - Added interruption-path integration coverage for offline draft submission followed by reconnect-driven pending evaluation processing.
  - Persisted Practice session selection through settings and added restart recovery integration coverage for remounting the Practice screen on the previously selected session.
  - Added integration coverage for Profile prompt-setting persistence and verified updated model variant, strictness, persona, and recording cap propagate into Practice evaluation.
  - Added same-run recovery coverage for clearing all local data and successfully generating a brand-new session afterward.
  - Added targeted accessibility-label regressions for icon-driven controls on Prepare and Practice.
- Remaining:
  - Final accessibility-label audit and durable test-ID pass across remaining key controls.
  - Full QA checklist completion.

### Status
- In progress.

### QA Status
- Automated QA: Pass as of Mar 27, 2026.
  - Full Jest suite passed: 20/20 suites, 98/98 tests.
  - Latest full-suite run completed successfully after adding the remaining targeted Phase 7 tests for settings propagation, clear-all recovery, and accessibility-label coverage.
  - Non-blocking environment noise observed during the run:
    - shell startup warning from `.zprofile` referencing missing `/Users/akashpatki/.swiftly/env.shexport`
    - Watchman recrawl warning for the workspace watch
- Manual QA: Pending.

### Goals
- Stabilize edge cases across generation, recording, evaluation, offline queue, and reset flows.
- Add accessibility labels and durable test IDs on key controls.
- Validate all final business constraints end-to-end.

### Deliverables
- Integration test suite for complete flow and failure modes.
- Final QA checklist completion.

### Visible UI Test
- End-to-end walkthrough:
  - API setup -> Prepare -> Generate -> Practice (select/random question) -> Record -> Submit -> Insights -> Clear All Data -> Empty-state validation.
- Verify behavior across offline/online transitions and app restarts.

### Automated Tests
- High-value integration tests for happy path + interruption path.
- Regression suite for no-repeat randomization, strictness prompt composition, schema conformance, and reset behavior.

### Current Implemented Integration Coverage
- `prepare_to_practice_happy_path_surfaces_evaluation_in_insights`
  - Generates a session in Prepare, seeds an attempt, submits it in Practice, and verifies the evaluated result is reflected in Insights readiness metrics.
- `prepare_to_practice_offline_submit_then_reconnect`
  - Generates a session, submits a draft attempt while offline, verifies it is queued as pending, then simulates reconnect and asserts automatic evaluation completion.
- `practice_session_selection_restores_after_restart`
  - Switches Practice to a non-default session, unmounts/remounts the screen, and verifies the selected session/question restore from persisted settings.
- `profile_prompt_settings_persist_and_propagate_to_evaluation`
  - Saves Profile prompt/practice settings, verifies they persist across relaunch, then confirms Practice evaluation receives the updated prompt settings.
- `clear_all_then_generate_new_session_in_same_run`
  - Clears local data and verifies Prepare can create a brand-new session immediately without stale state leakage.

### Final QA Checklist
- Setup and boot
  - Fresh install or cleared app state opens the setup/API entry flow instead of tabs.
  - Saving a valid API key exits setup and unlocks the tabbed app shell.
  - Relaunch after setup preserves the configured state and does not re-open setup unexpectedly.
- Prepare flow
  - Text mode validates empty input, invalid question counts, and difficulty selection correctly.
  - Image mode enforces image-only flow, permission handling, max image count, and file-size guardrails.
  - Session generation shows progress/loading state and creates a persisted session with a concise title.
  - Generated session rows stay compact and open correct details when tapped.
  - Session details render source text for text sessions and image carousel context for image sessions.
  - Deleting a session removes it from the list immediately and it stays deleted after relaunch.
- Practice selection and question surfacing
  - Session dropdown, question dropdown, and random picker all work with current persisted sessions.
  - Question dropdown stays filtered to the selected session.
  - Random picker does not repeat within a cycle for the same session, then resets cleanly.
  - Restarting the app restores the previously selected Practice session without corruption.
  - Selected Question Details shows the question as the primary title with only category/difficulty badges.
- Practice recording and attempts
  - Starting/stopping recording updates recorder state and respects the configured recording cap.
  - Saved attempts appear under `Past Answers` with numbered titles and correct draft/pending/completed state.
  - Draft attempts can be deleted, while submitted/pending attempts cannot be deleted.
  - Draft submit disables while in flight and shows a loading indicator until the request resolves.
  - Audio playback starts, pauses, replays from the beginning after completion, and keeps the playback bar visible for recorded attempts.
  - Evaluated attempts show score, status, and all four tabbed detail sections correctly.
- Evaluation and offline resilience
  - Online submit produces a structured evaluation with schema-aligned fields and persists it to the session.
  - Offline submit queues the attempt, marks it pending, and does not lose the recording or attempt metadata.
  - Returning online auto-processes queued evaluations and removes completed items from the pending queue.
  - Failed online evaluation falls back to pending-queue behavior rather than losing the submit.
- Insights
  - Empty state appears when no evaluated attempts exist.
  - Evaluated attempts update readiness, average score, strongest category, and top gap correctly.
  - Session scope dropdown switches between all-session and single-session summaries without stale data.
- Profile and reset
  - Prompt settings and recording-limit settings save and persist across relaunch.
  - Clear All Data confirmation requires explicit confirmation and cancel leaves data intact.
  - Confirmed clear-all removes sessions, answers, pending queue, settings, and API key.
  - After clear-all, the app returns to setup/empty states cleanly and can create a brand-new session in the same run.
- Accessibility and durability
  - Core controls expose stable test IDs and usable accessibility labels where interaction depends on icons or custom pressables. Targeted regression coverage now exists for Prepare delete icon and Practice playback icon controls.
  - No critical flow depends only on color to communicate state.
  - Text remains readable on supported device sizes without clipping important controls.
- Final regression sweep
  - Full automated suite passes before release candidate sign-off. Status: Pass on Mar 27, 2026 (`20/20` suites, `98/98` tests).
  - Manual happy-path walkthrough completes without stale state across app restarts.
  - Manual offline/reconnect walkthrough completes without queue leakage or duplicate evaluations.
  - Manual clear-all walkthrough completes without leftover sessions, prompts, or pending evaluations.

### Automated Test Cases (Detailed)
1. `e2e_happy_path_full_flow`
- API setup -> generate session -> select session/question -> record -> submit -> evaluate -> insights update.
2. `e2e_random_question_flow_no_repeat`
- Complete a full random cycle and assert no duplicate question within cycle.
3. `e2e_offline_submit_then_reconnect`
- Submit offline, relaunch online, assert pending evaluations auto-complete.
4. `e2e_app_restart_mid_practice`
- Restart during active session and assert state recovery without corruption.
5. `e2e_prompt_strictness_switch_affects_evaluator_prompt`
- Change strictness and assert generated evaluator prompt changes only in strictness fragment.
6. `e2e_profile_custom_prompt_propagates_to_evaluator`
- Update Profile prompt text and assert new evaluations include appended instructions.
7. `e2e_schema_contract_on_generated_questions`
- Mock generation response and assert parser accepts only schema-conformant payload.
8. `e2e_schema_contract_on_evaluation_output`
- Mock evaluator output and assert parser rejects malformed payloads.
9. `e2e_clear_all_then_start_new_session`
- Clear all data and confirm user can create/use a new session in same app run.
10. `e2e_reset_then_offline_mode`
- After reset, run in offline mode and assert no stale queue/session leakage.
11. `e2e_prepare_image_to_questions_via_genai_multimodal`
- Upload image input and verify generated questions are produced via multimodal request path.
12. `e2e_practice_audio_to_evaluation_via_genai_multimodal`
- Submit recorded audio and verify structured evaluation fields are returned and persisted.
13. `e2e_clear_all_then_generate_new_session_same_run`
- Clear all local data, generate a fresh session immediately, and assert no stale session state leaks into the new run.
14. `ui_icon_controls_expose_accessible_labels`
- Assert icon-driven controls such as Prepare session delete and Practice attempt playback expose usable accessibility labels.

---

## Phase 8 - UX Polish

Full-app UX polish pass based on the holistic review in `PROPOSAL.md`.
Changes are sequenced so each sub-phase is shippable on its own and leaves the test suite green.

### Sub-Phases
- Phase 8A — Foundation (shared infra + hygiene) ✅ Complete
- Phase 8B — Prepare Screen ✅ Complete
- Phase 8C — Practice Screen
- Phase 8D — Insights + Profile
- Phase 8E — Navigation & Information Architecture

---

### Phase 8A — Foundation Polish

#### Goals
- Eliminate the root cause of layout shift on every screen by replacing inline status/error `<Text>` nodes with a shared toast system.
- Replace the literal `"v"` caret with a proper icon on all three dropdown triggers (Prepare, Practice, Insights).
- Extract the duplicated `SelectorDropdown` component into a shared UI primitive.
- Delete the unused Expo starter scaffolding (`explore.tsx`, `modal.tsx`) that is inconsistent with the design system.

#### Deliverables
- `components/ui/toast.tsx` — absolute-positioned, auto-dismissing toast with `info` / `success` / `warning` variants and slide-up/fade animation. Exposed as a `useToast()` hook + `<ToastContainer />` component so any screen can call `showToast({ message, variant })`.
- `components/ui/selector-dropdown.tsx` — shared modal dropdown extracted from `practice.tsx` and `insights.tsx`, replacing both local copies.
- Add `'chevron.down': 'expand-more'` to the icon mapping in `icon-symbol.tsx` and `icon-symbol.ios.tsx`. Update all three dropdown caret `<Text>` nodes to use `<IconSymbol name="chevron.down" />`.
- Remove `app/(tabs)/explore.tsx`, `app/modal.tsx`, and the `explore` `Tabs.Screen` entry from `app/(tabs)/_layout.tsx`.
- All existing tests remain green; add unit tests for the toast component.

#### Locked Decisions
- Toast auto-dismiss after 3 seconds for `info`/`success`, 5 seconds for `warning`.
- Toast replaces all `statusText`, `errorText`, and `errorList` inline patterns across all screens. Inline patterns are removed entirely (no dual display).
- `SelectorDropdown` props interface is identical to today's local version so migration is a drop-in.

#### Visible UI Test
- Trigger an action that currently shows an inline amber status message on each screen and confirm a bottom-anchored toast appears instead with no card resize.
- Observe that dropdown triggers now show a chevron icon rather than `"v"`.

#### Automated Tests
- `toast_renders_with_info_variant`
- `toast_renders_with_success_variant_green_colour`
- `toast_renders_with_warning_variant_amber_colour`
- `toast_auto_dismisses_after_configured_duration`
- `toast_does_not_close_early_when_message_changes`
- `selector_dropdown_renders_options_and_selects`
- `selector_dropdown_closes_on_backdrop_press`
- `selector_dropdown_closes_on_option_press`

#### Automated Test Cases (Detailed)
1. `toast_renders_with_info_variant`
   - Mount `<ToastContainer />` and call `showToast({ message: 'Saved.', variant: 'info' })`. Assert the toast text is visible.
2. `toast_renders_with_success_variant_green_colour`
   - Call `showToast({ message: 'Done.', variant: 'success' })`. Assert rendered style includes `AppTheme.colors.success`.
3. `toast_renders_with_warning_variant_amber_colour`
   - Call `showToast({ message: 'Error.', variant: 'warning' })`. Assert rendered style includes `AppTheme.colors.warning`.
4. `toast_auto_dismisses_after_configured_duration`
   - Using fake timers, advance time past the dismiss threshold. Assert toast is no longer visible.
5. `toast_does_not_close_early_when_message_changes`
   - Show two successive toasts and assert each completes its own dismiss cycle without early closure.
6. `selector_dropdown_renders_options_and_selects`
   - Mount shared `SelectorDropdown` with three options. Assert all options render; press one and assert callback fires with the correct key.
7. `selector_dropdown_closes_on_backdrop_press`
   - Mount with `visible={true}`. Press the backdrop. Assert `onClose` is called.
8. `selector_dropdown_closes_on_option_press`
   - Press any option row. Assert `onClose` is called.

---

### Phase 8B — Prepare Screen Polish

#### Goals
- Fix the core UX confusion where the Gallery / Take Photo buttons immediately launch a system picker instead of just selecting the source.
- Eliminate card-height instability when validation errors appear and when generation starts.
- Improve the image remove button quality and nested tab visual hierarchy.
- Clarify the session-list delete affordance.

#### Deliverables
- **Tab/action separation:** Gallery and Take Photo buttons become pure source selectors (no side effect on press). A distinct `+ Add Image` button below them calls the picker for the currently selected source. The image strip and constraints hint are always rendered in the composer area (empty state: `MAX_IMAGES` dashed placeholder slots) so the card height is stable regardless of how many images have been added.
- **Fixed-height status slot:** Reserve a single fixed-height container (`minHeight` matching the loading card) below the Generate Session button. Show either the loading state or validation errors in this one slot. Idle state is invisible but retains height so the button never moves.
- **Image remove button:** Replace the `"x"` text overlay with `<IconSymbol name="xmark" />`. Add `'xmark': 'close'` to the icon mapping. Increase the touch target to 24×24 with `hitSlop={10}`.
- **Nested tab hierarchy:** Wrap the Image Source sub-section in a `surfaceSecondary` background container with `borderSubtle` border and `xs` padding, replacing the left-border indent.
- **Session list delete:** Give the session row a two-column layout — content (title + meta) on the left, trash icon in a fixed-width right column — so the icon never overlaps the title regardless of title length.

#### Locked Decisions
- The image strip always renders when Image Upload mode is active. Empty slots are indicated by dashed-border placeholder tiles.
- The status slot is always allocated below the Generate button — no conditional rendering that changes card height.
- Gallery remains the default selected source tab.

#### Visible UI Test
- Switch to Image Upload. Confirm Gallery tab highlights but no picker opens. Tap `+ Add Image` and confirm picker opens. Dismiss picker and confirm no state changed.
- Upload one image. Confirm the strip adds a thumbnail without the card growing (the slot was already there).
- Tap Generate. Observe loading card appears in the reserved slot with no layout shift. Dismiss and see the slot return to invisible without the button moving.
- Submit with an empty text field. Confirm validation errors appear in the same slot below the button.
- Tap the `×` remove button on an image thumbnail. Confirm it is a well-sized tap target.
- Confirm the Image Source sub-section has a visible contained boundary distinguishing it from the top-level tab row.
- Confirm trash icons on session rows stay right-aligned even with a long session title.

#### Automated Tests
- `prepare_gallery_tab_does_not_launch_picker_on_press`
- `prepare_take_photo_tab_does_not_launch_picker_on_press`
- `prepare_add_image_button_launches_gallery_picker_when_gallery_selected`
- `prepare_add_image_button_launches_camera_when_camera_selected`
- `prepare_image_strip_renders_placeholder_slots_when_empty`
- `prepare_image_strip_fills_slot_after_image_added`
- `prepare_status_slot_is_always_present_below_generate_button`
- `prepare_validation_errors_render_in_status_slot`
- `prepare_loading_state_renders_in_status_slot`
- `prepare_remove_image_button_has_enlarged_hit_slop`

#### Automated Test Cases (Detailed)
1. `prepare_gallery_tab_does_not_launch_picker_on_press`
   - Press `prepare-pick-gallery`. Assert `launchImageLibraryAsync` was **not** called.
2. `prepare_take_photo_tab_does_not_launch_picker_on_press`
   - Press `prepare-open-camera`. Assert `launchCameraAsync` was **not** called.
3. `prepare_add_image_button_launches_gallery_picker_when_gallery_selected`
   - Ensure Gallery tab is selected. Press `prepare-add-image`. Assert `launchImageLibraryAsync` called once.
4. `prepare_add_image_button_launches_camera_when_camera_selected`
   - Press Camera tab (no side effect), then press `prepare-add-image`. Assert `launchCameraAsync` called once.
5. `prepare_image_strip_renders_placeholder_slots_when_empty`
   - Switch to Image Upload mode with no images added. Assert `MAX_IMAGES` placeholder elements are visible.
6. `prepare_image_strip_fills_slot_after_image_added`
   - Mock gallery returning one asset. Press `prepare-add-image`. Assert one slot shows the thumbnail and remaining slots show placeholder.
7. `prepare_status_slot_is_always_present_below_generate_button`
   - Assert `prepare-status-slot` test ID exists in the tree in both idle and in-flight states.
8. `prepare_validation_errors_render_in_status_slot`
   - Submit with empty input. Assert error text appears inside `prepare-status-slot` and no new element is inserted outside it.
9. `prepare_loading_state_renders_in_status_slot`
   - Trigger generation. Assert loading indicator appears inside `prepare-status-slot`.
10. `prepare_remove_image_button_has_enlarged_hit_slop`
    - Assert `prepare-remove-image-0` has `hitSlop` prop with value `{top: 10, bottom: 10, left: 10, right: 10}` or equivalent.

---

### Phase 8C — Practice Screen Polish

#### Goals
- Replace developer-copy recording feedback with a polished recording timer and mic meter that only appear during active recording.
- Give the recording button a visually distinct active state.
- Reduce noise in the question detail card by collapsing the rarely-used notes input.
- Improve session/question selection hierarchy.
- Replace the plain Show/Hide text toggle on Past Answers with a chevron icon button.
- Demote the attempt score from a large standalone heading to a compact badge.
- Fix the erratic `height: '40%'` on the evaluation panel.

#### Deliverables
- **Recording timer:** Replace `"Recording Seconds: 12"` with a styled monospace counter (`0:12 / 2:00`) inside an accent-coloured progress bar. Rendered only when `isRecording` is true.
- **Mic meter:** Hidden when not recording. Animates in at recording start and out on stop.
- **Recording button active state:** When `isRecording` is true, render the button with warning-red border and background tint (new `styles.recordingActive` style), not just a label change.
- **Notes input collapsed:** Replace the always-visible multiline `AppInput` with a ghost `+ Add notes` button. Pressing it expands the input inline. If `transcriptDraft` has content, show a single-line summary with an edit icon instead of the full expanded input.
- **Session/question hierarchy:** Wrap the question selector and the random picker button in a subsection visually subordinate to the session selector (matching the approach used for Image Source in 8B). Move the shuffle action to a small ghost icon button (`<IconSymbol name="shuffle" />`) next to the question dropdown label, removing the full-width "Pick Random Question" button.
- **Past Answers toggle:** Replace the `Show` / `Hide` `<Text>` pressable with `<IconSymbol name="chevron.right" />` rotated 90° (open) / 0° (closed). Keep the attempt count label next to it.
- **Attempt score badge:** Remove the standalone `<Text style={styles.scoreText}>` that renders at `fontSize: 28`. Display `score/10` as a compact badge in the attempt header row alongside the status pill.
- **Evaluation panel height:** Change `evaluationTabPanel` style from `height: '40%'` to `maxHeight: 220`. The inner `ScrollView` handles overflow; the panel size is now consistent across device sizes.

#### Locked Decisions
- Recording timer and mic meter are rendered conditionally (`isRecording` gate). They do not occupy space when idle.
- Notes input state (`showNotes`) is local UI state; it does not affect any recorded data or test-ID-based test assertions on the result.
- The full-width `AppButton` labelled "Pick Random Question" is removed and replaced by an icon button.
- Attempt score `fontSize: 28` style is removed from Practice entirely.

#### Visible UI Test
- Tap Start Recording. Confirm the mic meter bar and timer appear. Tap Stop. Confirm both disappear.
- While recording, confirm the button has a distinct visual style (red/warning tint) that reverts after stopping.
- Confirm the notes area shows only `+ Add notes` by default. Tap it and confirm the input expands. Type content, stop, and confirm the collapsed summary shows the note preview.
- Confirm the question selector is visually subordinate to the session selector (contained subsection).
- Confirm "Pick Random Question" full-width button is gone; a small shuffle icon appears next to the question label.
- Expand Past Answers. Confirm the collapse control is a chevron that rotates on toggle.
- View an evaluated attempt. Confirm the score renders as a compact badge next to the status pill, not as a large standalone number.
- Confirm the evaluation tab panel scrolls content without clipping at unpredictable heights.

#### Automated Tests
- `practice_recording_timer_hidden_when_idle`
- `practice_recording_timer_visible_when_recording`
- `practice_mic_meter_hidden_when_idle`
- `practice_recording_button_has_active_style_while_recording`
- `practice_notes_input_collapsed_by_default`
- `practice_notes_input_expands_on_add_notes_press`
- `practice_notes_collapsed_summary_shown_when_content_exists`
- `practice_random_question_picker_is_icon_button_not_full_width`
- `practice_past_answers_toggle_uses_chevron_icon`
- `practice_attempt_score_renders_as_badge_in_header`
- `practice_attempt_score_large_text_is_absent`
- `practice_evaluation_panel_uses_max_height_not_percentage`

#### Automated Test Cases (Detailed)
1. `practice_recording_timer_hidden_when_idle`
   - Assert `practice-recording-timer` test ID is absent from the tree when `isRecording` is false.
2. `practice_recording_timer_visible_when_recording`
   - Mock recording start. Assert `practice-recording-timer` appears and displays elapsed time.
3. `practice_mic_meter_hidden_when_idle`
   - Assert `practice-mic-meter` test ID is absent from the tree before recording starts.
4. `practice_recording_button_has_active_style_while_recording`
   - Mock recording start. Assert the recording toggle button has `practice-recording-button-active` test ID (or equivalent style marker indicating the active/warning state).
5. `practice_notes_input_collapsed_by_default`
   - Render Practice with a question selected. Assert the multiline `AppInput` for notes is not visible. Assert `practice-add-notes-button` is visible.
6. `practice_notes_input_expands_on_add_notes_press`
   - Press `practice-add-notes-button`. Assert the notes `AppInput` appears.
7. `practice_notes_collapsed_summary_shown_when_content_exists`
   - Press add-notes, type content, collapse. Assert `practice-notes-summary` test ID shows a truncated preview of the typed content.
8. `practice_random_question_picker_is_icon_button_not_full_width`
   - Assert no element with the text "Pick Random Question" exists as a full-width `AppButton`. Assert `practice-random-question-icon-button` test ID exists.
9. `practice_past_answers_toggle_uses_chevron_icon`
   - Assert `practice-past-answers-toggle` contains `<IconSymbol>` rather than a raw `<Text>` node with "Show"/"Hide".
10. `practice_attempt_score_renders_as_badge_in_header`
    - Seed a completed attempt. Assert `practice-attempt-score-badge-{timestamp}` test ID exists in the attempt header row.
11. `practice_attempt_score_large_text_is_absent`
    - Assert no element with `fontSize: 28` score text exists in the attempt list.
12. `practice_evaluation_panel_uses_max_height_not_percentage`
    - Assert evaluation tab panel style has `maxHeight` set to a numeric value (not a string like `'40%'`).

---

### Phase 8D — Insights + Profile Polish

#### Goals
- Give the Insights empty state a clear headline, guidance copy, and a navigable CTA.
- Improve metric card typography and labelling.
- Add icon-prefixed visual sentiment to the Focus Area card.
- Remove the redundant "App State" card from Profile.
- Add visual separation to the Danger Zone card.
- Collapse the Prompt Preview card.
- Fix model variant chip overflow on small screens.

#### Deliverables
**Insights:**
- **Empty state redesign:** Replace the plain text empty state with:
  - Headline: `"No insights yet"` in `headingFamily`.
  - Guidance: `"Submit and evaluate at least one practice attempt to see trends here."` in `bodyText`.
  - A ghost `AppButton` labelled `"Go to Practice"` that navigates to the Practice tab via `useRouter()` / tab link.
  - Remove the raw `Sessions tracked: N` / `Attempts tracked: N` meta lines from the empty state card.
- **Metric typography:** Change `metric` style from `monoFamily` to `headingFamily` at `fontSize: 40` to match the design system pattern for prominent numbers.
- **Readiness label:** Add a `metaText` label `"READINESS SCORE"` above the readiness number in the Readiness card.
- **Focus Area icons:** Add `'exclamationmark.circle': 'error-outline'` to the icon mapping. Prefix strongest-category line with `<IconSymbol name="checkmark.circle.fill" color={AppTheme.colors.success} />` and top-gap line with `<IconSymbol name="exclamationmark.circle" color={AppTheme.colors.warning} />`.

**Profile:**
- **Remove "App State" card:** Delete the `AppCard title="App State"` block. Move `"Current key status: Configured / Not Configured"` as a `metaText` line inside the existing "API Settings" card, below the button row.
- **Danger Zone styling:** Add `borderLeftWidth: 3` and `borderLeftColor: AppTheme.colors.warning` to the Danger Zone `AppCard`. Override the card `backgroundColor` with a very faint warm tint (`'rgba(245,158,11,0.05)'`). Add a `dangerCard` override style rather than modifying `AppCard` itself.
- **Prompt Preview collapse:** Add local `showPromptPreview` state (default `false`). Render a ghost `AppButton` labelled `"Show Prompt Preview"` / `"Hide Prompt Preview"` before the prompt text. Render the text only when `showPromptPreview` is true.
- **Model variant radio list:** Replace the `flexWrap: 'wrap'` chip row for model variants with a vertical list of full-width pressable rows. Each row shows the variant name on the left and a selection dot (filled circle or `checkmark`) on the right. Evaluation Strictness chips remain as-is (short strings that fit well).

#### Locked Decisions
- The "App State" `AppCard` is removed entirely; its content is not replaced by another card.
- Prompt Preview is collapsed by default. The text is not truncated — it is either fully hidden or fully shown.
- `AppCard` component itself is not modified for the Danger Zone; the tinted styling is applied via a wrapping `View` style override at the call site in `profile.tsx`.

#### Visible UI Test
- Open Insights with no evaluated attempts. Confirm "No insights yet" headline, guidance copy, and "Go to Practice" button are visible. Tap "Go to Practice" and confirm navigation to the Practice tab.
- Open Insights with evaluated data. Confirm metric numbers use heading font at larger size. Confirm "READINESS SCORE" label above the readiness number. Confirm checkmark (green) and warning (amber) icons prefix the Focus Area lines.
- Open Profile. Confirm "App State" card is gone. Confirm key status appears as a single meta line inside the API Settings card.
- Scroll to the Danger Zone card. Confirm it has a distinct left warning border distinguishing it from other cards.
- Confirm "Prompt Preview" section is collapsed by default. Tap "Show Prompt Preview" and confirm text appears. Tap again and confirm it hides.
- Confirm model variant options render as a vertical list, each on its own full-width row, with a clear selection indicator.

#### Automated Tests
- `insights_empty_state_shows_headline_and_cta`
- `insights_empty_state_cta_navigates_to_practice`
- `insights_readiness_metric_shows_readiness_label`
- `insights_focus_area_has_icon_for_strongest_category`
- `insights_focus_area_has_icon_for_top_gap`
- `profile_app_state_card_is_removed`
- `profile_key_status_renders_inside_api_settings_card`
- `profile_danger_zone_has_warning_left_border`
- `profile_prompt_preview_collapsed_by_default`
- `profile_prompt_preview_expands_on_show_press`
- `profile_model_variant_renders_as_radio_list`

#### Automated Test Cases (Detailed)
1. `insights_empty_state_shows_headline_and_cta`
   - Render Insights with no sessions. Assert `"No insights yet"` heading and `"Go to Practice"` button are visible.
2. `insights_empty_state_cta_navigates_to_practice`
   - Press `"Go to Practice"`. Assert router navigation was called with the Practice tab href.
3. `insights_readiness_metric_shows_readiness_label`
   - Render Insights with evaluated data. Assert `"READINESS SCORE"` label exists in the Readiness card.
4. `insights_focus_area_has_icon_for_strongest_category`
   - Render Focus Area with a strongest category value. Assert `checkmark.circle.fill` icon is rendered in that row.
5. `insights_focus_area_has_icon_for_top_gap`
   - Render Focus Area with a top-gap value. Assert `exclamationmark.circle` icon is rendered in that row.
6. `profile_app_state_card_is_removed`
   - Render Profile. Assert no element with text `"App State"` exists as a card title.
7. `profile_key_status_renders_inside_api_settings_card`
   - Render Profile with a configured API key. Assert `"Current key status: Configured"` meta text appears and is inside (a descendant of) the API Settings card region.
8. `profile_danger_zone_has_warning_left_border`
   - Assert the Danger Zone card container has `borderLeftColor` matching `AppTheme.colors.warning`.
9. `profile_prompt_preview_collapsed_by_default`
   - Render Profile. Assert the prompt preview text is not visible. Assert `"Show Prompt Preview"` button is visible.
10. `profile_prompt_preview_expands_on_show_press`
    - Press `"Show Prompt Preview"`. Assert the resolved prompt text is now visible.
11. `profile_model_variant_renders_as_radio_list`
    - Render Profile. Assert each `MODEL_VARIANTS` entry is its own full-width pressable row (test ID `profile-model-variant-row-{variant}`), not a chip inside a `flexWrap` row.

---

### Phase 8E — Navigation & Information Architecture

#### Goals
- Replace the misleading `house.fill` tab icon on Prepare with one that communicates session creation.
- Consolidate the double empty-state on Practice when no sessions exist into a single, actionable card.

#### Deliverables
- **Prepare tab icon:** Change `house.fill` to `square.and.pencil` in the tab navigator. Add `'square.and.pencil': 'edit-note'` to the icon mapping.
- **Practice no-session empty state:** When `sessions.length === 0`, replace the "Session + Question Selection" and "Selected Question Details" cards with a single `AppCard` containing:
  - Headline: `"No sessions yet"`.
  - Guidance: `"Generate a session in Prepare to start practising."`.
  - Ghost `AppButton` labelled `"Go to Prepare"` that navigates to the Prepare tab.
  - The "Past Answers" card is still rendered (or also replaced by the same single card) — one empty state, not two.

#### Locked Decisions
- All other tab icons (`mic.fill`, `chart.bar.fill`, `person.fill`) are unchanged.
- When sessions exist but none is selected, existing behaviour is preserved. The single empty state only fires when `sessions.length === 0`.

#### Visible UI Test
- Open the app after clearing all data. Confirm the Prepare tab now shows the pencil/edit icon in the tab bar.
- Open Practice with no sessions. Confirm a single card with "No sessions yet" headline and "Go to Prepare" button is shown, and no selection dropdowns or empty question details card are rendered.
- Tap "Go to Prepare" from the Practice empty state and confirm navigation to the Prepare tab.

#### Automated Tests
- `navigation_prepare_tab_uses_pencil_icon`
- `practice_no_sessions_shows_single_empty_state`
- `practice_no_sessions_empty_state_hides_selection_cards`
- `practice_no_sessions_cta_navigates_to_prepare`

#### Automated Test Cases (Detailed)
1. `navigation_prepare_tab_uses_pencil_icon`
   - Render the tab layout. Assert the Prepare tab icon is `square.and.pencil`, not `house.fill`.
2. `practice_no_sessions_shows_single_empty_state`
   - Render Practice with an empty session list. Assert `"No sessions yet"` text and `"Go to Prepare"` button are visible.
3. `practice_no_sessions_empty_state_hides_selection_cards`
   - Render Practice with an empty session list. Assert `practice-session-dropdown-trigger` and `practice-question-dropdown-trigger` do not exist in the tree.
4. `practice_no_sessions_cta_navigates_to_prepare`
   - Press `"Go to Prepare"`. Assert router navigation was called with the Prepare tab href.

---

### Phase 8 — Shared Constraints
- All changes must be backward-compatible with existing test IDs. New test IDs may be added; no existing test IDs may be removed unless explicitly listed in the relevant sub-phase's locked decisions.
- No new runtime dependencies. All new components use the existing React Native primitives and `AppTheme` tokens.
- The toast system must not break the inline `expect(screen.getByText('...'))` test assertions in existing tests. During migration, screens keep their inline text for test-facing assertions and route them through the toast hook; existing assertions remain valid via the toast text being in the rendered tree.
- Each sub-phase ends with a full `jest --runInBand` pass before the next sub-phase begins.

---

## Exit Criteria
- Phase 5, 6, 7, and 8 deliverables completed.
- All automated tests pass.
- Manual UI verification completed for each phase.
- Constraints enforced:
  - Text/image mode exclusivity.
  - Max 5 images, each <= 6MB.
  - Max 30 questions per selected batch.
  - Multiple answer attempts per question.
  - Evaluation only after submit.
  - Offline recordings playable.
  - Pending evaluations auto-run on reconnect.
  - Practice random question picker has no repeats per session cycle.
  - Evaluator prompt is dynamic with strictness-based fragments and embedded schema JSON.
  - Google GenAI SDK is the active provider for text + multimodal model calls.
  - Image-based question generation and audio-based evaluation both run through multimodal GenAI paths.
  - Profile clear-all fully resets local app state.
