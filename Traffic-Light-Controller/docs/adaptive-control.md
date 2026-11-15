# Adaptive Intelligent Signal Timing & Explainable AI (XAI)

## 1. Principles of Adaptive Signal Control

Traditional traffic light controllers typically rely on **fixed-time signal plans** parameterized on historical traffic surveys. While predictable, fixed-time plans perform poorly under volatile demand patterns, causing unnecessary waiting at empty approaches while adjacent corridors suffer severe queue spillback.

The **Adaptive Intelligent Signal Controller** implemented in this system transforms the intersection into a dynamic, sensor-responsive closed-loop feedback system:

```
┌────────────────────────────────────────────────────────┐
│                   Simulated Traffic                    │
│           (Vehicle Inflows, Queues, Arrivals)          │
└───────────────────────────┬────────────────────────────┘
                            │ Telemetry Sensing
┌───────────────────────────▼────────────────────────────┐
│               Traffic Demand Modeling                  │
│       Calculates Corridor Demand (D_NS vs D_EW)        │
└───────────────────────────┬────────────────────────────┘
                            │ Quantitative Delta
┌───────────────────────────▼────────────────────────────┐
│             Adaptive Optimization Engine               │
│      • Computes Dynamic Green (5s to 25s)              │
│      • Enforces Anti-Starvation Guarantees             │
│      • Maintains Inviolable 3s Yellow Clearance        │
└───────────────────────────┬────────────────────────────┘
                            │ Allocated Duration & Rationale
┌───────────────────────────▼────────────────────────────┐
│           Finite State Machine & XAI Console           │
│        Executes Cycle Phase & Explains Decision        │
└────────────────────────────────────────────────────────┘
```

---

## 2. Quantitative Traffic Demand Modeling

The controller senses traffic across all four approaches ($N, S, E, W$). For each approach, two distinct vehicle classifications are observed:
1. **Queued Vehicles ($Q$)**: Vehicles stopped behind the stop line ($v = 0, \text{pos} \le 138\text{px}$).
2. **Inbound Approaching Vehicles ($A$)**: Vehicles traveling toward the intersection within the detection zone ($\text{pos} < 138\text{px}, v > 0$).

To anticipate incoming platoon arrivals before they come to a complete stop, the demand function applies a predictive weighting coefficient:

### 2.1 Corridor Demand Formulas

$$D_{\text{NS}} = \big(Q_{\text{North}} + Q_{\text{South}}\big) + 0.4 \times \big(A_{\text{North}} + A_{\text{South}}\big)$$

$$D_{\text{EW}} = \big(Q_{\text{East}} + Q_{\text{West}}\big) + 0.4 \times \big(A_{\text{East}} + A_{\text{West}}\big)$$

Where:
- $Q$ carries a direct weight of $1.0$ (immediate discharge requirement).
- $A$ carries an anticipatory weight of $0.4$ (arrival probability discount).

---

## 3. Dynamic Green Allocation Algorithm

When the FSM approaches a transition into a green state ($S_0$ or $S_2$), the adaptive engine computes the optimal green interval $T_{\text{green}}$ based on the demand differential:

$$\Delta D = D_{\text{active}} - D_{\text{opposing}}$$

### 3.1 Proportional Scaling Formulation

1. **Balanced Conditions** ($|\Delta D| \le 1.0$):
   $$T_{\text{green}} = T_{\text{base}} = 10\text{ s}$$

2. **Surplus Congestion** ($\Delta D > 1.0$):
   $$T_{\text{green}} = \min\Big(T_{\text{max}}, \; T_{\text{base}} + \Delta D \times K_p\Big)$$
   where $K_p = 2.0\text{ s/demand unit}$ and $T_{\text{max}} = 25\text{ s}$.

3. **Deficit / Clear Axis** ($\Delta D < -1.0$):
   $$T_{\text{green}} = \max\Big(T_{\text{min}}, \; T_{\text{base}} - |\Delta D| \times K_d\Big)$$
   where $K_d = 1.0\text{ s/demand unit}$ and $T_{\text{min}} = 5\text{ s}$.

