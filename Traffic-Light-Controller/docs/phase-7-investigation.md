# Phase 7 — Comprehensive Simulation Reliability & Defect Investigation

## 1. Executive Summary

A comprehensive investigation of the Intelligent Traffic Management System (ITMS) simulation codebase was conducted to diagnose reported defects across vehicle simulation throughput, intersection conflict resolution, adaptive Explainable AI (XAI) demand telemetry, emergency vehicle priority preemption, fail-safe All-Red recovery, and visual simulation fidelity.

Every problem reported from visual demonstration recordings was analyzed down to the exact algorithmic, kinematic, and DOM orchestration mechanisms. No defects were assumed without concrete code-level and experimental proof.

---

## 2. Defect Investigation & Root Cause Analysis

### Problem A — Vehicle Congestion, Zero Throughput & Stop-Line Sticking

#### Defect ID: `DEF-P7-01`
- **Observed Symptom**: Vehicles accumulate in queues, stick at stop lines despite green signals, and experience artificial congestion and zero throughput.
- **Reproduction Procedure**:
  1. Populate a queue with 2 or more vehicles on any approach behind a red light.
  2. Switch the light to GREEN, allowing vehicle 1 to cross the stop line (`pos = 140px`) and vehicle 2 to follow.
  3. When the signal switches to YELLOW, observe the behavior of vehicle 2 if it is near or past the stop line.
