# Phase 10: DPCO Digital Logic Gate Demonstration Workbench
## Intelligent Traffic Management System (ITMS) — Hardware-Grounded Boolean Logic Integration

---

## 1. Executive Summary & Academic Objective

The **DPCO (Digital Principles and Computer Organization) Digital Logic Gate Workbench** introduces an interactive, academically rigorous, and production-grounded digital logic demonstration environment directly into the Intelligent Traffic Management System dashboard.

Unlike decorative computer graphics or static circuit illustrations, this workbench demonstrates the authentic Boolean algebraic expressions, gate combinations, and hardware interlock mechanisms that drive the four-way traffic controller backend in real time.

### Key Highlights
- **Location**: Occupies the full width of the left dashboard column (`.dashboard-col-left`) directly beneath the 4-Way Traffic Junction Simulation card.
- **Dual Operating Modes**:
  1. **Live Controller Mode**: Renders dynamic, live-evaluated multi-gate Boolean circuits fed by real-time telemetry from the running FSM (`fsm.js`), vehicle kinematics engine (`vehicles.js`), and adaptive controller (`adaptive.js`).
  2. **Learning Workbench Mode**: An interactive 7-gate digital laboratory allowing engineering students and faculty to test basic gates (AND, OR, NOT, NAND, NOR, XOR, XNOR), toggle input pins, inspect animated signal wires, and observe dynamic truth table highlighting with a 100% sandboxed isolation guarantee.
- **Pure Web Standards**: Zero external frameworks, zero charting or canvas libraries. All schematics are rendered using responsive, standards-compliant Inline SVG with animated signal flow and IEEE/ANSI standard gate geometry.
- **Formal Verification**: 81/81 automated verification assertions passing with 0 failures, verified via Node.js CLI and headless Chrome browser automation.

---

## 2. Digital Logic Gate Fundamentals & Standard Gate Library

Digital logic gates are physical electronic devices implementing elementary Boolean algebraic functions. In modern computing and embedded traffic signal controllers (e.g., NEMA TS-2 and 170/2070 controller cabinets), digital logic gates form the combinatorial decision blocks, arithmetic units, and hardware safety monitors.

The workbench implements seven standard digital logic gates:

### 2.1 Basic Logic Gates Truth Tables & Equations

#### 1. AND Gate (Conjunction)
- **Symbol**: ANSI standard flat-back with semicircular apex.
- **Boolean Equation**: $Y = A \cdot B = A \land B$
- **Operation**: Output is HIGH ($1$) only if **both** inputs $A$ and $B$ are HIGH ($1$).
- **DPCO Context**: Primary product term in Sum-of-Products (SOP) logic; implements coincidence detection and joint authorization.

| Input A | Input B | Output Y ($A \cdot B$) |
|:---:|:---:|:---:|
| 0 | 0 | **0** |
| 0 | 1 | **0** |
| 1 | 0 | **0** |
| 1 | 1 | **1** |

---

#### 2. OR Gate (Disjunction)
- **Symbol**: ANSI standard concave-curved back with pointed apex.
- **Boolean Equation**: $Y = A + B = A \lor B$
- **Operation**: Output is HIGH ($1$) if **at least one** input is HIGH ($1$).
- **DPCO Context**: Primary sum term in Product-of-Sums (POS) logic; implements inclusive choice and multi-source interrupt triggering.

| Input A | Input B | Output Y ($A + B$) |
|:---:|:---:|:---:|
| 0 | 0 | **0** |
| 0 | 1 | **1** |
| 1 | 0 | **1** |
| 1 | 1 | **1** |

---

#### 3. NOT Gate (Inverter)
- **Symbol**: ANSI standard equilateral triangle with right-pointing apex and output inversion bubble.
- **Boolean Equation**: $Y = \overline{A} = \neg A$
- **Operation**: Output is the logical complement of the input.
- **DPCO Context**: Fundamental CMOS building block consisting of a complementary PMOS pull-up and NMOS pull-down transistor pair.

| Input A | Output Y ($\overline{A}$) |
|:---:|:---:|
| 0 | **1** |
| 1 | **0** |

---