4. **Zero-Backlog Truncation**:
   If an approach has $Q_{\text{active}} = 0$ while the opposing cross street has pending queues ($Q_{\text{opposing}} \ge 2$), the green duration is immediately truncated to the minimum floor:
   $$T_{\text{green}} = T_{\text{min}} = 5\text{ s}$$
   This quickly clears the clearance interval without wasting green time on empty asphalt.

---

## 4. Boundary Guards & Safety Invariants

### 4.1 Strict Boundary Bounds
Under no circumstances may the green duration deviate outside the bounded operational envelope:
$$5\text{ s} \le T_{\text{green}} \le 25\text{ s}$$
- **Lower bound ($5\text{ s}$)**: Prevents dangerous rapid cycling that could trap slow-accelerating or heavy vehicles inside the intersection box.
- **Upper bound ($25\text{ s}$)**: Prevents monopolization of the intersection by an excessively dense stream.

### 4.2 Inviolability of Yellow Clearance
The 3-second yellow clearance interval ($T_{\text{yellow}} = 3\text{ s}$) represents a physical stopping-distance constant derived from kinetic braking parameters:
$$d_{\text{stop}} = \frac{v_0^2}{2a_{\text{brake}}} = \frac{70^2}{2 \times 150} = 16.3\text{ px}$$
Yellow clearance intervals are **never** dynamically scaled, truncated, or skipped, regardless of traffic congestion or preemption requests.

---

## 5. Anti-Starvation Safeguard Mechanism

A classic hazard in greedy adaptive traffic control is **traffic starvation**: if an arterial street experiences relentless continuous traffic, an opportunistic algorithm may indefinitely suppress the minor side street.

To guarantee fairness and bounded wait times, the engine maintains consecutive minimum-duration counters:
$$C_{\text{min}}(\text{corridor})$$

- Whenever a corridor is allocated $T_{\text{min}} = 5\text{ s}$, its counter increments: $C_{\text{min}} \leftarrow C_{\text{min}} + 1$.
- If $C_{\text{min}} \ge 2$ (held at minimum for 2 consecutive cycles) while waiting vehicles exist on that approach, the **Anti-Starvation Invariant** triggers:
  $$T_{\text{green}} \leftarrow 14\text{ s}$$
  $$C_{\text{min}} \leftarrow 0$$
- This overrides the demand deficit and forces an equitable service window to disperse accumulated local vehicles.

---

## 6. Explainable AI (XAI) System

To ensure transparency for traffic operators, civil engineers, and automated monitors, every timing calculation generates an explainability record comprising:
1. Quantitative telemetry snapshot ($D_{\text{active}}$, $D_{\text{opposing}}$, $\Delta D$).
2. Allocated duration in seconds.
3. Natural-language operational rationale.

### Example XAI Rationale Outputs

| Simulation Condition | Generated Rationale String |
|---|---|
| **Heavy North-South Backlog** | *"North-South traffic demand (11.0) exceeds East-West (1.0). Green extended to 25s (+20s) to disperse queue."* |
| **Heavy East-West Backlog** | *"East-West traffic demand (13.0) exceeds North-South (1.0). Green extended to 25s (+24s) to disperse queue."* |
| **Zero Queue Detected** | *"Zero queued vehicles detected on North-South. Green truncated to minimum threshold (5s) to expedite clearance for East-West (7.2 demand)."* |
| **Equally Balanced Demand** | *"Demand is balanced (North-South: 4.0, East-West: 4.0). Standard nominal green duration (10s) assigned."* |
| **Anti-Starvation Triggered** | *"Anti-starvation safeguard triggered for North-South (held at min for consecutive cycles). Duration increased to 14s to guarantee fair throughput."* |
| **Active Green Extension** | *"Active green extended for approaching Ambulance on North approach."* |
