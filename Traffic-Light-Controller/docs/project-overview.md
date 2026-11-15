# Intelligent Traffic Management System — Project Overview

## 1. Executive Summary

The **Traffic Light Controller** is an advanced, software-only **Intelligent Traffic Management System (ITMS)** designed as an open-source academic demonstration of Digital Principles and Computer Organization (DPCO) concepts. The project demonstrates the full lifecycle from theoretical state machine formalization to real-time physical simulation, dynamic sensor-driven adaptive control, emergency preemption, and statistical telemetry.

Built strictly under a zero-dependency architecture, the system operates entirely within client web browsers using standard HTML5, CSS3, and modern vanilla JavaScript (ES6+). It requires no build pipelines, no Node.js runtime, no backend servers, no third-party JavaScript libraries, and no external canvas or charting frameworks.

---

## 2. System Architecture & High-Level Design

The application follows a modular, decoupled architecture organized into distinct single-responsibility layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Interface & View                           │
│  index.html (Semantic Canvas, SVG Telemetry, Control Consoles, HUD)     │
│  style.css  (Intersection Layout, Vehicle Graphics, Glowing LED Heads)  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ DOM Bindings & Events
┌────────────────────────────────────▼───────────────────────────────────┐
│                       Application Orchestrator                         │
│  app.js (Main 60fps Loop, Timing Clocks, User Inputs, UI Updates)      │
└─────────┬───────────────────┬───────────────────┬──────────────────┬───┘
          │                   │                   │                  │
┌─────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
│   Finite State   │ │     Vehicle     │ │    Adaptive     │ │   Real-Time     │
│     Machine      │ │   Simulation    │ │  Timing Engine  │ │   Analytics     │
│     (fsm.js)     │ │  (vehicles.js)  │ │  (adaptive.js)  │ │ (analytics.js)  │
│                  │ │                 │ │                 │ │                 │
│ • State Cycle    │ │ • Kinematics    │ │ • Demand Sensor │ │ • SVG Timeline  │
│ • Invariant Proof│ │ • Queue Spacing │ │ • Green Scaling │ │ • Heatmap Grid  │
│ • Fail-Safe Halt │ │ • Collision Box │ │ • Anti-Starve   │ │ • Efficiency KPI│
│ • Preemption Lock│ │ • Multi-Class   │ │ • XAI Rationale │ │ • Delay Savings │
└──────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
          ▲                   ▲                   ▲                  ▲
          └───────────────────┴─────────┬─────────┴──────────────────┘
                                        │ Formal Invariant Verification
                               ┌────────▼────────┐
                               │   Test Suite    │
                               │   (verify.js)   │
                               │ 50 Assertions   │
                               └─────────────────┘
