# 4-Way Traffic Light Controller (FSM Simulation)

An advanced, software-only, zero-dependency **Intelligent Traffic Management System (ITMS)** implemented with a formal **Finite State Machine (FSM)**, microscopic vehicle kinematics, real-time adaptive signal control, emergency vehicle priority preemption, and pure SVG telemetry.

---

## 1. Project Overview & Architecture

This project simulates a busy four-way intersection (North, South, East, West) controlled by a deterministic Finite State Machine with physical vehicle queuing dynamics, traffic density presets, and real-time Intelligent Transportation Systems (ITS) analytics. The application runs natively in any standard web browser using pure HTML5, CSS3, and vanilla JavaScript without external libraries, packages, or build steps.

### File Structure
All project deliverables are self-contained within `Traffic-Light-Controller/`:

```
Traffic-Light-Controller/
├── index.html        # Main semantic markup, intersection canvas, controls & analytics dashboard
├── style.css         # Styling, realistic glowing signal lamps, vehicles, and KPI grid
├── fsm.js            # Pure Finite State Machine core, states, transitions & invariant logic
├── vehicles.js       # Vehicle physics, queue discipline, traffic density & kinematics engine
├── adaptive.js       # Adaptive signal timing engine, demand modeling & XAI rationale
├── analytics.js      # Advanced ITS analytics engine, pure SVG sparklines & heatmap
├── logic.js          # Phase 10: DPCO Digital logic engine, 7-gate library & controller circuits
├── app.js            # Application controller: DOM bindings, countdown loop & 60fps render
├── verify.js         # Automated verification suite (96 formal assertions, CLI and in-browser)
├── README.md         # Architecture, FSM documentation, and verification proofs
└── docs/             # Comprehensive documentation suite
    ├── project-overview.md        # Architectural overview, dataflow & design principles
    ├── fsm-design.md              # Mathematical state definitions, transitions & invariant proofs
    ├── adaptive-control.md        # Adaptive demand formulas, scaling algorithms & XAI
    ├── testing-report.md          # 50/50 assertion audit, traceability matrix & test proofs
    ├── user-guide.md              # End-user operator manual, controls & dashboard guide
    ├── final-audit-report.md      # Independent quality assurance & formal audit report
    ├── phase-7-investigation.md   # Phase 7 defect investigation & kinematic root causes
    ├── phase-7-remediation-report.md # Phase 7 remediation report & 18-scenario verification proofs
    ├── phase-8-visual-audit.md    # Phase 8 visual and UX defect audit
    ├── phase-8-remediation-report.md # Phase 8 remediation report & balanced UI architecture
    ├── phase-8-evidence/          # Phase 8 headless browser screenshot evidence (10 images)
    ├── phase-9-acceptance-report.md # Phase 9 independent end-to-end acceptance testing report
    ├── phase-9-evidence/          # Phase 9 browser acceptance screenshot evidence (17 images)
    ├── phase-10-logic-gate-workbench.md # Phase 10 DPCO logic gate workbench manual & truth tables
    ├── phase-10-evidence/         # Phase 10 headless browser screenshot evidence (8 images)
    ├── phase-10-1-correction-report.md # Phase 10.1 Telemetry accuracy, clearance & read-only bridge report
    └── phase-10.1-evidence/       # Phase 10.1 headless browser screenshot evidence (10 images)
```

---

## 2. Comprehensive Documentation Suite

For exhaustive technical references, inspect the dedicated documentation manuals:

