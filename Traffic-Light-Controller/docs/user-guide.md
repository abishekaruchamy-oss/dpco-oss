# User & Operator Manual

## 1. Getting Started

### 1.1 System Requirements
The Traffic Light Controller requires no installation, compilers, containers, or web servers:
- **Operating System**: Windows, macOS, Linux, ChromeOS, Android, or iOS.
- **Web Browser**: Any modern web browser supporting HTML5, CSS3, and ES6 JavaScript (e.g., Google Chrome 90+, Microsoft Edge 90+, Mozilla Firefox 88+, Apple Safari 14+).
- **Network**: Operates 100% offline without internet access.

### 1.2 Launching the Application
1. Open the project folder:
   ```
   dpco-oss/Traffic-Light-Controller/
   ```
2. Double-click [`index.html`](file:///c:/Users/Abishek/OneDrive/Desktop/dpco-oss/Traffic-Light-Controller/index.html) or right-click and choose **Open with > Google Chrome** (or your preferred browser).
3. The interface will initialize in standby mode, displaying the intersection canvas, HUD status cards, and the control console.

---

## 2. Interface Walkthrough

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TRAFFIC MANAGEMENT HUD                          │
│  [ Current State: S0 ]  [ Mode: ADAPTIVE ]  [ Active Green: 10s ]     │
├──────────────────────────────────┬─────────────────────────────────────┤
│                                  │        SIMULATION CONTROLS          │
│       INTERSECTION CANVAS        │ [▶ Start] [⏸ Pause] [↺ Reset] [⏭ Step]
│                                  │ [🛑 EMERGENCY ALL-RED HALT]         │
│  • North, South, East, West      ├─────────────────────────────────────┤
│    Approaches                    │       SPEED & DENSITY PRESETS       │
│  • High-Contrast LED Signals     │ Speed: [1x] [2x] [5x]               │
│  • Numerical Countdown Displays  │ Density: [Low] [Medium] [High]      │
│  • Animated Vehicles             ├─────────────────────────────────────┤
│  • Stop Lines & Zebra Crossings  │      OPERATING TIMING MODES         │
│                                  │ (•) Adaptive   ( ) Fixed   ( ) Manual
├──────────────────────────────────┴─────────────────────────────────────┤
│                     EMERGENCY DISPATCH TOOLBAR                         │
│  Vehicle: [Ambulance ▼]   Approach: [North ▼]   [🚨 DISPATCH EMERGENCY]│
├────────────────────────────────────────────────────────────────────────┤
│                     ADVANCED ITS ANALYTICS & HUD                       │
│  • Efficiency Score: 92%            • Cumulative Delay Saved: 14.8s    │
│  • Average Wait Time: 4.2s          • Throughput: 28.4 veh/min         │
│  • Pure SVG Corridor Sparkline      • 4-Quadrant Congestion Heatmap    │
│  • Live Diagnostic Log              • In-Browser Verification Runner   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Operational Controls

### 3.1 Simulation Execution Controls
- **▶ Start / Resume**: Starts the countdown clock and vehicle generation. If paused, resumes the simulation seamlessly from its current state.
- **⏸ Pause**: Freezes the simulation clock and locks all moving vehicles in place. Use this to inspect traffic queues, signal timings, or emergency vehicles.
- **↺ Reset**: Restores the FSM to initial state $S_0$ (North-South Green), clears all vehicles from the roadway, flushes queue counters, and resets analytics.
- **⏭ Step**: Manually advances the state machine by exactly one phase transition ($S_0 \to S_1 \to S_2 \to S_3 \to S_0$). Automatically pauses the countdown clock.
- **🛑 Emergency All-Red Halt**: Immediate fail-safe emergency override. Forces all four signal heads to glowing **RED**. Approaching vehicles immediately decelerate to a stop before the stop lines. Clicking **Resume** safely re-engages standard cyclic operation from state $S_0$.

### 3.2 Simulation Speed Multipliers
Adjust simulation time scaling to observe long-term queuing trends or rapidly test transitions:
- **1x (Real-Time)**: Standard real-time operation ($1\text{ s} = 1\text{ second}$).
- **2x (Accelerated)**: Double speed, ideal for observing adaptive queue adjustments.
- **5x (Rapid Testing)**: High-speed stress testing, ideal for queue buildup and throughput benchmarks.

### 3.3 Traffic Density Presets
Dynamically adjusts the stochastic arrival rate of approaching vehicles:
- **Low Traffic**: Light flow ($\sim 4.5\text{s}$ spawn interval). Clean approaches with minimal queue buildup.
- **Medium Traffic**: Balanced commuter flow ($\sim 2.8\text{s}$ spawn interval). Regular queues form during red intervals and disperse during green phases.
- **High Traffic**: Heavy peak-hour congestion ($\sim 1.4\text{s}$ spawn interval). High vehicle density requiring aggressive adaptive green allocation.

---

## 4. Operating Timing Modes

Toggle between three timing modes via the radio selector in the control panel:

### 4.1 Adaptive Mode (Recommended)
- Real-time intelligent signal timing driven by queue length and arrival telemetry.
- Allocates between $5\text{s}$ and $25\text{s}$ of green time per cycle based on corridor demand.
- Includes automatic anti-starvation protection to guarantee service to minor cross-streets.
- Displays an **Explainable AI (XAI)** rationale explaining the reasoning behind every duration decision.

### 4.2 Fixed Timing Mode
- Cycles on rigid, deterministic intervals:
  - North-South Green: $10\text{ s}$
  - North-South Yellow: $3\text{ s}$
  - East-West Green: $10\text{ s}$
  - East-West Yellow: $3\text{ s}$
- Useful as an academic baseline to compare against adaptive efficiency and delay savings.

### 4.3 Manual Timing Mode
- Unlocks direct operator configuration of green durations for both corridors.
- Allows testing arbitrary custom intervals within safety boundaries.

---

## 5. Emergency Vehicle Dispatch & Priority Preemption

### 5.1 Dispatching Emergency Responders
1. In the **Emergency Dispatch** section, select a vehicle type from the dropdown:
   - **Ambulance**: Medical first responder chassis with flashing blue emergency strobes.
   - **Fire Engine**: Heavy red rescue vehicle with beacon illumination.
   - **Police Cruiser**: High-speed patrol interceptor with red/blue alternating lightbars.
2. Select the approach direction (**North**, **South**, **East**, or **West**).
3. Click **🚨 Dispatch Emergency Vehicle**.

### 5.2 Preemption Behavior to Observe
- If the emergency vehicle's direction already has a **GREEN** signal, the controller activates **Active Green Extension**, holding the green light open until the responder crosses the junction.
- If the emergency vehicle's direction has a **RED** signal, the controller initiates safe clearance:
  1. The opposing green corridor immediately transitions to **YELLOW** ($3\text{s}$ clearance).
  2. Crossing vehicles clear the central conflict box.
  3. The emergency corridor turns **GREEN**.
  4. Opposing directions remain locked at **RED**.
- Once the emergency vehicle exits the junction boundary ($294\text{px}$), the priority lock automatically disengages, and standard cyclic or adaptive operation resumes.

---

## 6. Advanced Analytics & Dashboard Interpretation

### 6.1 Real-Time Corridor Queue Sparklines
- Located in the analytics card, this zero-dependency SVG sparkline renders the 25 most recent queue samples:
  - **Blue Line**: North-South combined corridor queue ($Q_N + Q_S$).
  - **Pink Line**: East-West combined corridor queue ($Q_E + Q_W$).
- Use the timeline to observe how adaptive signal timing dampens queue spikes compared to fixed-time operations.

### 6.2 4-Quadrant Congestion Heatmap
- Provides instant visual status across all four approaches:
  - **CLEAR** (Cyan / Blue): $0\text{--}1$ queued vehicles.
  - **MODERATE** (Amber / Yellow): $2\text{--}3$ queued vehicles.
  - **HEAVY** (Crimson / Red): $4+$ queued vehicles.

### 6.3 Traffic Efficiency Score & Delay Saved
- **Traffic Efficiency Score ($15\text{--}99\%$)**: Higher scores indicate free-flowing conditions; lower scores reflect sustained congestion.
- **Delay Saved (veh-seconds)**: Measures cumulative driver delay eliminated by adaptive signal green allocation versus a rigid fixed-time plan.

---

## 7. In-Browser Verification Runner

You can verify the mathematical safety of the simulation at any time directly in your browser:
1. Scroll to the **Diagnostics & Invariant Verification** section.
2. Click **Run Invariant Tests**.
3. The test harness executes all 50 formal verification checks in real-time, verifying FSM transitions, safety invariants, kinematics, adaptive bounds, and preemption safety.
4. Review the real-time test badge list in the audit panel to confirm **100% Passing Status**.