```

---

## 3. Core Component Directory

All project deliverables reside strictly within the [`Traffic-Light-Controller/`](file:///c:/Users/Abishek/OneDrive/Desktop/dpco-oss/Traffic-Light-Controller) directory:

| Component | Path | Responsibility |
|---|---|---|
| **Entry Point** | [`index.html`](file:///c:/Users/Abishek/OneDrive/Desktop/dpco-oss/Traffic-Light-Controller/index.html) | Semantic UI markup, 4-way intersection geometry, interactive control bars, SVG telemetry containers, and diagnostic log. |
| **Styling & Visuals** | [`style.css`](file:///c:/Users/Abishek/OneDrive/Desktop/dpco-oss/Traffic-Light-Controller/style.css) | Road textures, curb styling, directional lane markers, high-contrast LED signal lamps with glow effects, and CSS vehicle models. |
| **FSM Core** | [`fsm.js`](file:///c:/Users/Abishek/OneDrive/Desktop/dpco-oss/Traffic-Light-Controller/fsm.js) | Formal Finite State Machine engine, cyclic state transitions, strict invariant validation, emergency hold state, and preemption overrides. |
| **Vehicle Engine** | [`vehicles.js`](file:///c:/Users/Abishek/OneDrive/Desktop/dpco-oss/Traffic-Light-Controller/vehicles.js) | Physics and kinematics simulation (acceleration, cruising, braking), queue spacing discipline, collision box occupancy, and multi-class emergency vehicles. |
| **Adaptive Controller**| [`adaptive.js`](file:///c:/Users/Abishek/OneDrive/Desktop/dpco-oss/Traffic-Light-Controller/adaptive.js) | Dynamic traffic demand calculation, queue-responsive green interval scaling ($5\text{s} \le T \le 25\text{s}$), anti-starvation boost, and Explainable AI (XAI) rationale generation. |
| **Analytics Engine** | [`analytics.js`](file:///c:/Users/Abishek/OneDrive/Desktop/dpco-oss/Traffic-Light-Controller/analytics.js) | Time-series queue snapshot tracking, zero-dependency pure SVG sparklines, 4-quadrant congestion heatmap, efficiency scoring, and delay savings accounting. |
| **App Orchestrator** | [`app.js`](file:///c:/Users/Abishek/OneDrive/Desktop/dpco-oss/Traffic-Light-Controller/app.js) | Master animation frame loop, countdown timers, keyboard/mouse event handling, DOM rendering, and subsystem synchronization. |
| **Automated Tests** | [`verify.js`](file:///c:/Users/Abishek/OneDrive/Desktop/dpco-oss/Traffic-Light-Controller/verify.js) | Deterministic formal test suite with 50 automated assertions covering FSM invariants, kinematics, adaptive bounds, preemption protocols, and analytics. |
| **Documentation** | [`docs/`](file:///c:/Users/Abishek/OneDrive/Desktop/dpco-oss/Traffic-Light-Controller/docs) | Exhaustive documentation suite covering FSM design, adaptive algorithms, test reports, and end-user operational manuals. |

---

## 4. Key Engineering Highlights

### 4.1 Strict Mathematical Safety Invariants
Conflicting traffic flows (North-South vs. East-West) are physically and logically segregated. At no point in time can conflicting approaches both display non-red signals. Transition from an active green corridor to another always traverses a compulsory 3-second yellow clearance interval, backed by automated synthetic fault injection tests.

### 4.2 Realistic Microscopic Vehicle Simulation
Approaching vehicles obey Newtonian kinematics (acceleration: $95\text{ px/s}^2$, braking: $150\text{ px/s}^2$, cruise: $70\text{ px/s}$). Approaching cars detect signal states and smoothly decelerate to rest before the $138\text{px}$ stop line. Queued vehicles strictly observe a bumper-to-bumper buffer of at least $38\text{px}$, preventing collisions or overlapping graphics.

### 4.3 Explainable Adaptive Signal Control
Rather than cycling on rigid, blind timers, the controller dynamically calculates orthogonal traffic demand:
$$D = Q + 0.4 \times A$$
Allocating extra green seconds (up to $25\text{s}$) to saturated axes while shrinking empty queues to $5\text{s}$. Every timing adaptation generates a human-interpretable rationale logged directly in the UI.

### 4.4 Life-Safety Emergency Vehicle Preemption
Supports five discrete vehicle classes: Compact Cars, Transit Buses, Ambulances, Fire Engines, and Police Cruisers. When an emergency responder approaches, the system detects its trajectory and triggers preemption:
- If conflicting green is active, safely transition through yellow clearance first—never an abrupt switch.
- Hold opposing traffic at red and open the emergency corridor.
- Release priority and restore normal cycle once the emergency vehicle clears the junction.

### 4.5 Zero-Dependency Pure SVG Telemetry
Advanced ITS telemetry is rendered natively using scalable vector graphics:
- Real-time 25-sample corridor queue sparklines generated dynamically into SVG `<polyline>` paths.
- Four-quadrant approach heatmaps indicating local queue severity.
- Continuous Traffic Efficiency scoring ($15\text{--}99\%$) and cumulative delay-savings tracking.

---

## 5. System Execution

To execute the application:
1. Clone or download the repository:
   ```bash
   git clone https://github.com/abishekaruchamy-oss/dpco-oss.git
   ```
2. Navigate to the project directory:
   ```bash
   cd dpco-oss/Traffic-Light-Controller
   ```
3. Open `index.html` in any modern web browser (Google Chrome, Mozilla Firefox, Microsoft Edge, or Apple Safari).
4. Run the automated headless verification suite:
   ```bash
   node verify.js
   ```