#### 4. NAND Gate (Universal Gate)
- **Symbol**: AND gate geometry with inversion bubble at output pin.
- **Boolean Equation**: $Y = \overline{A \cdot B} = \neg (A \land B)$
- **Operation**: Output is LOW ($0$) only when both inputs are HIGH ($1$).
- **DPCO Context**: Functionally complete universal gate. Forms the basis of modern NAND flash memory and high-speed CMOS standard cell libraries.

| Input A | Input B | Output Y ($\overline{A \cdot B}$) |
|:---:|:---:|:---:|
| 0 | 0 | **1** |
| 0 | 1 | **1** |
| 1 | 0 | **1** |
| 1 | 1 | **0** |

---

#### 5. NOR Gate (Universal Gate)
- **Symbol**: OR gate geometry with inversion bubble at output pin.
- **Boolean Equation**: $Y = \overline{A + B} = \neg (A \lor B)$
- **Operation**: Output is HIGH ($1$) only when all inputs are LOW ($0$).
- **DPCO Context**: Functionally complete universal gate. Forms the foundation of classic SR latches, memory registers, and NOR flash architectures.

| Input A | Input B | Output Y ($\overline{A + B}$) |
|:---:|:---:|:---:|
| 0 | 0 | **1** |
| 0 | 1 | **0** |
| 1 | 0 | **0** |
| 1 | 1 | **0** |

---

#### 6. XOR Gate (Exclusive OR)
- **Symbol**: OR gate geometry preceded by a standoff curved input spine.
- **Boolean Equation**: $Y = A \oplus B = \overline{A}B + A\overline{B} = (A \land \neg B) \lor (\neg A \land B)$
- **Operation**: Output is HIGH ($1$) if inputs are **different**; LOW ($0$) if identical.
- **DPCO Context**: Modulo-2 binary addition. Forms the sum bit in half and full adders, parity generators, and pseudo-random LFSR circuits.

| Input A | Input B | Output Y ($A \oplus B$) |
|:---:|:---:|:---:|
| 0 | 0 | **0** |
| 0 | 1 | **1** |
| 1 | 0 | **1** |
| 1 | 1 | **0** |

---

#### 7. XNOR Gate (Equivalence Gate)
- **Symbol**: XOR gate geometry with inversion bubble at output pin.
- **Boolean Equation**: $Y = \overline{A \oplus B} = AB + \overline{A}\,\overline{B} = (A \land B) \lor (\neg A \land \neg B)$
- **Operation**: Output is HIGH ($1$) if inputs are **identical**; LOW ($0$) if different.
- **DPCO Context**: Digital bitwise comparator. Used in central processing units (CPUs) for condition code equality testing.

| Input A | Input B | Output Y ($\overline{A \oplus B}$) |
|:---:|:---:|:---:|
| 0 | 0 | **1** |
| 0 | 1 | **0** |
| 1 | 0 | **0** |
| 1 | 1 | **1** |

---

## 3. Live Controller Boolean Decision Circuits (Production Grounding)

The six circuits in Live Controller Mode are not theoretical or simulated approximations. Each circuit directly implements the decision logic executed on every animation frame and simulation step in `fsm.js`, `vehicles.js`, and `app.js`.

```
Production Controller State (fsm.js, vehicles.js, adaptive.js)
                 │
                 ▼
Authoritative Logic Telemetry Extraction (logic.js :: getLogicTelemetry)
                 │
                 ▼
Real-Time Multi-Gate Circuit Evaluation & Animation Loop (app.js)
                 │
                 ▼
Responsive Inline SVG Render (Gate Schematics + Animated Wires + Subterm Pills)
```

---

### Circuit 1: North-South Green Authorization Circuit (`NS_GREEN`)
- **Implemented In**: `fsm.js` line 134, 175-181; `app.js` line 593-619
- **Boolean Equation**:
  $$NS_{Green} = S_0 \land \neg \text{AllRed} \land \neg \text{Fault}$$
