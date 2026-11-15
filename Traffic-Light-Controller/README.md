# 4-Way Traffic Light Controller (FSM Simulation)

A software-only, zero-dependency 4-Way Traffic Light Controller simulation implemented with a formal **Finite State Machine (FSM)**.

---

## 1. Project Overview & Architecture

This project simulates a busy four-way intersection (North, South, East, West) controlled by a deterministic 4-state Finite State Machine. The application runs natively in any standard web browser using pure HTML5, CSS3, and vanilla JavaScript without external libraries, packages, or build steps.

### File Structure
All project deliverables are self-contained within `Traffic-Light-Controller/`:

```
Traffic-Light-Controller/
├── index.html        # Main semantic markup, intersection canvas & dashboard UI
├── style.css         # Styling, realistic glowing signal lamps, asphalt road markings
├── fsm.js            # Pure Finite State Machine core, states, transitions & invariant logic
├── app.js            # Application controller: DOM bindings, countdown timer, event loop
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
```

---

## 3. Safety Invariant Proof & Hazard Prevention

### 3.1 Primary Safety Invariant
> **Critical Requirement**: Conflicting directions must **NEVER** receive green simultaneously.

Formally:
$$\neg \Big( \big(\text{Signal}_{\text{North}} = \text{GREEN} \lor \text{Signal}_{\text{South}} = \text{GREEN}\big) \land \big(\text{Signal}_{\text{East}} = \text{GREEN} \lor \text{Signal}_{\text{West}} = \text{GREEN}\big) \Big)$$

In every state $S \in \{S0, S1, S2, S3\}$:
- In $S0$: $\text{NS} = \text{GREEN}$, $\text{EW} = \text{RED}$. Conflicting green is impossible.
- In $S1$: $\text{NS} = \text{YELLOW}$, $\text{EW} = \text{RED}$. Conflicting green is impossible.
- In $S2$: $\text{NS} = \text{RED}$, $\text{EW} = \text{GREEN}$. Conflicting green is impossible.
- In $S3$: $\text{NS} = \text{RED}$, $\text{EW} = \text{YELLOW}$. Conflicting green is impossible.

### 3.2 Clearance Isolation Invariant
An active corridor clearance ($\text{YELLOW}$) never overlaps with opposing movement:
$$\neg \Big( \text{Active}(\text{NS}) \land \text{Active}(\text{EW}) \Big)$$
where $\text{Active}(\text{axis}) = (\text{Signal} = \text{GREEN} \lor \text{Signal} = \text{YELLOW})$.

### 3.3 Continuous Invariant Assertion Engine
The JavaScript runtime executes `validateSafety()` on every timer tick (every 1 second) and before/after every state transition. If an impossible condition or memory corruption occurs, the controller triggers a failsafe halt immediately.

---

## 4. Features & Controls

1. **Four-Way Junction Visualization**:
   - Realistic asphalt roads with curb borders, stop lines, center grid box, and pedestrian zebra crossings.
   - Dedicated 3-lamp signal units (Red, Amber/Yellow, Green) for North, South, East, and West.
   - High-contrast LED glow effects when lit and shaded tint when unlit.
   - Numerical countdown timer overlay on every signal head.
2. **Simulation Controls**:
   - **Start**: Initiates or resumes the automated countdown and state cycle.
   - **Pause**: Halts the timer, retaining current state and countdown time.
   - **Reset**: Safely transitions back to state S0 and resets countdowns to initial values.
   - **Manual Step**: Allows single-stepping through state transitions for inspection and educational demonstrations.
3. **Speed Multiplier**:
   - `1x`: Real-time operation (1 second per tick).
   - `2x`: Accelerated simulation (0.5 seconds per tick).
   - `5x`: Rapid testing mode (0.2 seconds per tick).
4. **State Transition Table & Duration Customizer**:
   - Live row highlighting shows the currently active state.
   - Direct input fields allow adjusting duration (1 to 120 seconds) for each state on the fly.
5. **Interactive Verification Runner**:
   - Click "Run Invariant Tests" in the web UI to run the automated test suite in-browser.
   - View test assertions and safety proofs live.

---

## 5. Verification & Testing

### Running Tests in Node.js (Zero Dependencies)
You can run the standalone verification suite from terminal:
```bash
node Traffic-Light-Controller/verify.js
```

### Verification Assertions Tested:
- **Test 1**: Initial state is strictly $S0$ with North/South GREEN and East/West RED.
- **Test 2**: Cyclic sequence fidelity ($S0 \to S1 \to S2 \to S3 \to S0$) over multiple cycles.
- **Test 3**: Directional light outputs verify exact colors for all 4 approaches.
- **Test 4**: Primary Safety Invariant proof over 200 consecutive transitions (zero conflicting greens).
- **Test 5**: Synthetic fault injection: verifies that invalid synthetic dual-green and dual-clearance states are immediately caught and rejected.
- **Test 6**: Reset restores initial state and clears transition counters.
- **Test 7**: Custom state duration updates correctly apply and respect minimum bounds.

---

## 6. How to Run

1. Open `Traffic-Light-Controller/index.html` directly in any web browser (Chrome, Edge, Firefox, Safari):
   - No server, build step, or installation required.
2. Click **Start** to run the simulation.
3. Click **Pause** or **Reset** to inspect controller behavior.
4. Click **Run Invariant Tests** to execute in-browser verification proofs.