| Manual | Document Path | Focus Areas |
|---|---|---|
| **Project Overview** | [`docs/project-overview.md`](./docs/project-overview.md) | High-level architecture, module contracts, dataflow diagrams, and zero-dependency principles. |
| **FSM Specification** | [`docs/fsm-design.md`](./docs/fsm-design.md) | 6-tuple formal state automaton, state transition table, invariant proofs, and synthetic fault traps. |
| **Adaptive Control** | [`docs/adaptive-control.md`](./docs/adaptive-control.md) | Corridor demand formulas ($D_{NS}, D_{EW}$), dynamic green allocation ($5\text{--}25\text{s}$), anti-starvation, and XAI. |
| **Testing Report** | [`docs/testing-report.md`](./docs/testing-report.md) | Full audit of all 50 verification assertions, requirements traceability matrix, and execution proof. |
| **User & Operator Guide** | [`docs/user-guide.md`](./docs/user-guide.md) | Complete interface walkthrough, controls, timing modes, emergency dispatching, and dashboard interpretation. |
| **Final Audit Report** | [`docs/final-audit-report.md`](./docs/final-audit-report.md) | Independent QA validation, 12 edge-case stress results, safety proofs, and readiness assessment. |
| **Phase 7 Investigation** | [`docs/phase-7-investigation.md`](./docs/phase-7-investigation.md) | Diagnostic analysis and root-cause breakdown of 6 simulation defects (DEF-P7-01 to DEF-P7-06). |
| **Phase 7 Remediation** | [`docs/phase-7-remediation-report.md`](./docs/phase-7-remediation-report.md) | Remediation report, architecture updates, and verification results across all 18 operational scenarios. |
| **Phase 8 Visual Audit** | [`docs/phase-8-visual-audit.md`](./docs/phase-8-visual-audit.md) | Visual UI audit, UI/UX defect analysis (DEF-UI-01 through DEF-UI-07), and baseline screenshots. |
| **Phase 8 Remediation** | [`docs/phase-8-remediation-report.md`](./docs/phase-8-remediation-report.md) | Balanced dashboard architecture, authoritative demand snapshot, crosswalk geometry, and 10 screenshot proofs. |
| **Phase 9 Acceptance Report** | [`docs/phase-9-acceptance-report.md`](./docs/phase-9-acceptance-report.md) | Independent end-to-end browser acceptance report across Scenarios A-H, 17 screenshot captures, and demonstration readiness. |
| **Phase 10 Logic Workbench** | [`docs/phase-10-logic-gate-workbench.md`](./docs/phase-10-logic-gate-workbench.md) | DPCO Digital Logic Gate Workbench, truth tables, 6 production circuits, learning sandbox, and 8 screenshot proofs. |
| **Phase 10.1 Telemetry Fix** | [`docs/phase-10-1-correction-report.md`](./docs/phase-10-1-correction-report.md) | Telemetry accuracy fix: multi-class emergency detection, conflict zone clearance, vehicle entry alignment, and 10 screenshot proofs. |

---

## 3. Finite State Machine (FSM) Specification

The intersection coordinates traffic across two orthogonal axes:
- **Axis 1 (NS)**: North-South Corridor
- **Axis 2 (EW)**: East-West Corridor

### 3.1 State Definitions

| State Code | Identifier | North & South Lights | East & West Lights | Default Duration | Next State | Phase Purpose |
|---|---|---|---|---|---|---|
| **S0** | `S0_NS_GREEN` | <span style="color:#10b981;font-weight:bold;">GREEN</span> | <span style="color:#ef4444;font-weight:bold;">RED</span> | 10 seconds | `S1_NS_YELLOW` | High-throughput North-South traffic movement |
| **S1** | `S1_NS_YELLOW` | <span style="color:#f59e0b;font-weight:bold;">YELLOW</span> | <span style="color:#ef4444;font-weight:bold;">RED</span> | 3 seconds | `S2_EW_GREEN` | Clearance interval for North-South vehicles |
| **S2** | `S2_EW_GREEN` | <span style="color:#ef4444;font-weight:bold;">RED</span> | <span style="color:#10b981;font-weight:bold;">GREEN</span> | 10 seconds | `S3_EW_YELLOW` | High-throughput East-West traffic movement |
| **S3** | `S3_EW_YELLOW` | <span style="color:#ef4444;font-weight:bold;">RED</span> | <span style="color:#f59e0b;font-weight:bold;">YELLOW</span> | 3 seconds | `S0_NS_GREEN` | Clearance interval for East-West vehicles |
| **FAIL-SAFE** | `EMERGENCY_ALL_RED` | <span style="color:#ef4444;font-weight:bold;">RED</span> | <span style="color:#ef4444;font-weight:bold;">RED</span> | Hold | `S0_NS_GREEN` | All-stop safety state: all vehicles halt safely at stop lines |

### 3.2 State Transition Diagram

