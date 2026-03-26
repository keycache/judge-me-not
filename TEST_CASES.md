# Test Cases

## Automated Test Cases (Implemented)

Source: `lib/__tests__/interview-rules.test.ts`

1. Input Mode Exclusivity
- `text` mode accepts text-only payload.
- `text` mode rejects mixed text+image payload.
- `image` mode accepts image-only payload.
- `image` mode rejects mixed text+image payload.

2. Image Upload Constraints
- Rejects more than 5 images.
- Rejects image files larger than 6MB.
- Accepts valid image list within limits.

3. Batch Size Constraints
- Accepts values in range 1..30.
- Rejects value > 30.

4. Score Normalization
- Converts 0..10 score to 0..100.
- Clamps out-of-range values.

5. Human-friendly Session Naming
- Generates slug + timestamp format.
- Falls back to default base name when generated title is empty.

## Manual UI Test Cases By Phase

### Phase 1 - Foundation
1. Fresh install with no API key opens API setup screen.
2. Save API key transitions to main tabs.
3. Settings screen includes API key update action.

### Phase 2 - Models + Storage
1. Create sample session and verify it appears in session list.
2. Force app restart and confirm session is retained.
3. Open session and confirm id is readable + unique.

### Phase 3 - Prepare
1. Toggle to Text mode and verify image picker is disabled/hidden.
2. Toggle to Image mode and verify text box is disabled/hidden.
3. Try 6 images and verify visible validation error.
4. Try one 7MB image and verify visible validation error.
5. Set questions-per-batch to 31 and verify submit blocked.

### Phase 4 - Prompt Templating
1. Change strictness/model/persona and confirm prompt preview updates instantly.
2. Start generation and verify saved session includes prompt config snapshot.

### Phase 5 - Practice
1. Record and submit two attempts for same question.
2. Verify both attempts are listed with timestamps.
3. Disable network, submit attempt, verify pending status shown.
4. Re-enable network and verify auto-evaluation executes.
5. Play saved recording in airplane mode.

### Phase 6 - Insights
1. With no evaluations, verify empty state is visible.
2. After evaluations, verify readiness and tier cards show non-zero values.
3. Switch to another session and verify charts update.

### Phase 7 - End-to-End
1. Walk full flow from setup to insights with app restart between steps.
2. Verify no crashes on network interruptions during generation/evaluation.
3. Verify all validation constraints trigger expected UI errors.
