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

## Exit Criteria
- Phase 5, 6, and 7 deliverables completed.
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