```
       ┌────────────────────────────────────────────────────────┐
       │                                                        │
       ▼                                                        │
  +──────────────+         +──────────────+                     │
  │      S0      │  10s    │      S1      │                     │
  │   NS GREEN   ├────────►│  NS YELLOW   │                     │
  │    EW RED    │         │    EW RED    │                     │
  +──────────────+         +──────┬───────+                     │
                                  │ 3s                          │
                                  ▼                             │
  +──────────────+         +──────────────+                     │
  │      S3      │   10s   │      S2      │                     │
  │    NS RED    │◄────────┤    NS RED    │                     │
  │  EW YELLOW   │         │   EW GREEN   │                     │
  +──────┬───────+         +──────────────+                     │
         │                                                      │
         │ 3s                                                   │
         └──────────────────────────────────────────────────────┘
                                  ▲
                                  │ (Resume)
                   ┌──────────────┴──────────────┐
                   │    EMERGENCY ALL-RED HALT   │
                   │    NS: RED   │   EW: RED    │
                   └─────────────────────────────┘
```

---

## 4. Vehicle Simulation, Physics & Queuing

### 4.1 Kinematics & Approach Trajectories
- Vehicles approach the 4-way intersection from all 4 approaches (North, South, East, West).
- Velocity and deceleration parameters:
  - Max Cruising Speed: $70\text{ px/s}$
  - Acceleration: $95\text{ px/s}^2$
  - Braking Deceleration: $150\text{ px/s}^2$
- Each vehicle is represented by an animated CSS vehicle model featuring windshield, roof styling, and rear brake lights.

### 4.2 Stopping & Queuing Discipline
- **Stop Line Invariant**: When a signal is **RED** or **YELLOW**, approaching vehicles that have not yet crossed the stop line (`pos = 138px`) decelerate smoothly and halt before the stop line (`pos <= 138px`).
- **Safe Following Separation**: Following vehicles in a queue maintain a strict minimum bumper-to-bumper distance of at least $38\text{px}$ (`CAR_LENGTH + MIN_GAP`), preventing overlaps.
- **Intersection Clearance Lock**: When a signal turns GREEN, oncoming vehicles verify that the orthogonal conflict box is empty before entering the junction.

### 4.3 Traffic Density Presets
Three density modes are selectable in real-time:
1. **Low Traffic**: Average spawn interval $\sim 4.5\text{s}$, light arrivals ($0\text{--}2$ cars in queue).
2. **Medium Traffic**: Average spawn interval $\sim 2.8\text{s}$, steady commuter stream ($2\text{--}4$ cars in queue).
3. **High Traffic**: Average spawn interval $\sim 1.4\text{s}$, heavy peak-hour congestion ($4\text{--}8$ cars in queue).

---

## 5. Adaptive Intelligent Signal Timing & Explainable AI (XAI)

The Adaptive Signal Control Engine dynamically tailors green intervals to real-time traffic conditions while maintaining deterministic FSM transitions.

### 5.1 Dynamic Demand Calculation
For each orthogonal corridor, demand $D$ is calculated using discrete queued vehicles ($Q$, weight 1.0) and inbound approaching traffic ($A$, weight 0.4):
$$D_{\text{NS}} = (Q_{\text{North}} + Q_{\text{South}}) + 0.4 \times (A_{\text{North}} + A_{\text{South}})$$
$$D_{\text{EW}} = (Q_{\text{East}} + Q_{\text{West}}) + 0.4 \times (A_{\text{East}} + A_{\text{West}})$$

### 5.2 Dynamic Duration Allocation
- **Demand-Responsive Scaling**: When an active axis has significantly greater demand than the cross street, green duration scales up:
  $$T_{\text{green}} = \min\big(T_{\text{max}}, T_{\text{base}} + \Delta D \times 2.0\text{s}\big)$$
- **Zero-Demand Truncation**: If an active corridor has zero waiting vehicles while the opposing street has backlog, green time is truncated to $T_{\text{min}} = 5\text{s}$ to expedite cycle rotation.
- **Strict Boundary Bounds**:
  $$5\text{s} \le T_{\text{green}} \le 25\text{s}$$
- **Anti-Starvation Safeguard**: If an approach is held at minimum green for 2 consecutive cycles while cross traffic is high, the anti-starvation boost automatically grants extra green time ($14\text{s}$) to ensure fair throughput.
- **Yellow Clearance Inviolability**: The 3-second yellow clearance interval is **never** compressed or bypassed under any adaptive condition.

### 5.3 Operating Modes
1. **Adaptive Mode**: Real-time automated demand optimization and explainability.
2. **Fixed Mode**: Nominal static timing ($10\text{s}$ green, $3\text{s}$ yellow).
3. **Manual Mode**: Direct user-configurable timing inputs from the state table.

