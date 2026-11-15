# Phase 8 — Visual UI Audit & UX Refinement Inspection

**Project**: Intelligent Traffic Management System (ITMS) — Traffic Light Controller  
**Author**: Senior UI/UX Engineer, Frontend Architect & Simulation Specialist  
**Date**: November 2026  
**Status**: AUDIT COMPLETE — Remediations Identified  
**Target Repository**: `https://github.com/abishekaruchamy-oss/dpco-oss`  
**Associated Baseline Commit**: `48ca748`

---

## 1. Executive Summary & Audit Scope

This document provides a comprehensive visual and functional inspection of the Intelligent Traffic Management System (ITMS) running across multiple display viewports (Desktop 1920×1080 and 1920×2400, Tablet 768×1024, Mobile 390×844). While Phases 1–7 resolved microscopic vehicle kinematics and clearance invariants, visual inspection of the running interface identified critical UI/UX inconsistencies, layout imbalances, and telemetry synchronization defects.

Seven primary defect classes (DEF-UI-01 through DEF-UI-07) were discovered, verified, and mapped to root causes in `app.js`, `adaptive.js`, `index.html`, and `style.css`.

---

## 2. Detailed Visual & Functional Findings

### Defect UI-01: Adaptive Demand Dashboard Inconsistency (Issue 1)
- **UI Component**: Adaptive Timing Engine Card (`.adaptive-card`)
- **Observed Problem**: The demand meter displays `NS Demand: 9.0` and `EW Demand: 6.0` with corresponding progress bar widths, while the natural language decision logic box directly beneath displays `North-South traffic demand (6.0) exceeds East-West (0.0). Green extended to 22s...`. The numerical values and explanation directly contradict each other.
- **Reproduction Steps**:
  1. Load application and click **Start**.
  2. Allow simulation to run into high density so queues accumulate during S0 ($10\text{--}25\text{s}$).
  3. Observe that numerical labels and progress bar update every second, but explanation text remains frozen from the transition instant.
- **Root Cause**: `updateAnalyticsUI(data)` in `app.js` calls `adaptiveController.analyzeTrafficDemand(data.queueLengths)` every 1 second and updates `valDemandNS` and `valDemandEW`. However, `elements.adaptiveRationaleText` was only updated once at phase transition in `tick()`. As queues fluctuated during the phase, the live demand meter diverged from the frozen rationale string.
- **Affected Files**: `Traffic-Light-Controller/app.js`, `Traffic-Light-Controller/adaptive.js`
- **Proposed Correction**: Unify demand evaluation into a single authoritative snapshot function (`updateAdaptiveDemandUI`). Both numerical meters, progress bars, calculated durations, and the XAI natural language rationale must be derived simultaneously from the same snapshot every update cycle. Mode switching must instantly refresh the rationale.
- **Verification Method**: Automated regression assertion asserting mathematical and string identity between active demand variables and rationale text; visual inspection during queue growth.

---

### Defect UI-02: Emergency Priority Banner & Countdown Synchronization (Issue 2)
- **UI Component**: Emergency Preemption Alert Banner (`#emergencyBanner`), Signal Countdown Heads (`.signal-countdown`), and Active State Countdown (`#countdownSeconds`).
- **Observed Problem**: When an emergency vehicle is dispatched on North, the banner displays `AMBULANCE from NORTH — Priority Green Active (Holding for Transit)`. Simultaneously, the signal panel displays `S0: NS GREEN / EW RED` and a static, unmoving `11-second` countdown. The timer stops decrementing, giving the appearance of a frozen or broken simulation.
- **Reproduction Steps**:
  1. Click **Start** to run the simulation.
  2. While in S0 (NS Green), click **Ambulance** (From North).
  3. Observe the countdown timer freezing at whatever integer was active (e.g. 11s) with no indication of why the countdown stopped.
- **Root Cause**: In `tick()` (`app.js`), when `fsm.isHoldingPriorityGreen()` evaluates to true, the code executed:
  ```javascript
  if (fsm.isHoldingPriorityGreen && fsm.isHoldingPriorityGreen()) {
    if (remainingSeconds < 5) remainingSeconds = 5;
    updateUI();
    return;
  }
  ```
  Calling `return;` bypassed both `remainingSeconds--` and `elapsedSeconds++`. The UI showed a static frozen countdown without indicating that the phase was being held intentionally for emergency transit.
