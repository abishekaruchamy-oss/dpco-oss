# 4-Way Traffic Light Controller (FSM Simulation)

A software-only, zero-dependency 4-Way Traffic Light Controller simulation implemented with a formal **Finite State Machine (FSM)** and physical vehicle queuing dynamics.

---

## 1. Project Overview & Architecture

This project simulates a busy four-way intersection (North, South, East, West) controlled by a deterministic Finite State Machine with physical vehicle simulation, traffic density presets, and real-time Intelligent Transportation Systems (ITS) analytics. The application runs natively in any standard web browser using pure HTML5, CSS3, and vanilla JavaScript without external libraries, packages, or build steps.

### File Structure
All project deliverables are self-contained within `Traffic-Light-Controller/`:

```
Traffic-Light-Controller/
├── index.html        # Main semantic markup, intersection canvas, controls & analytics dashboard
├── style.css         # Styling, realistic glowing signal lamps, vehicles, and KPI grid
├── fsm.js            # Pure Finite State Machine core, states, transitions & invariant logic
├── vehicles.js       # Vehicle physics, queue discipline, traffic density & analytics engine
├── app.js            # Application controller: DOM bindings, countdown loop & 60fps render
├── verify.js         # Automated verification suite (runs in CLI and in-browser)
└── README.md         # Architecture, FSM documentation, and verification proofs
```

---

## 2. Finite State Machine (FSM) Specification

The intersection coordinates traffic across two orthogonal axes:
- **Axis 1 (NS)**: North-South Corridor
- **Axis 2 (EW)**: East-West Corridor

### 2.1 State Definitions

| State Code | Identifier | North & South Lights | East & West Lights | Default Duration | Next State | Phase Purpose |
|---|---|---|---|---|---|---|
| **S0** | `S0_NS_GREEN` | <span style="color:#10b981;font-weight:bold;">GREEN</span> | <span style="color:#ef4444;font-weight:bold;">RED</span> | 10 seconds | `S1_NS_YELLOW` | High-throughput North-South traffic movement |
| **S1** | `S1_NS_YELLOW` | <span style="color:#f59e0b;font-weight:bold;">YELLOW</span> | <span style="color:#ef4444;font-weight:bold;">RED</span> | 3 seconds | `S2_EW_GREEN` | Clearance interval for North-South vehicles |
| **S2** | `S2_EW_GREEN` | <span style="color:#ef4444;font-weight:bold;">RED</span> | <span style="color:#10b981;font-weight:bold;">GREEN</span> | 10 seconds | `S3_EW_YELLOW` | High-throughput East-West traffic movement |
| **S3** | `S3_EW_YELLOW` | <span style="color:#ef4444;font-weight:bold;">RED</span> | <span style="color:#f59e0b;font-weight:bold;">YELLOW</span> | 3 seconds | `S0_NS_GREEN` | Clearance interval for East-West vehicles |
| **FAIL-SAFE** | `EMERGENCY_ALL_RED` | <span style="color:#ef4444;font-weight:bold;">RED</span> | <span style="color:#ef4444;font-weight:bold;">RED</span> | Hold | `S0_NS_GREEN` | All-stop safety state: all vehicles halt safely at stop lines |

### 2.2 State Transition Diagram

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

## 3. Vehicle Simulation, Physics & Queuing

### 3.1 Kinematics & Approach Trajectories
- Vehicles approach the 4-way intersection from all 4 approaches (North, South, East, West).
- Velocity and deceleration parameters:
  - Max Cruising Speed: $70\text{ px/s}$
  - Acceleration: $95\text{ px/s}^2$
  - Braking Deceleration: $150\text{ px/s}^2$
- Each vehicle is represented by a 14×26px CSS vehicle model featuring windshield, roof styling, and rear brake lights.

### 3.2 Stopping & Queuing Discipline
- **Stop Line Invariant**: When a signal is **RED** or **YELLOW**, approaching vehicles that have not yet crossed the stop line (`pos = 138px`) decelerate smoothly and halt before the stop line (`pos <= 138px`).
- **Safe Following Separation**: Following vehicles in a queue maintain a strict minimum bumper-to-bumper distance of at least $38\text{px}$ (`CAR_LENGTH + MIN_GAP`), preventing overlaps.
- **Intersection Clearance Lock**: When a signal turns GREEN, oncoming vehicles verify that the orthogonal conflict box is empty before entering the junction. If a clearance vehicle is still finishing its transit, oncoming traffic waits before crossing.

### 3.3 Traffic Density Presets
Three density modes are selectable in real-time:
1. **Low Traffic**: Average spawn interval $\sim 4.5\text{s}$, light arrivals ($0\text{--}2$ cars in queue).
2. **Medium Traffic**: Average spawn interval $\sim 2.8\text{s}$, steady commuter stream ($2\text{--}4$ cars in queue).
3. **High Traffic**: Average spawn interval $\sim 1.4\text{s}$, heavy peak-hour congestion ($4\text{--}8$ cars in queue).