- **Root Cause**:
  In [`vehicles.js`](file:///c:/Users/Abishek/OneDrive/Desktop/dpco-oss/Traffic-Light-Controller/vehicles.js) lines 463–469:
  ```javascript
  const nextPos = vehicle.pos + vehicle.speed * dt;
  if (allowedStopPos !== CONSTANTS.DESPAWN_POS && nextPos >= allowedStopPos) {
    vehicle.pos = allowedStopPos;
    vehicle.speed = 0;
  }
  ```
  And lines 438–440:
  ```javascript
  if (!vehicle.hasClearedStopLine && (signalColor === 'RED' || signalColor === 'YELLOW')) {
    allowedStopPos = Math.min(allowedStopPos, CONSTANTS.STOP_LINE_POS);
  }
  ```
  Because line 471 only checked `allowedStopPos === CONSTANTS.DESPAWN_POS` (which is never true for following vehicles, whose `allowedStopPos` is bounded by `leader.pos - SAFE_FOLLOW_DIST`), following vehicles never received `hasClearedStopLine = true`. When the light turned yellow while a following vehicle was past the stop line (`pos = 140px`), `allowedStopPos` was clamped to `STOP_LINE_POS` ($138\text{px}$). Because `nextPos >= 138` was true, the vehicle was **forcibly teleported backwards to $138\text{px}$** and had its speed set to $0$, snapping on top of trailing vehicles and becoming permanently stuck at the stop line across multiple cycles.
- **Affected Files & Functions**:
  - `Traffic-Light-Controller/vehicles.js` — `VehicleManager.prototype.update()`
- **Severity**: **CRITICAL**
- **Proposed Correction**:
  1. Once any vehicle's center crosses the stop line (`pos >= CONSTANTS.STOP_LINE_POS`), permanently set `hasClearedStopLine = true`.
  2. In the boundary clamping logic, never clamp backwards: clamping should only apply if `vehicle.pos <= allowedStopPos` and `nextPos >= allowedStopPos`. If `vehicle.pos > allowedStopPos`, the vehicle has already committed past that position and must be allowed to clear.
- **Regression Test Required**: `test_following_car_stop_line_commitment()` and `test_zero_backward_teleportation()`.

---

### Problem B — Intersection Deadlock & Insufficient Conflict-Zone Clearance

#### Defect ID: `DEF-P7-02`
- **Observed Symptom**: Multiple vehicles from conflicting corridors enter the junction simultaneously, overlap, or clip each other's rear bumpers.
- **Reproduction Procedure**:
  1. Spawn a vehicle (especially a Transit Bus or Fire Engine, length $36\text{px}$) from East entering the junction.
  2. While the East vehicle is at `pos = 290px` (center just reaching `JUNCTION_EXIT`), transition North to GREEN.
  3. Observe North vehicle immediately entering the intersection while the rear of the East vehicle is still spanning the North travel lane at $x = 185\text{px}, y = 255\text{px}$.
- **Root Cause**:
  In [`vehicles.js`](file:///c:/Users/Abishek/OneDrive/Desktop/dpco-oss/Traffic-Light-Controller/vehicles.js) lines 356–372:
  ```javascript
  isConflictingAxisInIntersection(direction) {
    ...
    if (v.pos >= CONSTANTS.JUNCTION_ENTRY && v.pos <= CONSTANTS.JUNCTION_EXIT) {
      return true;
    }
  }
  ```
  1. `JUNCTION_ENTRY` is defined as `146px` while `STOP_LINE_POS` is `138px`. Any vehicle between $138\text{px}$ and $146\text{px}$ has crossed the stop line and committed to the junction, but is not detected as in the intersection, creating an 8px dead zone where conflicting green vehicles charge in.
  2. `JUNCTION_EXIT` is hardcoded as `294px`. For a $36\text{px}$ vehicle (Bus / Fire Engine), when its center is at `pos = 294px`, its rear bumper is at $294 - 18 = 276\text{px}$ (inside the junction box, which extends to $290\text{px}$). The conflicting direction sees `isConflictingAxisInIntersection == false` and releases traffic into the tail of the exiting vehicle.
  3. Following vehicles (`i > 0`) in `vehicles.js` line 433 did not verify `isConflictingAxisInIntersection`, assuming the leader alone governed clearance.
- **Affected Files & Functions**:
  - `Traffic-Light-Controller/vehicles.js` — `isConflictingAxisInIntersection()`, `update()`
- **Severity**: **CRITICAL**
- **Proposed Correction**:
  1. Define intersection occupancy dynamically using vehicle extents: a vehicle occupies the conflict zone from the moment its front bumper crosses the stop line (`pos + length / 2 >= STOP_LINE_POS`) until its rear bumper clears the junction box (`pos - length / 2 >= 290px`).
  2. Ensure any vehicle (lead or following) about to cross the stop line verifies that the orthogonal corridor is clear before entering.
- **Regression Test Required**: `test_long_vehicle_clearance_mutex()` and `test_zero_deadzone_occupancy()`.

---

### Problem C — Adaptive Demand & XAI Inconsistency

#### Defect ID: `DEF-P7-03`
- **Observed Symptom**: The Demand Meter displays `0.0` while the XAI explanation card reports high nonzero demand (e.g. `Demand (8.0)`), appearing contradictory and un-synchronized.
- **Reproduction Procedure**:
  1. Run simulation in ADAPTIVE mode.
  2. Allow an active green phase to disperse vehicles from North-South.
  3. Inspect the UI mid-phase: the Demand Meter displays `NS Demand: 0.0` because queues are now empty, while the Decision Logic below still displays `"North-South traffic demand (8.0) exceeds East-West (1.0). Green extended to 25s..."`.
  4. Switch to FIXED or MANUAL mode: the rationale text never updates, displaying stale adaptive text indefinitely.
- **Root Cause**:
  In [`app.js`](file:///c:/Users/Abishek/OneDrive/Desktop/dpco-oss/Traffic-Light-Controller/app.js) lines 296–312:
  `elements.valDemandNS` and `elements.valDemandEW` were updated at 60fps using instantaneous queue counts (`analyzeTrafficDemand(data.queueLengths)`), while `elements.adaptiveRationaleText` was only updated once at phase transition (lines 634–644). Furthermore, line 634 had `if (adaptiveController.getMode() === 'ADAPTIVE')`, preventing rationale updates in FIXED and MANUAL modes.
- **Affected Files & Functions**:
  - `Traffic-Light-Controller/app.js` — `updateAnalyticsUI()`, `tick()`, mode switch listeners
  - `Traffic-Light-Controller/adaptive.js` — `evaluatePhaseDuration()`
- **Severity**: **HIGH**
- **Proposed Correction**:
  1. Synchronize the Adaptive card to display both:
     - The **Demand at Phase Allocation** (the exact values evaluated to set the current green duration).
     - The **Live Approach Backlog** (real-time queue accumulation).
  2. Ensure the XAI explanation text explicitly clarifies the decision context: `"Allocated green based on initial corridor demand: NS 8.0 vs EW 1.0..."`.
  3. In FIXED and MANUAL modes, ensure the rationale box updates immediately to explain the active operational plan.
- **Regression Test Required**: `test_adaptive_snapshot_synchronization()` and `test_mode_switch_rationale_update()`.

---

### Problem D — Emergency Priority Synchronization & Premature Phase Interruption

#### Defect ID: `DEF-P7-04`
- **Observed Symptom**: Emergency priority banner remains displayed on screen while the traffic light changes to conflicting directions, leaving emergency vehicles stranded.
- **Reproduction Procedure**:
  1. Dispatch an Ambulance from North while East-West is GREEN.
  2. Observe the banner display `"Securing Clearance..."`.
  3. After yellow clearance, North turns GREEN. The banner never updates its text to reflect active green.
  4. If the normal green countdown reaches 0 before the ambulance crosses the junction, `fsm.step()` transitions the light to YELLOW and RED against the approaching ambulance.
  5. The ambulance halts at the red light, never reaching $294\text{px}$, causing the banner to remain on screen forever while signals cycle normally.
- **Root Cause**:
  1. In `app.js` line 649, `tick()` called `fsm.step()` unconditionally when `remainingSeconds <= 0`, without checking if `fsm.getEmergencyPriority()` was actively holding priority green.
  2. In `app.js` line 164, the banner was only shown on request and hidden on clear, but never updated when the phase changed from clearance to active green.
  3. `resetSimulation()` failed to hide the emergency banner, leaving it visible after reset.
  4. `fsm.emergencyPriority` only held a single reference, meaning a second emergency dispatch erased the first.
- **Affected Files & Functions**:
  - `Traffic-Light-Controller/fsm.js` — `requestEmergencyPriority()`, `step()`, emergency queue
  - `Traffic-Light-Controller/app.js` — `tick()`, `handleEmergencyRequest()`, `updateUI()`, `resetSimulation()`
- **Severity**: **CRITICAL**
- **Proposed Correction**:
  1. In `fsm.js` and `app.js`, hold priority green open (`remainingSeconds` clamped or extended) until all approaching emergency vehicles have crossed the junction exit.
  2. In `updateUI()`, dynamically update the emergency banner to reflect current phase (`"Securing Yellow Clearance..."` vs `"Priority Green Active (Holding for Transit)"`).
  3. Hide the banner immediately upon full emergency clearance or system reset.
  4. Support multi-vehicle emergency queuing.
- **Regression Test Required**: `test_emergency_green_hold_until_cleared()` and `test_emergency_banner_lifecycle_sync()`.

---

### Problem E — Fail-Safe All-Red Halt Timer Deadlock

#### Defect ID: `DEF-P7-05`
- **Observed Symptom**: Activating All-Red Halt and then clicking "Resume Normal" permanently freezes the simulation countdown clock; signals never change again, causing permanent vehicle accumulation.
- **Reproduction Procedure**:
  1. Click **Start** to run the simulation (`simStatus = RUNNING`).
  2. Click **All-Red Halt** (`fsm.triggerAllRedHalt()`).
  3. Click **Resume Normal** (`toggleAllRedHalt()`).
  4. Observe the countdown timer: it remains frozen, `setInterval` was never re-created, and signals never transition.
- **Root Cause**:
  In [`app.js`](file:///c:/Users/Abishek/OneDrive/Desktop/dpco-oss/Traffic-Light-Controller/app.js) lines 720–736:
  ```javascript
  function toggleAllRedHalt() {
    if (fsm.isAllRedHalt()) {
      fsm.resumeFromAllRed();
      if (simStatus === SIM_STATUS.RUNNING) {
        startSimulation();
      }
    } else {
      fsm.triggerAllRedHalt();
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    }
  }
  ```
  `toggleAllRedHalt()` cleared `timerInterval` but did not change `simStatus` from `RUNNING`. When resuming, it called `startSimulation()`. In line 662:
  ```javascript
  function startSimulation() {
    if (simStatus === SIM_STATUS.RUNNING || fsm.isAllRedHalt()) return;
  ```
  Because `simStatus` was still `RUNNING`, `startSimulation()` returned immediately without re-creating `timerInterval`! The timer died permanently.
- **Affected Files & Functions**:
  - `Traffic-Light-Controller/app.js` — `toggleAllRedHalt()`, `startSimulation()`
- **Severity**: **CRITICAL**
- **Proposed Correction**:
  In `startSimulation()`, check whether `timerInterval` is null: if `timerInterval === null && !fsm.isAllRedHalt()`, create the interval regardless of previous `simStatus`. In `toggleAllRedHalt()`, cleanly manage halt state flags.
- **Regression Test Required**: `test_all_red_halt_resumes_timer()`.

---

### Problem F — Vehicle Overlap Caused by Hardcoded Spacing & CSS Transitions

#### Defect ID: `DEF-P7-06`
- **Observed Symptom**: Transit Buses and Fire Engines visually overlap following vehicles, and vehicles appear to jitter or lag at higher speed multipliers (2x, 5x).
- **Reproduction Procedure**:
  1. Spawn a Transit Bus ($36\text{px}$) followed by a Compact Car ($26\text{px}$).
  2. Inspect bumper-to-bumper clearance: `SAFE_FOLLOW_DIST` was hardcoded to $38\text{px}$, which is only adequate for two cars ($13 + 13 + 12 = 38\text{px}$). For a bus and car, center-to-center distance must be $18 + 13 + 12 = 43\text{px}$. The vehicles overlap by $5\text{px}$.
  3. Increase speed multiplier to 5x: `.sim-vehicle` had `transition: transform 0.05s linear;` in `style.css`, causing 60fps script updates to fight CSS transition interpolation.
- **Root Cause**:
  - `SAFE_FOLLOW_DIST` was a scalar constant ($38\text{px}$) instead of a dynamic function of leader and follower lengths.
  - CSS transition on continuous 60fps rAF coordinates caused visual lag and perceived clipping.
  - Off-screen spawns at `pos = -40` did not account for larger vehicle lengths ($36\text{px}$ bus vs $26\text{px}$ car).
- **Affected Files & Functions**:
  - `Traffic-Light-Controller/vehicles.js` — `update()`, `spawnVehicle()`
  - `Traffic-Light-Controller/style.css` — `.sim-vehicle`
- **Severity**: **HIGH**
- **Proposed Correction**:
  1. Dynamic following distance: `const safeDist = (leader.length + vehicle.length) / 2 + CONSTANTS.MIN_GAP`.
  2. Remove CSS `transition: transform` from `.sim-vehicle` for crisp 60fps rAF motion.
  3. Adjust spawn clearance to use dynamic vehicle dimensions.
- **Regression Test Required**: `test_multi_class_following_distance()` and `test_zero_overlap_all_classes()`.

---

## 3. Summary of Identified Defects & Action Plan

| Defect ID | Issue Category | Severity | Root Cause Identified | Correction Strategy |
|---|---|---|---|---|
| `DEF-P7-01` | Simulation / Kinematics | **CRITICAL** | Clamping following vehicles backwards to stop line on yellow | Permanent commitment past stop line; clamp only forward |
| `DEF-P7-02` | Logic / Safety | **CRITICAL** | 8px entry dead zone & premature conflict-box exit check | Dynamic bounding box from front bumper to rear bumper |
| `DEF-P7-03` | Telemetry / UI | **HIGH** | Instantaneous 60fps meter vs phase-transition XAI text | Synchronized dual-telemetry (evaluated vs live) & explicit context |
| `DEF-P7-04` | Logic / Safety | **CRITICAL** | Unconditional FSM step during active emergency priority | Hold priority green until vehicle clears; dynamic banner updates |
| `DEF-P7-05` | Logic / Timer | **CRITICAL** | `startSimulation()` blocked by stale `simStatus === RUNNING` | Re-create timer interval if null; robust halt state management |
| `DEF-P7-06` | Kinematics / CSS | **HIGH** | Hardcoded 38px spacing for 36px buses & CSS transition lag | Dynamic length-based spacing; remove transition on 60fps rAF |