### 5.4 Explainable AI (XAI) Rationale
Every timing decision produces a human-interpretable rationale displayed directly on the ITS dashboard:
- *"North-South traffic demand (11.0) exceeds East-West (1.0). Green extended to 25s (+20s) to disperse queue."*
- *"Zero queued vehicles detected on North-South. Green truncated to minimum threshold (5s) to expedite clearance for East-West (7.2 demand)."*
- *"Demand is balanced (North-South: 4.0, East-West: 4.0). Standard nominal green duration (10s) assigned."*

---

## 6. Emergency Vehicle Priority Preemption

Provides dynamic, software-based priority preemption for emergency first responders while strictly enforcing yellow clearance safety invariants.

### 6.1 Multi-Class Vehicle Representation
| Vehicle Type | Dimensions | Top Speed | Visual Representation | Priority Level |
|---|---|---|---|---|
| **Compact Car** | $14 \times 26\text{px}$ | $70\text{ px/s}$ | Multi-color commuter sedans | Normal |
| **Transit Bus** | $16 \times 36\text{px}$ | $60\text{ px/s}$ | Amber bus body with extended roof | Normal |
| **Ambulance** | $16 \times 30\text{px}$ | $90\text{ px/s}$ | White medical chassis with emergency strobe | High Priority |
| **Fire Engine** | $18 \times 36\text{px}$ | $88\text{ px/s}$ | Fire-red body with flashing emergency beacon | High Priority |
| **Police Cruiser**| $14 \times 28\text{px}$ | $95\text{ px/s}$ | Navy interceptor with dual flashing lightbar | High Priority |

### 6.2 Preemption Safety Protocols
- **Never Instant Conflicting Green**: If an emergency vehicle arrives at a RED signal while the opposing axis is GREEN, the controller **never** abruptly cuts to opposing green. It transitions through the full $3\text{s}$ yellow clearance (`S1` or `S3`), ensures the intersection box is clear of crossing traffic, and then assigns GREEN to the emergency approach.
- **Active Green Extension**: If the emergency vehicle approaches an already-GREEN signal, the green phase is held open until the emergency vehicle clears the intersection.
- **Automatic Priority Release**: Once the emergency vehicle transits past the exit boundary (`pos >= 294px`), the priority lock is automatically released, returning to standard cyclic or adaptive operation.
- **Operator Dispatch Toolbar**: On-demand dispatch buttons allow dispatching Ambulances, Fire Engines, or Police Cruisers from North, South, East, or West.

---

## 7. Advanced Traffic Analytics, Heatmap & SVG Sparklines

Provides deep ITS observability without relying on bulky external charting libraries (zero dependencies):

### 7.1 Pure SVG Rolling Queue Timeline
- Renders a lightweight, high-performance SVG line chart in real-time.
- Simultaneously tracks the **North-South Corridor** (blue polyline) and **East-West Corridor** (pink polyline) across a 25-point rolling window.

### 7.2 Approach Congestion Heatmap
- 4-quadrant real-time approach visualizer mapping queue backlog:
  - **CLEAR** (Cyan/Navy): $0\text{--}1$ vehicles in queue.
  - **MODERATE** (Amber/Gold): $2\text{--}3$ vehicles in queue.
  - **HEAVY** (Crimson/Red): $\ge 4$ vehicles in queue.

### 7.3 Traffic Efficiency Score & Delay Savings
- **Traffic Efficiency Score ($15\text{--}99\%$)**: Evaluates overall intersection operational health combining queue length penalties and waiting times.
- **Adaptive Delay Saved**: Quantifies cumulative vehicle-seconds saved by dynamic green duration allocation compared to static fixed cycle baseline.
- **Emergency Clearance Analytics**: Tracks total emergency priority transits, average transit duration, and clearance success rate.

---

## 8. Safety Invariant Proof & Fail-Safe Design

### 8.1 Primary Safety Invariant
> **Critical Requirement**: Conflicting directions must **NEVER** receive green simultaneously.

Formally:
$$\neg \Big( \big(\text{Signal}_{\text{North}} = \text{GREEN} \lor \text{Signal}_{\text{South}} = \text{GREEN}\big) \land \big(\text{Signal}_{\text{East}} = \text{GREEN} \lor \text{Signal}_{\text{West}} = \text{GREEN}\big) \Big)$$