- **Affected Files**: `Traffic-Light-Controller/app.js`, `Traffic-Light-Controller/style.css`
- **Proposed Correction**:
  1. When holding priority green, signal countdown heads should display `HOLD` with a priority pulse animation, and the state countdown should display `PRIORITY HOLD (Active Transit)`.
  2. `elapsedSeconds` must continue incrementing so live phase duration advances.
  3. The banner text must reflect real-time vehicle progress (`Approaching Stop Line` $\to$ `Traversing Intersection` $\to$ instant release upon clearing `JUNCTION_EXIT`).
- **Verification Method**: Dispatch emergency vehicle and observe signal lamp countdown displaying `HOLD`, state timer displaying `PRIORITY HOLD`, and clean banner removal upon exit.

---

### Defect UI-03: Vehicle Throughput Startup Lag & Calculation Representation (Issue 3)
- **UI Component**: Traffic Analytics Dashboard — Throughput KPI (`#statThroughput`)
- **Observed Problem**: In initial simulation runs (0–12 seconds), the Throughput KPI displays `0 veh/min` even while multiple vehicles are actively driving through the approaches.
- **Reproduction Steps**:
  1. Click **Start**.
  2. Observe `TOTAL GENERATED` incrementing ($1, 2, 3\dots 15$), but `VEHICLES PASSED` and `THROUGHPUT` remaining at `0`.
- **Root Cause**: Vehicles spawn off-canvas at $pos = -40\text{px}$ and despawn at $pos = 460\text{px}$. At cruising speed ($70\text{ px/s}$), traversal takes approximately $7\text{--}8\text{ seconds}$. During this initial transit period, $totalPassed = 0$, causing the instantaneous formula $\frac{\text{passed}}{\text{time}} \times 60$ to read zero.
- **Affected Files**: `Traffic-Light-Controller/vehicles.js`, `Traffic-Light-Controller/app.js`
- **Proposed Correction**: During initial startup ($totalSimulationTime < 10\text{s}$ and $totalPassed = 0$), display `Calibrating...` or `0 veh/min (Flow Inbound)` so users understand vehicles are in transit rather than experiencing zero throughput due to gridlock. Ensure rolling throughput updates dynamically once the first vehicle exits.
- **Verification Method**: Monitor Throughput KPI during startup; verify non-zero throughput once vehicles clear.

---

### Defect UI-04: Corridor Flow Status Overlays Obstructing Roadway (Issue 4)
- **UI Component**: 4-Way Traffic Junction Canvas (`.intersection`)
- **Observed Problem**: Text labels `#flowNS` (`NS FLOWING (GREEN)`) and `#flowEW` (`EW STOPPED (RED)`) are placed directly in the center of the asphalt roadway inside the intersection box. Moving vehicles drive directly through and under these text elements.
- **Reproduction Steps**:
  1. Open application and observe intersection center.
  2. Start simulation; vehicles cross directly through the text badges.
- **Root Cause**: `.flow-ns` and `.flow-ew` were styled with `top: 195px; left: 195px;` inside the 440×440px intersection container, intersecting the vehicle travel lanes ($x = 185\text{px}$ and $y = 185\text{px}$).
- **Affected Files**: `Traffic-Light-Controller/index.html`, `Traffic-Light-Controller/style.css`, `Traffic-Light-Controller/app.js`
- **Proposed Correction**: Move corridor flow status badges out of the asphalt surface into the Junction Card Header as clean status pills (`[NS: FLOWING]` / `[EW: STOPPED]`). Leave the physical roadway 100% clean for lane markings, vehicles, and signal visibility.
- **Verification Method**: Visual inspection of intersection canvas ensuring unobstructed vehicle paths.

---

### Defect UI-05: Stopped Vehicles Straddling Pedestrian Crosswalks (Issue 4)
- **UI Component**: Crosswalk Zebra Markings (`.crosswalk`) & Stop Lines (`.stop-line-*`)
- **Observed Problem**: Southbound vehicles stopping at the North stop line stop with their center at $pos = 138\text{px}$ and length $26\text{px}$. The pedestrian crosswalk is painted from $y = 132\text{px}$ to $146\text{px}$, placing the stopped vehicle directly on top of the crosswalk stripes.
- **Reproduction Steps**:
  1. Set North signal to RED.
  2. Allow a vehicle to halt at the stop line.
  3. Observe that the vehicle's body is parked on the zebra stripes.
- **Root Cause**: Real-world stop lines are placed *before* pedestrian crossings. In `style.css`, `.stop-line-north` was placed at $top: 150\text{px}$ while the crosswalk was at $top: 132\text{px}$. Because vehicles stop at $pos = 138\text{px}$ (front bumper at $151\text{px}$), they completely overlap the crosswalk.
- **Affected Files**: `Traffic-Light-Controller/style.css`
- **Proposed Correction**: Realign crosswalks to the intersection mouth threshold ($152\text{--}166\text{px}$) connecting sidewalk curb corners. Cars stopping at $pos = 138\text{px}$ (front bumper at $150\text{px}$) stop cleanly *before* the pedestrian crossing.
- **Verification Method**: Visual screenshot check with stopped vehicles halted strictly before crosswalk stripes.