---

## 4. Traffic Analytics & ITS KPIs

The simulation calculates and displays real-time performance indicators:
- **Total Vehicles Generated**: Cumulative count of vehicles spawned across all four approaches.
- **Vehicles Passed**: Cumulative count of vehicles that safely navigated and exited the intersection.
- **Current Queue Lengths**: Discrete queue counters for **North**, **South**, **East**, and **West**, with visual badges highlighting active congestion.
- **Average Waiting Time**: Running mean of seconds spent waiting in queue before crossing the stop line:
  $$\text{AvgWaitTime} = \frac{\sum \text{VehicleWaitDuration}}{\text{Count}}$$
- **Throughput Rate**: Real-time traffic throughput normalized to vehicles per minute:
  $$\text{Throughput} = \frac{\text{VehiclesPassed}}{\text{SimulationTimeSeconds}} \times 60$$

---

## 5. Safety Invariant Proof & Fail-Safe Design

### 5.1 Primary Safety Invariant
> **Critical Requirement**: Conflicting directions must **NEVER** receive green simultaneously.

Formally:
$$\neg \Big( \big(\text{Signal}_{\text{North}} = \text{GREEN} \lor \text{Signal}_{\text{South}} = \text{GREEN}\big) \land \big(\text{Signal}_{\text{East}} = \text{GREEN} \lor \text{Signal}_{\text{West}} = \text{GREEN}\big) \Big)$$

In every state $S \in \{S0, S1, S2, S3\}$:
- In $S0$: $\text{NS} = \text{GREEN}$, $\text{EW} = \text{RED}$. Conflicting green is impossible.
- In $S1$: $\text{NS} = \text{YELLOW}$, $\text{EW} = \text{RED}$. Conflicting green is impossible.
- In $S2$: $\text{NS} = \text{RED}$, $\text{EW} = \text{GREEN}$. Conflicting green is impossible.
- In $S3$: $\text{NS} = \text{RED}$, $\text{EW} = \text{YELLOW}$. Conflicting green is impossible.

### 5.2 Clearance Isolation Invariant
An active corridor clearance ($\text{YELLOW}$) never overlaps with opposing movement:
$$\neg \Big( \text{Active}(\text{NS}) \land \text{Active}(\text{EW}) \Big)$$
where $\text{Active}(\text{axis}) = (\text{Signal} = \text{GREEN} \lor \text{Signal} = \text{YELLOW})$.

### 5.3 Fail-Safe All-Red Halt
An operator can trigger the **All-Red Halt** button at any time. When triggered or in the event of an anomaly:
- All 4 traffic signals switch immediately to **RED**.
- Approaching vehicles immediately halt behind stop lines.
- Vehicles already in transit safely clear the junction box.
- Normal operation can be restored with a single click, safely returning to state $S0$.

---

## 6. Features & Controls

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
   - Click "Run Invariant Tests" in the web UI to run the 23-assertion test suite in-browser.

---

## 7. Verification & Automated Testing

### Running Tests in Node.js (Zero Dependencies)
You can run the full verification suite directly from the terminal:
```bash
node Traffic-Light-Controller/verify.js
```

### Verification Assertions Tested (23/23 Passing):
- **Test 1**: Initial state is strictly $S0$ with North/South GREEN and East/West RED.
- **Test 2**: Cyclic sequence fidelity ($S0 \to S1 \to S2 \to S3 \to S0$) over multiple cycles.
- **Test 3**: Directional light outputs verify exact colors for all 4 approaches.
- **Test 4**: Primary Safety Invariant proof over 200 consecutive transitions (zero conflicting greens).
- **Test 5**: Synthetic fault injection: verifies that illegal dual-green and dual-clearance states are caught.
- **Test 6**: Reset restores initial state $S0$ and clears transition counters.
- **Test 7**: Custom state duration updates correctly apply and respect minimum bounds.
- **Test 8**: Fail-Safe All-Red Halt forces all signals to RED and recovers safely.
- **Test 9**: Vehicle movement and kinematics accelerate and traverse intersection under green signal.
- **Test 10**: Red-light stopping invariant: vehicle halts completely at stop line on RED.
- **Test 11**: Queue discipline & anti-collision: zero vehicle overlap in queues ($38\text{px}$ minimum spacing).
- **Test 12**: Conflicting direction vehicle prevention: 0 simultaneous collision box occupancy.
- **Test 13**: Traffic density presets: Low, Medium, High spawn scaling verified.
- **Test 14**: Analytics mathematical consistency and conservation laws.

---

## 8. How to Run

1. Open `Traffic-Light-Controller/index.html` directly in any modern web browser (Chrome, Edge, Firefox, Safari).
2. Click **Start** to run the simulation.
3. Switch **Density** (Low / Medium / High) to observe queuing dynamics.
4. Test the **All-Red Halt** button to observe fail-safe stopping.
5. Click **Run Invariant Tests** to execute in-browser verification proofs.