In every state $S \in \{S0, S1, S2, S3\}$:
- In $S0$: $\text{NS} = \text{GREEN}$, $\text{EW} = \text{RED}$. Conflicting green is impossible.
- In $S1$: $\text{NS} = \text{YELLOW}$, $\text{EW} = \text{RED}$. Conflicting green is impossible.
- In $S2$: $\text{NS} = \text{RED}$, $\text{EW} = \text{GREEN}$. Conflicting green is impossible.
- In $S3$: $\text{NS} = \text{RED}$, $\text{EW} = \text{YELLOW}$. Conflicting green is impossible.

### 8.2 Clearance Isolation Invariant
An active corridor clearance ($\text{YELLOW}$) never overlaps with opposing movement:
$$\neg \Big( \text{Active}(\text{NS}) \land \text{Active}(\text{EW}) \Big)$$
where $\text{Active}(\text{axis}) = (\text{Signal} = \text{GREEN} \lor \text{Signal} = \text{YELLOW})$.

### 8.3 Fail-Safe All-Red Halt
An operator can trigger the **All-Red Halt** button at any time. When triggered or in the event of an anomaly:
- All 4 traffic signals switch immediately to **RED**.
- Approaching vehicles immediately halt behind stop lines.
- Vehicles already in transit safely clear the junction box.
- Normal operation can be restored with a single click, safely returning to state $S0$.

---

## 9. Features & Controls

1. **Four-Way Junction Visualization**:
   - Asphalt roadways with curb borders, stop lines, center grid box, and pedestrian zebra crossings.
   - 3-lamp signal units with high-contrast LED glow effects.
   - Numerical countdown timers on all 4 signal units.
2. **Simulation Controls**:
   - **Start**: Initiates or resumes the countdown and vehicle simulation.
   - **Pause**: Freezes the simulation, holding vehicle positions and light timers.
   - **Reset**: Safely returns to $S0$, clearing vehicle queues and resetting analytics.
   - **Manual Step**: Steps through FSM transitions one by one.
   - **All-Red Halt**: Immediate fail-safe emergency stop.
3. **Density & Speed Selectors**:
   - Density: Low, Medium, High.
   - Speed Multiplier: `1x` (real-time), `2x` (accelerated), `5x` (rapid testing).
4. **Interactive Verification Runner**:
   - Click "Run Invariant Tests" in the web UI to run the 50-assertion test suite in-browser.

---

## 10. Verification & Automated Testing

### Running Tests in Node.js (Zero Dependencies)
You can run the full verification suite directly from the terminal:
```bash
node Traffic-Light-Controller/verify.js
```

### Full Assertion Audit (72/72 Passing):
- **Phase 1 (FSM Core & Signals)**:
  - **Test 1**: Initial state is strictly $S0$ with North/South GREEN and East/West RED.
  - **Test 2**: Cyclic sequence fidelity ($S0 \to S1 \to S2 \to S3 \to S0$) over multiple cycles.
  - **Test 3**: Directional light outputs verify exact colors for all 4 approaches across states.
  - **Test 4**: Primary Safety Invariant proof over 200 consecutive transitions (zero conflicting greens).
  - **Test 5**: Synthetic fault injection: verifies that illegal dual-green states are trapped (`ERR_DUAL_GREEN`).
  - **Test 6**: Synthetic fault injection: verifies that illegal dual-clearance states are trapped (`ERR_DUAL_ACTIVE`).
  - **Test 7**: Reset restores initial state $S0$, resets transition counters, and accepts custom timings.
- **Phase 2 (Vehicles, Queuing & Safety)**:
  - **Test 8**: Fail-Safe All-Red Halt forces all signals to RED and recovers safely.
  - **Test 9**: Vehicle movement and kinematics accelerate and traverse intersection under green signal.
  - **Test 10**: Red-light stopping invariant: vehicle halts completely at stop line on RED.
  - **Test 11**: Queue discipline & anti-collision: zero vehicle overlap in queues ($38\text{px}$ minimum spacing).
  - **Test 12**: Conflicting direction vehicle prevention: 0 simultaneous collision box occupancy.
  - **Test 13**: Traffic density presets: Low, Medium, High spawn scaling verified.
  - **Test 14**: Analytics mathematical consistency and conservation laws.