---

### Defect UI-06: Unbalanced Desktop Layout & Massive Blank Void (Issue 5)
- **UI Component**: Dashboard Main Grid (`.dashboard-grid`)
- **Observed Problem**: On desktop (1920×1080), Column 1 contains only the 440×440px junction card (height ~620px). Column 2 contains 7 stacked cards totaling ~2400px. This results in an awkward ~1600px empty void in Column 1 when scrolling.
- **Reproduction Steps**:
  1. Open application at 1920×1080 and scroll down.
  2. Observe the entire left half of the page is completely empty below the junction card.
- **Root Cause**: Monolithic placement of all telemetry, analytics, tables, and logs inside `.dashboard-side`.
- **Affected Files**: `Traffic-Light-Controller/index.html`, `Traffic-Light-Controller/style.css`
- **Proposed Correction**: Rebalance into a balanced two-column layout:
  - **Column 1 (Physical Junction & Corridor Telemetry)**:
    1. 4-Way Traffic Junction Card.
    2. Directional Approach Congestion & Queue Breakdown Card (placed directly under the junction, aligned with N/S/E/W).
    3. Live State Transition Event Log Card.
  - **Column 2 (FSM Control, Intelligence & Analytics)**:
    1. Active Phase State Telemetry Card.
    2. Adaptive Signal Timing Engine & XAI Card.
    3. Safety Invariant Proof Card.
    4. ITS Analytics KPIs & Rolling Queue History Sparkline.
    5. FSM State Matrix Table.
    6. Automated Invariant Proofs Drawer.
- **Verification Method**: Full-height screenshot capture confirming balanced column heights (~1200px each) with zero blank voids.

---

### Defect UI-07: Responsive Layout Clipping on Tablet & Mobile (Section 7)
- **UI Component**: Control Bar (`.control-bar`), Emergency Toolbar, and State Table
- **Observed Problem**: At viewports $< 1024\text{px}$ and on mobile ($390\text{px}$), buttons in the control bar wrap awkwardly, emergency dispatch buttons overflow horizontally, and the state table induces horizontal scrollbars.
- **Reproduction Steps**:
  1. Resize browser to $768\text{px}$ (Tablet Portrait) or $390\text{px}$ (Mobile).
  2. Observe button misalignment and horizontal card overflow.
- **Root Cause**: Flexbox wrap containers lacked responsive flex-basis and gap scaling for mobile touch targets.
- **Affected Files**: `Traffic-Light-Controller/style.css`
- **Proposed Correction**: Add dedicated media queries for $\le 1024\text{px}$, $\le 768\text{px}$, and $\le 480\text{px}$. Scale junction container to `max-width: 100%`, convert control groups into structured full-width button rows, and make tables horizontally scrollable with smooth touch momentum.
- **Verification Method**: Multi-viewport automated screenshot verification at 1920×1080, 1600×900, 1366×768, 1280×720, 1024×768, 768×1024, and 390×844.

---

## 3. Audit Traceability Matrix

| Defect ID | Issue Category | Severity | Root Cause Location | Proposed Remedy |
|---|---|---|---|---|
| **DEF-UI-01** | Adaptive Demand Inconsistency | High | `app.js` (L300 vs L678) | Unified single-snapshot demand update function |
| **DEF-UI-02** | Emergency Banner & Timer Sync | High | `app.js` (L648 `tick()`) | Dynamic `HOLD` display on timers + elapsed time tick |
| **DEF-UI-03** | Throughput Warm-Up Display | Low | `vehicles.js` (L542) | Calibrating state during initial approach |
| **DEF-UI-04** | Roadway Flow Text Obstruction | Medium | `index.html` (L144), `style.css` | Move corridor status badges to panel header |
| **DEF-UI-05** | Stopped Cars on Crosswalks | Medium | `style.css` (L482 Crosswalks) | Align crosswalks to junction mouth threshold ($152\text{--}166\text{px}$) |
| **DEF-UI-06** | Desktop 1600px Blank Void | High | `index.html` (L92 Grid) | Rebalance columns: physical flow vs control analytics |
| **DEF-UI-07** | Tablet/Mobile Wrap Overflow | Medium | `style.css` (Media Queries) | Responsive breakpoint rules for 1024, 768, and 390px |