- **Gate Combination**: $2 \times \text{NOT}$ gates $+ 1 \times \text{3-Input AND}$ gate
- **Inputs**:
  - $S_0$: Active FSM state is `S0_NS_GREEN` ($1$ if active, $0$ otherwise)
  - $\text{AllRed}$: Active Fail-Safe All-Red Halt override ($1$ if halted, $0$ if normal)
  - $\text{Fault}$: Safety Invariant violation trip signal ($1$ if hazard, $0$ if safe)
- **Operation**: North-South traffic heads receive a physical GREEN drive signal if and only if the FSM register holds state $S_0$, the manual/automatic All-Red trip is deasserted, and the hardware safety monitor confirms zero corridor conflicts.
- **Hardware Analogy**: Synchronous Moore state machine output decoder with asynchronous active-low master interlocks.

---

### Circuit 2: East-West Green Authorization Circuit (`EW_GREEN`)
- **Implemented In**: `fsm.js` line 135, 175-181; `app.js` line 634-652
- **Boolean Equation**:
  $$EW_{Green} = S_2 \land \neg \text{AllRed} \land \neg \text{Fault}$$
- **Gate Combination**: $2 \times \text{NOT}$ gates $+ 1 \times \text{3-Input AND}$ gate
- **Inputs**:
  - $S_2$: Active FSM state is `S2_EW_GREEN` ($1$ if active, $0$ otherwise)
  - $\text{AllRed}$: Active Fail-Safe All-Red Halt override ($1$ if halted, $0$ if normal)
  - $\text{Fault}$: Safety Invariant violation trip signal ($1$ if hazard, $0$ if safe)
- **Operation**: East-West traffic heads receive a GREEN drive signal strictly when the FSM is in state $S_2$ and both fail-safe trip signals remain LOW ($0$). Mutually exclusive with Circuit 1.
- **Hardware Analogy**: Orthogonal phase drive logic ensuring zero simultaneous corridor green permissions.

---

### Circuit 3: All-Red Safety Interlock & Fault Detection (`SAFETY_HALT`)
- **Implemented In**: `fsm.js` lines 140-160, 274-286; `app.js` lines 938-959
- **Boolean Equation**:
  $$\text{Halt} = \text{EmergencyAllRed} \lor \text{InvariantViolation}$$
- **Gate Combination**: $1 \times \text{2-Input OR}$ gate
- **Inputs**:
  - $\text{EmergencyAllRed}$: Operator manual toggle or emergency dispatch override ($1$ if requested)
  - $\text{InvariantViolation}$: Continuous formal invariant failure ($1$ if dual active green/yellow detected)
- **Operation**: If either input goes HIGH ($1$), the OR gate immediately fires $\text{Halt} = 1$, clamping all signal lamps to RED and isolating the junction collision zone.
- **Hardware Analogy**: Asynchronous Master Trip Relay / Emergency Stop (E-Stop) hardwired into signal cabinet driver circuits.

---

### Circuit 4: Junction Vehicle Entry Permission Circuit (`VEHICLE_ENTRY`)
- **Implemented In**: `vehicles.js` lines 426-438, 359-379
- **Boolean Equation**:
  $$\text{EntryGranted} = \text{SignalGreen} \land \neg \text{ConflictingOccupied}$$
- **Gate Combination**: $1 \times \text{NOT}$ gate $+ 1 \times \text{2-Input AND}$ gate
- **Inputs**:
  - $\text{SignalGreen}$: Current approach corridor light state ($1$ if GREEN, $0$ if YELLOW or RED)
  - $\text{ConflictingOccupied}$: Real-time kinematic detector confirming if any cross-axis vehicle occupies the central $156\text{px} \times 156\text{px}$ conflict zone
- **Operation**: A lead vehicle approaching the white stop line ($138\text{px}$) is granted clearance to advance into the intersection only when its signal is GREEN and the intersection conflict box has been completely vacated by cross-traffic. If cross-traffic is still clearing during a green signal, entry is blocked ($\text{EntryGranted} = 0$) until the conflict box is clear.
- **Hardware Analogy**: Inductive loop sensor presence detection combined with signal head state telemetry.

---