- **Phase 3 (Adaptive Signal Timing & XAI)**:
  - **Test 15**: Adaptive controller default mode and clean switching (ADAPTIVE, FIXED, MANUAL).
  - **Test 16**: Balanced traffic demand triggers nominal base green duration ($10\text{s}$).
  - **Test 17**: Heavy North-South congestion scales green duration upwards with explainability rationale.
  - **Test 18**: Heavy East-West congestion scales green duration upwards with explainability rationale.
  - **Test 19**: Extreme traffic strictly clamped to $T_{\text{max}} = 25\text{s}$; zero demand truncated to $T_{\text{min}} = 5\text{s}$.
  - **Test 20**: Anti-starvation invariant boosts green time after consecutive low-allocation cycles.
  - **Test 21**: Yellow clearance ($3\text{s}$) remains inviolable under dynamic adaptive scaling.
- **Phase 4 (Emergency Vehicle Priority Preemption)**:
  - **Test 22**: Multi-class vehicle instantiation: Ambulance, Fire Engine, Police with proper dimensions and emergency flags.
  - **Test 23**: Preemption safety: Conflicting green prompts yellow clearance, never instant conflicting switch.
  - **Test 24**: Active green extension: Green held open while emergency vehicle approaches.
  - **Test 25**: Priority release invariant: Priority lock released once emergency vehicle exits the junction.
  - **Test 26**: Emergency event logging: Dispatch telemetries recorded in audit log with timestamps.
- **Phase 5 (Advanced Traffic Analytics & Telemetry)**:
  - **Test 27**: Analytics snapshot data model and queue aggregation integrity across corridors.
  - **Test 28**: Approach congestion heatmap: heat normalized accurately across $[0.0, 1.0]$.
  - **Test 29**: Pure SVG queue history sparkline generation: self-contained zero-dependency chart rendering.
  - **Test 30**: Traffic Efficiency Score: dynamic scoring responsive to queue backlog and delay.
  - **Test 31**: Adaptive timing delay savings benchmark: delay savings actively accumulated against fixed baseline.
  - **Test 32**: Emergency preemption clearance analytics: mean transit duration and clearance success rate verified.
- **Phase 7 (Simulation Reliability & 18 Operational Scenarios)**:
  - **Test 33**: Scenario 1: Low traffic continuous 5-minute simulation (0 stuck vehicles, 0 collisions).
  - **Test 34**: Scenario 2: Medium traffic continuous 5-minute simulation (balanced throughput).
  - **Test 35**: Scenario 3: High traffic continuous 5-minute stress simulation (safe bumper gaps enforced).
  - **Test 36**: Scenario 4: Balanced NS/EW traffic allocation ($D_{NS} \approx D_{EW}$).
  - **Test 37**: Scenario 5: Extremely unbalanced traffic dynamic clamping (25s max green vs 5s min green).
  - **Test 38**: Scenario 6: Multiple vehicles approaching same stop line halt in order with safe gaps.
  - **Test 39**: Scenario 7: Queued vehicles discharge and clear intersection sequentially.
  - **Test 40**: Scenario 8: Emergency dispatch during opposing green triggers safe yellow transition before green.
  - **Test 41**: Scenario 9: Multiple simultaneous emergency requests handled without dual green conflict.
  - **Test 42**: Scenario 10: Priority Green actively held open while emergency vehicle transits intersection.
  - **Test 43**: Scenario 11: All-Red Halt with occupied junction prevents conflicting traffic entry.
  - **Test 44**: Scenario 12: All-Red recovery restores normal FSM operational state and active green.
  - **Test 45**: Scenario 13: Simulation pause freezes physics; resume maintains smooth forward kinematics.
  - **Test 46**: Scenario 14: Simulation reset cleanly purges all vehicle queues, emergency dispatches, and metrics.
  - **Test 47**: Scenario 15: Speed multiplier acceleration (10x equivalent) maintains numerical stability.
  - **Test 48**: Scenario 16: Dynamic mode switching between ADAPTIVE, FIXED, and MANUAL operates seamlessly.
  - **Test 49**: Scenario 17: Vehicle conservation invariant holds continuously: Total Generated = Passed + Active.
  - **Test 50**: Scenario 18: Long-duration continuous operation avoids unbounded memory growth and frozen vehicles.
