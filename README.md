# dpco-oss

Open-source digital principles and computer organization academic mini-projects repository.

---

## Projects Directory

### 🚦 [Traffic Light Controller — Intelligent Traffic Management System](./Traffic-Light-Controller)

An advanced, browser-native **Intelligent Traffic Management System (ITMS)** built under a zero-dependency architecture with pure HTML5, CSS3, and vanilla JavaScript:

- **Formal Finite State Machine (FSM)**: Cyclic 4-state coordination ($S_0 \to S_1 \to S_2 \to S_3 \to S_0$) with mathematical safety invariants preventing conflicting green signals.
- **Microscopic Vehicle Simulation**: 4-way approach trajectories, Newtonian kinematics (acceleration, cruise, braking), collision-free queue discipline ($\ge 38\text{px}$ bumper gap), and density presets (Low, Medium, High).
- **Adaptive Intelligent Signal Timing**: Dynamic corridor demand sensing ($D_{NS}, D_{EW}$), queue-responsive green interval scaling ($5\text{s} \le T \le 25\text{s}$), anti-starvation fair throughput guarantees, and Explainable AI (XAI) decision rationales.
- **Emergency Vehicle Priority Preemption**: High-priority dispatching for Ambulances, Fire Engines, and Police Cruisers with safe yellow clearance transitions, active green extension, and automatic priority release.
- **Advanced ITS Analytics & Pure SVG Telemetry**: Real-time rolling queue sparklines rendered via pure SVG, 4-quadrant approach congestion heatmap, continuous Traffic Efficiency Scoring ($15\text{--}99\%$), and adaptive delay savings accounting.
- **DPCO Digital Logic Gate Workbench**: Live and Learning Mode digital logic demonstration panel grounded in production controller state, standard 7-gate explorer (AND, OR, NOT, NAND, NOR, XOR, XNOR), 6 authentic Boolean controller circuits, dynamic truth tables, and animated signal flow wires.
- **Phase 10.1 Telemetry & Clearance Integration**: Authoritative multi-class emergency vehicle detection (`AMBULANCE`, `FIRE_ENGINE`, `POLICE`), conflict zone transit green hold ($156\text{px}\text{--}294\text{px}$), Vehicle Entry approach corridor alignment ($S_0$ North, $S_2$ East), and strictly read-only telemetry extraction.
- **Formal Verification Suite**: 96 automated deterministic assertions covering all phases, DPCO circuits, emergency preemption holds, and operational scenarios, executable via Node.js CLI (`node verify.js`) or interactively inside the web browser with 100% pass rate.

---

### **Project Technical Report**

📄 **Download Full Formal Word Report**: [`Traffic-Light-Controller/docs/ITMS_Traffic_Light_Controller_Project_Report.docx`](./Traffic-Light-Controller/docs/ITMS_Traffic_Light_Controller_Project_Report.docx)  
An exhaustive, publication-grade academic project report in Microsoft Word format covering mathematical FSM proofs, microscopic Newtonian kinematics, adaptive queue-responsive algorithms, emergency preemption, DPCO Boolean circuit logic, empirical stress test results, and operator guides.

---

#### Technical Documentation
- 📘 [Project Overview & Architecture](./Traffic-Light-Controller/docs/project-overview.md)
- ⚙️ [Finite State Machine Specification & Invariant Proofs](./Traffic-Light-Controller/docs/fsm-design.md)
- 🧠 [Adaptive Intelligent Signal Timing & XAI](./Traffic-Light-Controller/docs/adaptive-control.md)
- 🧪 [Verification & Testing Audit](./Traffic-Light-Controller/docs/testing-report.md)
- 📖 [User & Operator Manual](./Traffic-Light-Controller/docs/user-guide.md)
- 🛡️ [Final Independent Audit & QA Report](./Traffic-Light-Controller/docs/final-audit-report.md)
- 🔍 [Phase 7 Defect Investigation & Root Cause Report](./Traffic-Light-Controller/docs/phase-7-investigation.md)
- 🛠️ [Phase 7 Simulation Reliability & Remediation Report](./Traffic-Light-Controller/docs/phase-7-remediation-report.md)
- 🎨 [Phase 8 Visual Audit & UX Defect Analysis](./Traffic-Light-Controller/docs/phase-8-visual-audit.md)
- 🚀 [Phase 8 Complete Visual UI Audit & Remediation Report](./Traffic-Light-Controller/docs/phase-8-remediation-report.md)
- 🏆 [Phase 9 Independent End-to-End Acceptance Report](./Traffic-Light-Controller/docs/phase-9-acceptance-report.md)
- ⚡ [Phase 10 DPCO Digital Logic Gate Workbench Manual](./Traffic-Light-Controller/docs/phase-10-logic-gate-workbench.md)
- 🔬 [Phase 10.1 Logic Telemetry Accuracy & Clearance Fix Report](./Traffic-Light-Controller/docs/phase-10-1-correction-report.md)
- 📋 [Comprehensive Final Audit Report](./Traffic-Light-Controller/docs/final-comprehensive-audit-report.md)
- 📊 [Final Test Results & Verification Matrix](./Traffic-Light-Controller/docs/final-test-results.md)
- 🤝 [Final Project Handover & Demonstration Guide](./Traffic-Light-Controller/docs/final-project-handover.md)

#### Quick Start & Verification
1. **Launch in Browser**: Open [`Traffic-Light-Controller/index.html`](./Traffic-Light-Controller/index.html) directly in any modern web browser.
2. **Execute Automated Verification Suite**:
   ```bash
   node Traffic-Light-Controller/verify.js
   ```
   *(96/96 assertions passing with 100% success rate)*
