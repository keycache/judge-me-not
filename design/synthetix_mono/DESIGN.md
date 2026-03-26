# Design System Document: Technical Precision & Editorial Authority

## 1. Overview & Creative North Star: "The Digital Architect"
This design system is built for the high-stakes environment of AI-driven recruitment. The Creative North Star is **"The Digital Architect"**—a visual language that prioritizes structural integrity, mathematical precision, and high-contrast clarity.

Unlike generic SaaS platforms that rely on soft "pill-shaped" buttons and playful roundness, this system embraces **Organic Brutalism**. We break the "template" look by utilizing extreme 0px–2px corner radiuses and a rigid, high-contrast palette. Depth is achieved not through shadows, but through sophisticated tonal layering and "Glassmorphism" to create a UI that feels like a high-end technical blueprint rather than a mobile app. It is intentional, authoritative, and unapologetically sharp.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a deep `surface` (#13131b) with a high-energy `primary` Indigo (#c0c1ff / #6366F1) to draw the eye toward critical AI insights.

### The "No-Line" Rule
**Standard 1px solid borders are strictly prohibited for sectioning.** To define boundaries, designers must use background color shifts. For example, a `surface-container-low` section should sit directly against a `surface` background. If the user’s eye cannot distinguish a section, do not add a line—increase the tonal contrast between the containers.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the following tiers to define importance:
- **Level 0 (Base):** `surface` (#13131b) — The foundation.
- **Level 1 (Sections):** `surface-container-low` (#1b1b23) — Large layout blocks.
- **Level 2 (Cards):** `surface-container` (#1f1f27) — Primary content containers.
- **Level 3 (Floating/Active):** `surface-container-high` (#292932) — Modals and active states.

### The "Glass & Gradient" Rule
To prevent a "flat" feel, use **Glassmorphism** for floating elements (like interview controls or AI feedback overlays). Apply a semi-transparent `surface-container-highest` with a `backdrop-blur` of 12px–20px. 
**Signature Texture:** Use a subtle linear gradient for primary CTAs, transitioning from `primary` (#c0c1ff) to `primary-container` (#8083ff) at a 135-degree angle. This adds "visual soul" to the rigid geometry.

---

## 3. Typography: Technical Editorial
We utilize a dual-typeface system to balance technical precision with professional authority.

*   **Display & Headlines (Manrope):** Chosen for its geometric, modern construction. Use `display-lg` (3.5rem) for hero interview scores and `headline-md` (1.75rem) for section titles. High tracking (letter-spacing) of -0.02em should be applied to large headers to maintain a "tight," engineered look.
*   **Body & Labels (Inter):** The industry standard for readability. All technical data, interview transcripts, and AI-generated feedback must use `body-md` (0.875rem) or `body-sm` (0.75rem) to ensure clarity during fast-paced reviews.
*   **Case Styling:** Use `label-md` in **ALL CAPS** with +0.05em tracking for category tags and metadata to reinforce the "Architect" vibe.

---

## 4. Elevation & Depth
In a world of sharp corners, depth must be sophisticated, not heavy-handed.

*   **The Layering Principle:** Stacking is the new shadowing. Place a `surface-container-lowest` card on a `surface-container-low` section to create a soft, natural lift.
*   **Ambient Shadows:** If a floating effect is required (e.g., a dropdown), use a shadow with a 32px blur, 0% spread, and 6% opacity using a tinted `on-surface` color. It should feel like a glow, not a dark pit.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline-variant` token at **15% opacity**. Never use 100% opaque borders.
*   **Interaction States:** When hovering over a sharp-edged card, do not lift it. Instead, shift the background color from `surface-container` to `surface-container-high`.

---

## 5. Components
All components adhere to the **0px–2px corner radius** constraint.

*   **Buttons:**
    *   **Primary:** Sharp corners (0px). Gradient fill (Primary to Primary-Container). Text: `label-md` Bold.
    *   **Secondary:** `outline-variant` Ghost Border (20% opacity). No fill.
*   **Input Fields:** Use `surface-container-highest` as the background. No bottom line; instead, use a 2px `primary` left-border accent only when focused to signal "Technical Entry."
*   **Cards & Lists:** **Strictly forbid divider lines.** Use `1.3rem` (Spacing 6) of vertical white space to separate list items. For complex data, use alternating background tints (`surface` vs `surface-container-low`).
*   **AI Insight Chips:** Use `tertiary-container` (#d97721) with `on-tertiary-container` text. These must remain rectangular (0px radius) to differentiate from the "bubble" look of lesser apps.
*   **Interview Timeline:** Use a vertical 1px `outline-variant` line (10% opacity) with sharp square nodes to represent time-stamped AI notes.

---

## 6. Do’s and Don'ts

### Do
- **DO** use asymmetry. Align headers to the far left and data to the far right to create an editorial layout.
- **DO** use `surface-bright` for subtle hover states on dark backgrounds.
- **DO** leverage the 0.4rem (Spacing 2) and 0.9rem (Spacing 4) increments for tight, technical padding.
- **DO** use high-contrast text (`on-surface`) for interview transcripts to ensure maximum readability.

### Don't
- **DON'T** use any radius above 4px. If it looks "soft," it’s wrong.
- **DON'T** use standard drop shadows. Use tonal shifting.
- **DON'T** use 1px dividers to separate content. Use negative space or surface-tier shifts.
- **DON'T** use "Safety Blue" or "Success Green" at 100% saturation. Use the system's `tertiary` and `error` tokens to maintain the high-end dark-mode aesthetic.