- **Phase 8 (Visual Audit, UI Synchronization & Crosswalk Invariants)**:
  - **Test 51**: Authoritative demand snapshot evaluation: `getLiveDemandEvaluation` is zero-side-effect and mathematically consistent.
  - **Test 52**: Explainable AI (XAI) rationale synchronization across `ADAPTIVE`, `FIXED`, and `MANUAL` modes.
  - **Test 53**: Emergency priority green hold active during transit and safely released post-clearance without conflict.
  - **Test 54**: Spatial boundary invariant: Stopped vehicles halt strictly at stop line ($138\text{px}$) maintaining clearance from pedestrian crosswalks ($154\text{px}$).
- **Phase 10 (DPCO Digital Logic Gate Workbench & Circuits)**:
  - **Test 55**: Standard 7-gate truth table verification (AND, OR, NOT, NAND, NOR, XOR, XNOR) across 26 total input/output state vectors.
  - **Test 56**: Circuit 1 (NS Green Authorization): $NS_{Green} = S_0 \land \neg \text{AllRed} \land \neg \text{Fault}$.
  - **Test 57**: Circuit 2 (EW Green Authorization): $EW_{Green} = S_2 \land \neg \text{AllRed} \land \neg \text{Fault}$.
  - **Test 58**: Circuit 3 (All-Red Safety Interlock): $\text{Halt} = \text{EmergencyAllRed} \lor \text{InvariantViolation}$.
  - **Test 59**: Circuit 4 (Vehicle Entry Authorization): $\text{EntryGranted} = \text{SignalGreen} \land \neg \text{ConflictingOccupied}$.
  - **Test 60**: Circuit 5 (Emergency Priority Hold): $\text{PriorityHold} = \text{ActiveEmergency} \land \text{TargetGreenActive} \land \neg \text{VehicleCleared}$.
  - **Test 61**: Circuit 6 (Invariant Defense Monitor): $\text{Hazard} = (NS_{Green} \lor NS_{Yellow}) \land (EW_{Green} \lor EW_{Yellow})$.
  - **Test 62**: Authoritative telemetry bridge extracts accurate live state and synchronizes circuit evaluations.
  - **Test 63**: Learning Mode state changes are completely sandboxed and produce zero side-effects on traffic simulation.
- **Phase 10.1 (Digital Logic Telemetry Accuracy & Emergency Priority Refinement)**:
  - **Test 64**: Multi-class emergency detection across `AMBULANCE`, `FIRE_ENGINE`, and `POLICE`.
  - **Test 65**: Strict exclusion of non-emergency passenger vehicles (`CAR`, `BUS`).
  - **Test 66**: Priority hold active while emergency vehicle approaches stop line ($50\text{px}$).
  - **Test 67**: In-transit priority hold maintained past stop line ($145\text{px}$) without premature clearance.
  - **Test 68**: Priority hold preserved while vehicle actively traverses intersection conflict zone ($220\text{px}$).
  - **Test 69**: Safe clearance release strictly upon crossing intersection exit ($300\text{px}$, $\text{cleared}=1$).
  - **Test 70**: Synchronized release of FSM priority hold lock and logic circuit output.
  - **Test 71**: Active FSM preemption request prioritized during multi-vehicle queue congestion.
  - **Test 72**: Vehicle Entry circuit evaluates North approach with `signalGreen=1` during $S_0$.
  - **Test 73**: Vehicle Entry circuit evaluates East approach with `signalGreen=1` during $S_2$.
  - **Test 74**: Vehicle Entry circuit denies permission during yellow clearance states ($S_1, S_3$).
  - **Test 75**: Vehicle Entry circuit denies permission during fail-safe All-Red halt.
  - **Test 76**: Telemetry bridge extraction is strictly read-only with zero mutation to FSM state properties.
  - **Test 77**: Telemetry bridge extraction causes zero mutation to vehicle physics, speeds, or queues.
  - **Test 78**: Full concordance between circuit subterm pills, SVG schematics, and evaluated logic gates.

---

## 11. How to Run

1. Open [`Traffic-Light-Controller/index.html`](./index.html) directly in any modern web browser (Chrome, Edge, Firefox, Safari).
2. Click **Start** to run the simulation.
3. Switch **Density** (Low / Medium / High) to observe queuing dynamics.
4. Test the **All-Red Halt** button to observe fail-safe stopping.
5. Use the **Emergency Dispatcher** to trigger high-priority preemption runs.
6. Click **Run Invariant Tests** to execute in-browser verification proofs.