### Circuit 5: Emergency Priority Hold Interlock (`EMERGENCY_HOLD`)
- **Implemented In**: `fsm.js` lines 329-344; `vehicles.js` lines 340-354; `app.js` lines 824-832
- **Boolean Equation**:
  $$\text{PriorityHold} = \text{ActiveEmergency} \land \text{TargetGreenActive} \land \neg \text{VehicleCleared}$$
- **Gate Combination**: $1 \times \text{NOT}$ gate $+ 1 \times \text{3-Input AND}$ gate
- **Inputs**:
  - $\text{ActiveEmergency}$: Presence of an active high-priority emergency vehicle (Ambulance, Fire Engine, Police)
  - $\text{TargetGreenActive}$: Current FSM state matches the corridor required by the emergency vehicle
  - $\text{VehicleCleared}$: Vehicle position has completely crossed the junction exit line ($> 294\text{px}$)
- **Operation**: Extends green signal duration and freezes the state cycle timer at `HOLD`, preventing preemption and clearance cutoff until the emergency vehicle safely exits the junction.
- **Hardware Analogy**: Priority preemption latch with optical/acoustic sensor reset circuit.

---

### Circuit 6: Conflicting Green Invariant Defense Monitor (`INVARIANT_DEFENSE`)
- **Implemented In**: `fsm.js` lines 134-168 (`validateSafety`)
- **Boolean Equation**:
  $$\text{Hazard} = (NS_{Green} \lor NS_{Yellow}) \land (EW_{Green} \lor EW_{Yellow})$$
- **Gate Combination**: $2 \times \text{2-Input OR}$ gates $+ 1 \times \text{2-Input AND}$ gate
- **Inputs**:
  - $NS_{Green}, NS_{Yellow}$: North-South active clearance signals
  - $EW_{Green}, EW_{Yellow}$: East-West active clearance signals
- **Operation**: Combinatorially computes whether both corridors exhibit concurrent active traffic clearance. Under safe operation, $\text{Hazard}$ is strictly $0$ (LOW). If a software fault, hardware short, or corrupted memory ever causes both corridors to activate simultaneously, $\text{Hazard}$ trips to $1$ (HIGH), triggering Circuit 3 (`SAFETY_HALT`).
- **Hardware Analogy**: Conflict Monitor Unit (CMU) / Malfunction Management Unit (MMU) required by NEMA TS-2 traffic signal standards.

---

## 4. Live Controller Mode vs. Learning Mode Architecture

The workbench enforces a strict boundary between production state and educational experimentation:

| Architectural Property | Live Controller Mode (⚡) | Learning Workbench Mode (🔬) |
|---|---|---|
| **Data Source** | Live FSM & kinematic telemetry (`fsm.getSignals()`, `vehicles.lanes`) | Isolated internal state registers (`inputA`, `inputB`) |
| **Circuit Type** | 6 multi-gate controller decision circuits | 7 standard basic logic gates (AND, OR, NOT, NAND, NOR, XOR, XNOR) |
| **Interactive Controls** | Sub-circuit selector tabs (NS, EW, Safety, Entry, Hold, Conflict) | Interactive A/B toggle buttons with immediate recalculation |
| **Simulation Impact** | Read-only observation (Zero mutation) | **Strictly sandboxed** (Cannot modify FSM, lights, or vehicle queues) |
| **Telemetry Sync** | Continuous 60fps evaluation synchronized with traffic animation | Local reactive re-render on user click |
| **Truth Table** | Embedded live inputs/subterms status pills | Complete dynamic truth table with active input row highlighted |

---

## 5. Visual Evidence & Screenshot Audit

All screenshots were captured directly using headless Google Chrome via native Chrome DevTools Protocol (CDP) at specified viewports and saved under `Traffic-Light-Controller/docs/phase-10-evidence/`:

### Screenshot 1: Complete Dashboard with New Logic Workbench Panel
- **File**: [`01-complete-dashboard-with-workbench.png`](./phase-10-evidence/01-complete-dashboard-with-workbench.png)
- **Viewport**: $1920 \times 1180$ Desktop
- **Description**: Displays the complete integrated dashboard layout. The new DPCO Digital Logic Gate Workbench seamlessly occupies the available space in the left column beneath the 4-way intersection without causing layout shifts or overlapping adjacent components.

---

### Screenshot 2: Standard Gate Workbench in Learning Mode
- **File**: [`02-standard-gate-workbench-learning-mode.png`](./phase-10-evidence/02-standard-gate-workbench-learning-mode.png)
- **Viewport**: $1920 \times 1080$ Desktop
- **Description**: Demonstrates Learning Mode with the XOR gate selected ($A=1, B=0 \implies Y=1$). Illustrates animated glowing signal wires, IEEE gate geometry, Boolean equation $Y = A \oplus B$, and isolated input toggles.

---

### Screenshot 3: Live Circuit 1 — North-South Green Authorization
- **File**: [`03-live-ns-green-circuit.png`](./phase-10-evidence/03-live-ns-green-circuit.png)
- **Viewport**: $1920 \times 1080$ Desktop
- **Description**: Illustrates Circuit 1 during live State S0 operation. State bit $S_0=1$, $\text{AllRed}=0$ (inverter output $=1$), and $\text{Fault}=0$ (inverter output $=1$). The 3-input AND gate evaluates to HIGH ($1$), actively driving the North and South green signal lamps.

---

### Screenshot 4: Live Circuit 2 — East-West Green Authorization
- **File**: [`04-live-ew-green-circuit.png`](./phase-10-evidence/04-live-ew-green-circuit.png)
- **Viewport**: $1920 \times 1080$ Desktop
- **Description**: Illustrates Circuit 2 during State S2 (East-West Green). State bit $S_2=1$, driving East-West green output to HIGH ($1$) while North-South authorization is clamped to LOW ($0$).

---

### Screenshot 5: Live Circuit 3 — All-Red Safety Interlock
- **File**: [`05-all-red-safety-circuit.png`](./phase-10-evidence/05-all-red-safety-circuit.png)
- **Viewport**: $1920 \times 1080$ Desktop
- **Description**: Shows the All-Red Safety Interlock circuit when fail-safe halt is activated. The OR gate trips to HIGH ($1$), forcing all signal lamps to RED and halting all inbound traffic safely.

---

### Screenshot 6: Live Circuit 5 — Emergency Priority Hold Interlock
- **File**: [`06-emergency-priority-circuit.png`](./phase-10-evidence/06-emergency-priority-circuit.png)
- **Viewport**: $1920 \times 1080$ Desktop
- **Description**: Shows Circuit 5 with an active dispatched Ambulance. The emergency hold output is HIGH ($1$), freezing countdown progression until the vehicle clears the intersection.

---

### Screenshot 7: Learning Mode Dynamic Truth Table
- **File**: [`07-learning-mode-truth-table.png`](./phase-10-evidence/07-learning-mode-truth-table.png)
- **Viewport**: $1366 \times 768$ Laptop
- **Description**: Close-up inspection of the NAND gate truth table with inputs $A=1, B=1$. The active row ($1, 1 \to 0$) is highlighted with a cyan glow border and pulse effect.

---

### Screenshot 8: Mobile Workbench Responsive Stacked Layout
- **File**: [`08-mobile-workbench-layout.png`](./phase-10-evidence/08-mobile-workbench-layout.png)
- **Viewport**: $390 \times 844$ Mobile (iPhone 14)
- **Description**: Demonstrates flawless mobile responsive stacking. The workbench card stacks neatly beneath the junction canvas with zero horizontal overflow (`clientWidth = scrollWidth = 390px`).

---

## 6. Viewport Responsive Verification Audit

Audited across five standardized device viewports using native browser dimensions:

| Device Viewport | Target Dimensions | Client Width | Scroll Width | Horizontal Overflow | Audit Result |
|---|:---:|:---:|:---:|:---:|:---:|
| **1080p Desktop** | $1920 \times 1080$ | $1905\text{px}$ | $1905\text{px}$ | $0\text{px}$ | **PASS (CLEAN)** |
| **Standard Laptop** | $1366 \times 768$ | $1351\text{px}$ | $1351\text{px}$ | $0\text{px}$ | **PASS (CLEAN)** |
| **Landscape Tablet** | $1024 \times 768$ | $1009\text{px}$ | $1009\text{px}$ | $0\text{px}$ | **PASS (CLEAN)** |
| **Portrait Tablet** | $768 \times 1024$ | $753\text{px}$ | $753\text{px}$ | $0\text{px}$ | **PASS (CLEAN)** |
| **Mobile Phone** | $390 \times 844$ | $390\text{px}$ | $390\text{px}$ | $0\text{px}$ | **PASS (CLEAN)** |

---

## 7. Automated Verification Suite & Formal Proofs

The formal verification suite (`Traffic-Light-Controller/verify.js`) was updated to include 9 dedicated Phase 10 assertions, bringing the total test suite to **81 formal assertions** (all 81 passing with 0 failures):

```
====================================================
 Traffic Light Controller Verification Suite
 Phase 1 to Phase 10 Full Formal Verification & DPCO Logic
====================================================
[PASS] Phase 10: All 7 standard digital logic gates (AND, OR, NOT, NAND, NOR, XOR, XNOR) truth tables mathematically verified - Verified 26 total input/output state vectors across all 7 logic gates
[PASS] Phase 10: Circuit 1 (NS Green Authorization) authorizes GREEN strictly during S0 without All-Red or Fault - S0 Normal: 1, S0+AllRed: 0, S0+Fault: 0, S1: 0
[PASS] Phase 10: Circuit 2 (EW Green Authorization) authorizes GREEN strictly during S2 without All-Red or Fault - S2 Normal: 1, S2+AllRed: 0, S2+Fault: 0, S0: 0
[PASS] Phase 10: Circuit 3 (Safety Interlock) asserts Halt if Operator Triggered OR Invariant Violation detected - Normal: 0, Operator All-Red: 1, Invariant Fault: 1, Dual: 1
[PASS] Phase 10: Circuit 4 (Vehicle Entry Permission) grants entry strictly on Green light with clear conflict box - Green+Clear: 1, Green+Blocked: 0, Red+Clear: 0, Red+Blocked: 0
[PASS] Phase 10: Circuit 5 (Priority Hold Interlock) maintains hold while emergency vehicle approaches and releases on clearance - In Transit: 1, Post-Clearance: 0, Yellow Phase: 0, Idle: 0
[PASS] Phase 10: Circuit 6 (Invariant Defense Monitor) trips Hazard strictly upon dual active or dual green conditions - Safe S0: 0, Safe S1: 0, Dual Green: 1, Dual Active: 1
[PASS] Phase 10: Authoritative telemetry bridge extracts accurate live state and synchronizes circuit evaluations - S0 NS_Green: 1, S2 EW_Green: 1
[PASS] Phase 10: Learning Mode state changes are completely sandboxed and produce zero side-effects on traffic simulation - XOR(1,1)=0, XOR(1,0)=1, Unaltered FSM: S0_NS_GREEN, Unaltered Queue: 1
----------------------------------------------------
Summary: 81/81 assertions passed (0 failed).
====================================================
```

---

## 8. Known Limitations & Academic Scope

1. **Gate Propagation Delays ($t_{pd}$)**:
   In physical TTL/CMOS ICs (e.g., 74LS08 AND gate), signal propagation delay is typically $7\text{--}15\text{ns}$. The simulation models ideal Boolean combinational propagation ($t_{pd} = 0$), evaluating outputs synchronously with the 60fps render loop.
2. **Binary Logic Representation**:
   All signals are modeled as discrete binary values $\{0, 1\}$. Intermediate analog voltage levels (e.g., floating TTL input at $1.4\text{V}$) are not modeled.
3. **Number of Concurrent Visualized Circuits**:
   To prevent visual overcrowding, one primary controller circuit is visualized at a time via the circuit selector tabs, while the backend continuously evaluates all six circuits in parallel.

---

## 9. Conclusion & Demonstration Readiness

Phase 10 successfully bridges theoretical Digital Principles and Computer Organization (DPCO) concepts with real-world Intelligent Transportation Systems (ITS) engineering. By grounding every logic gate diagram in authoritative application state, students and evaluators can directly observe how fundamental Boolean gates govern traffic light sequencing, conflict prevention, vehicle entry authorization, and emergency vehicle safety interlocks.
