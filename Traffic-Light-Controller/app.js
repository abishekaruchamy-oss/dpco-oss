/**
 * Traffic Light Controller - Application Controller
 * Coordinates UI, DOM updates, countdown timer, FSM transitions,
 * real-time safety invariant assertions, vehicle physics & analytics.
 */

(function () {
  'use strict';

  // Simulation status constants
  const SIM_STATUS = {
    STOPPED: 'STOPPED',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED'
  };

  // State instances
  let fsm = null;
  let vehicleManager = null;
  let adaptiveController = null;
  let analyticsEngine = null;
  let simStatus = SIM_STATUS.STOPPED;
  let timerInterval = null;
  let remainingSeconds = 10;
  let elapsedSeconds = 0;
  let speedMultiplier = 1;
  let verifiedTransitionCount = 0;
  let violationCount = 0;
  let lastAnimTime = performance.now();
  let wasRunningBeforeHalt = false;
  let lastChartUpdate = 0;

  // DOM Elements cache
  const elements = {
    // Buttons & Controls
    btnStart: document.getElementById('btnStart'),
    btnPause: document.getElementById('btnPause'),
    btnReset: document.getElementById('btnReset'),
    btnStep: document.getElementById('btnStep'),
    btnAllRed: document.getElementById('btnAllRed'),
    speedSelect: document.getElementById('speedSelect'),
    densitySelect: document.getElementById('densitySelect'),
    densityBadge: document.getElementById('densityBadge'),
    modeSelect: document.getElementById('modeSelect'),
    adaptiveModeBadge: document.getElementById('adaptiveModeBadge'),
    valDemandNS: document.getElementById('valDemandNS'),
    valDemandEW: document.getElementById('valDemandEW'),
    demandFillNS: document.getElementById('demandFillNS'),
    demandFillEW: document.getElementById('demandFillEW'),
    adaptiveRationaleText: document.getElementById('adaptiveRationaleText'),
    adaptiveCalculatedDuration: document.getElementById('adaptiveCalculatedDuration'),
    emergencyDirSelect: document.getElementById('emergencyDirSelect'),
    btnDispatchAmb: document.getElementById('btnDispatchAmb'),
    btnDispatchFire: document.getElementById('btnDispatchFire'),
    btnDispatchPolice: document.getElementById('btnDispatchPolice'),
    emergencyBanner: document.getElementById('emergencyBanner'),
    emergencyBannerText: document.getElementById('emergencyBannerText'),
    emergencyBannerPhase: document.getElementById('emergencyBannerPhase'),
    statEmergencyCount: document.getElementById('statEmergencyCount'),
    btnRunVerification: document.getElementById('btnRunVerification'),
    btnClearLog: document.getElementById('btnClearLog'),

    // Badges & Labels
    badgeStatus: document.getElementById('badgeStatus'),
    badgeInvariant: document.getElementById('badgeInvariant'),
    activeAxisLabel: document.getElementById('activeAxisLabel'),

    // Vehicles Layer
    vehiclesLayer: document.getElementById('vehiclesLayer'),

    // Analytics KPIs
    statTotalGenerated: document.getElementById('statTotalGenerated'),
    statTotalPassed: document.getElementById('statTotalPassed'),
    statAvgWaitTime: document.getElementById('statAvgWaitTime'),
    statThroughput: document.getElementById('statThroughput'),
    statEfficiencyScore: document.getElementById('statEfficiencyScore'),
    statDelaySaved: document.getElementById('statDelaySaved'),
    chartQueueHistory: document.getElementById('chartQueueHistory'),
    heatCells: {
      north: document.getElementById('heatNorth'),
      south: document.getElementById('heatSouth'),
      east: document.getElementById('heatEast'),
      west: document.getElementById('heatWest')
    },
    heatStatuses: {
      north: document.getElementById('heatStatusNorth'),
      south: document.getElementById('heatStatusSouth'),
      east: document.getElementById('heatStatusEast'),
      west: document.getElementById('heatStatusWest')
    },
    queueN: document.getElementById('queueN'),
    queueS: document.getElementById('queueS'),
    queueE: document.getElementById('queueE'),
    queueW: document.getElementById('queueW'),
    queueCards: {
      north: document.getElementById('queueCardN'),
      south: document.getElementById('queueCardS'),
      east: document.getElementById('queueCardE'),
      west: document.getElementById('queueCardW')
    },

    // Signals & Timers
    timers: {
      north: document.getElementById('timerNorth'),
      south: document.getElementById('timerSouth'),
      east: document.getElementById('timerEast'),
      west: document.getElementById('timerWest')
    },
    lamps: {
      north: {
        red: document.getElementById('lampNorthRed'),
        yellow: document.getElementById('lampNorthYellow'),
        green: document.getElementById('lampNorthGreen')
      },
      south: {
        red: document.getElementById('lampSouthRed'),
        yellow: document.getElementById('lampSouthYellow'),
        green: document.getElementById('lampSouthGreen')
      },
      east: {
        red: document.getElementById('lampEastRed'),
        yellow: document.getElementById('lampEastYellow'),
        green: document.getElementById('lampEastGreen')
      },
      west: {
        red: document.getElementById('lampWestRed'),
        yellow: document.getElementById('lampWestYellow'),
        green: document.getElementById('lampWestGreen')
      }
    },
    flowNS: document.getElementById('flowNS'),
    flowEW: document.getElementById('flowEW'),

    // State Inspection Card
    stateTitle: document.getElementById('stateTitle'),
    stateIdBadge: document.getElementById('stateIdBadge'),
    stateDesc: document.getElementById('stateDesc'),
    countdownSeconds: document.getElementById('countdownSeconds'),
    elapsedSeconds: document.getElementById('elapsedSeconds'),
    progressBarFill: document.getElementById('progressBarFill'),

    // Safety Proof Card
    safetyCard: document.getElementById('safetyCard'),
    safetyStatusLabel: document.getElementById('safetyStatusLabel'),
    safetyEquation: document.getElementById('safetyEquation'),
    safetyMetrics: document.getElementById('safetyMetrics'),

    // State Table
    stateTableBody: document.getElementById('stateTableBody'),

    // Verification Drawer
    verificationList: document.getElementById('verificationList'),
    testSummaryBadge: document.getElementById('testSummaryBadge'),

    // Log
    eventLog: document.getElementById('eventLog')
  };

  /**
   * Handle Inbound Emergency Priority Request
   */
  function handleEmergencyRequest(direction, vehicle) {
    const decision = fsm.requestEmergencyPriority(direction);
    const typeName = vehicle.type.replace('_', ' ');

    if (elements.emergencyBanner) {
      elements.emergencyBanner.style.display = 'flex';
      elements.emergencyBannerText.textContent = `${typeName} from ${direction.toUpperCase()}`;
      elements.emergencyBannerPhase.textContent = decision.status === 'ACTIVE_GREEN_EXTENDED'
        ? 'Priority Green Active (Holding for Transit)'
        : 'Securing Yellow Clearance...';
    }

    logEvent(`🚨 EMERGENCY PREEMPTION: ${typeName} dispatched on ${direction.toUpperCase()} approach. Decision: ${decision.status}`);

    if (decision.action === 'CLEAR_CONFLICT') {
      // Conflicting corridor has green: immediately accelerate to yellow clearance (never skip yellow!)
      if (remainingSeconds > 3) {
        remainingSeconds = 3;
      }
    } else if (decision.action === 'HOLD') {
      remainingSeconds = Math.max(remainingSeconds, 10);
    }

    updateUI();
  }

  /**
   * Handle Emergency Priority Cleared (Vehicle exited intersection)
   */
  function handleEmergencyCleared(direction, vehicle) {
    fsm.clearEmergencyPriority();

    if (analyticsEngine && vehicleManager) {
      const ev = vehicleManager.emergencyEvents.find((e) => e.id === vehicle.id);
      if (ev) {
        const durationSec = Math.max(1, (Date.now() - ev.timestamp) / 1000);
        analyticsEngine.recordEmergencyClearance(durationSec);
      }
    }

    if (elements.emergencyBanner) {
      elements.emergencyBanner.style.display = 'none';
    }

    logEvent(`✅ PRIORITY CLEARED: ${vehicle.type.replace('_', ' ')} safely exited intersection. Normal timing restored.`);
    updateUI();
  }

  /**
   * Initialize Application
   */
  function init() {
    fsm = new window.TrafficFSM();

    if (window.AdaptiveController) {
      adaptiveController = new window.AdaptiveController();
    }

    if (window.TrafficAnalyticsEngine) {
      analyticsEngine = new window.TrafficAnalyticsEngine();
    }

    if (window.VehicleManager) {
      vehicleManager = new window.VehicleManager({
        containerElement: elements.vehiclesLayer,
        densityMode: elements.densitySelect ? elements.densitySelect.value : 'MEDIUM',
        onEmergencyRequest: handleEmergencyRequest,
        onEmergencyCleared: handleEmergencyCleared
      });
    }

    const meta = fsm.getCurrentStateMetadata();
    remainingSeconds = meta.duration;
    elapsedSeconds = 0;

    renderStateTable();
    updateUI();
    attachEventListeners();
    logEvent('Controller initialized. Initial state: ' + meta.code + ' (' + meta.title + ')');

    // Run initial verification to assert startup health
    runAutomatedVerification(false);

    // Start 60fps vehicle animation loop
    lastAnimTime = performance.now();
    requestAnimationFrame(animationLoop);

    // Check URL parameters for automated visual audit & headless testing
    try {
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('density')) {
          const d = urlParams.get('density').toUpperCase();
          if (vehicleManager && ['LOW', 'MEDIUM', 'HIGH'].includes(d)) {
            vehicleManager.setDensityMode(d);
            if (elements.densitySelect) elements.densitySelect.value = d;
          }
        }
        if (urlParams.get('mode')) {
          const m = urlParams.get('mode').toUpperCase();
          if (adaptiveController && ['ADAPTIVE', 'FIXED', 'MANUAL'].includes(m)) {
            adaptiveController.setMode(m);
            if (elements.modeSelect) elements.modeSelect.value = m;
            updateAdaptiveUI();
          }
        }
        if (urlParams.get('speed')) {
          const s = parseFloat(urlParams.get('speed'));
          if (!isNaN(s) && s > 0) {
            speedMultiplier = s;
            if (elements.speedSelect) elements.speedSelect.value = String(s);
          }
        }
        if (urlParams.get('autostart') === 'true') {
          startSimulation();
        }
        if (urlParams.get('ambulance')) {
          setTimeout(() => {
            if (vehicleManager) {
              vehicleManager.spawnEmergencyVehicle(urlParams.get('ambulance'), 'AMBULANCE');
            }
          }, 400);
        }
        if (urlParams.get('ambulance_cleared')) {
          setTimeout(() => {
            if (vehicleManager) {
              const veh = vehicleManager.spawnEmergencyVehicle('north', 'AMBULANCE');
              if (veh) {
                veh.pos = 320;
                veh.hasClearedIntersection = true;
                handleEmergencyCleared('north', veh);
              }
            }
          }, 400);
        }
        if (urlParams.get('dispatch')) {
          const vType = urlParams.get('dispatch').toUpperCase();
          const dDir = (urlParams.get('dir') || 'north').toLowerCase();
          setTimeout(() => {
            if (vehicleManager && ['AMBULANCE', 'FIRE_ENGINE', 'POLICE'].includes(vType)) {
              vehicleManager.spawnEmergencyVehicle(dDir, vType);
            }
          }, 400);
        }
        if (urlParams.get('allred') === 'true') {
          setTimeout(() => {
            toggleAllRedHalt();
          }, 400);
        }
        if (urlParams.get('verify') === 'true') {
          setTimeout(() => {
            runAutomatedVerification(true);
          }, 300);
        }
      }
    } catch (e) {
      // Fallback
    }

    // Expose application instance for E2E acceptance testing and inspection
    window.TrafficApp = {
      get fsm() { return fsm; },
      get vehicleManager() { return vehicleManager; },
      get adaptiveController() { return adaptiveController; },
      get analyticsEngine() { return analyticsEngine; },
      get simStatus() { return simStatus; },
      get remainingSeconds() { return remainingSeconds; },
      get elapsedSeconds() { return elapsedSeconds; },
      get speedMultiplier() { return speedMultiplier; },
      setSpeedMultiplier(s) {
        speedMultiplier = parseFloat(s) || 1;
        if (elements.speedSelect) elements.speedSelect.value = String(speedMultiplier);
        if (simStatus === SIM_STATUS.RUNNING) {
          clearInterval(timerInterval);
          timerInterval = setInterval(tick, Math.round(1000 / speedMultiplier));
        }
      },
      setDensity(mode) {
        const m = mode.toUpperCase();
        if (vehicleManager) vehicleManager.setDensityMode(m);
        if (elements.densitySelect) elements.densitySelect.value = m;
        if (elements.densityBadge) {
          elements.densityBadge.textContent = `Mode: ${m.charAt(0) + m.slice(1).toLowerCase()}`;
        }
      },
      setTimingMode(mode) {
        const m = mode.toUpperCase();
        if (adaptiveController) adaptiveController.setMode(m);
        if (elements.modeSelect) elements.modeSelect.value = m;
        updateAdaptiveUI();
      },
      startSimulation,
      pauseSimulation,
      resetSimulation,
      stepSimulation: manualStep,
      manualStep,
      toggleAllRedHalt,
      handleAllRedHalt: toggleAllRedHalt,
      handleEmergencyCleared
    };
  }

  /**
   * Smooth 60fps Animation Loop for Vehicle Physics
   */
  function animationLoop(now) {
    const rawDt = Math.min(0.1, (now - lastAnimTime) / 1000);
    lastAnimTime = now;

    if (vehicleManager) {
      const isPaused = (simStatus === SIM_STATUS.PAUSED || simStatus === SIM_STATUS.STOPPED);
      // Speed multiplier scales physics delta time when running
      const dt = isPaused ? 0 : rawDt * speedMultiplier;
      vehicleManager.update(dt, fsm ? fsm.getSignals() : null, isPaused);
      updateAnalyticsUI();
    }

    requestAnimationFrame(animationLoop);
  }

  /**
   * Update Adaptive Demand Meter, Progress Bar, Rationale & XAI from authoritative snapshot
   */
  function updateAdaptiveUI(queues = null) {
    if (!adaptiveController || !vehicleManager) return;
    const currentQueues = queues || vehicleManager.getAnalytics().queueLengths;
    const currentState = fsm ? fsm.getCurrentState() : window.TrafficFSM.STATES.S0_NS_GREEN;

    // Single authoritative evaluation snapshot
    const evalData = adaptiveController.getLiveDemandEvaluation(currentState, currentQueues);

    if (elements.valDemandNS) elements.valDemandNS.textContent = evalData.demandNS.toFixed(1);
    if (elements.valDemandEW) elements.valDemandEW.textContent = evalData.demandEW.toFixed(1);

    const totalD = evalData.demandNS + evalData.demandEW;
    if (totalD > 0) {
      const nsPct = Math.round((evalData.demandNS / totalD) * 100);
      const ewPct = 100 - nsPct;
      if (elements.demandFillNS) elements.demandFillNS.style.width = `${nsPct}%`;
      if (elements.demandFillEW) elements.demandFillEW.style.width = `${ewPct}%`;
    } else {
      if (elements.demandFillNS) elements.demandFillNS.style.width = '50%';
      if (elements.demandFillEW) elements.demandFillEW.style.width = '50%';
    }

    if (elements.adaptiveRationaleText) {
      elements.adaptiveRationaleText.textContent = evalData.rationale;
    }
    if (elements.adaptiveCalculatedDuration) {
      elements.adaptiveCalculatedDuration.textContent = `${evalData.duration}s (${evalData.axis})`;
    }
  }

  /**
   * Update Traffic Analytics UI KPI Badges
   */
  function updateAnalyticsUI() {
    if (!vehicleManager) return;
    const data = vehicleManager.getAnalytics();

    if (elements.statTotalGenerated) elements.statTotalGenerated.textContent = data.totalGenerated;
    if (elements.statTotalPassed) elements.statTotalPassed.textContent = data.totalPassed;
    if (elements.statAvgWaitTime) elements.statAvgWaitTime.textContent = `${data.avgWaitTime.toFixed(1)}s`;
    if (elements.statThroughput) {
      if (data.totalPassed === 0 && data.totalGenerated > 0) {
        elements.statThroughput.textContent = 'Flow Inbound...';
      } else {
        elements.statThroughput.textContent = `${data.throughput} veh/min`;
      }
    }
    if (elements.statEmergencyCount) {
      const clearedCount = analyticsEngine
        ? analyticsEngine.getEmergencyStats().totalCleared
        : (vehicleManager ? vehicleManager.emergencyEvents.filter(e => e.cleared).length : 0);
      elements.statEmergencyCount.textContent = clearedCount;
    }

    if (elements.queueN) elements.queueN.textContent = data.queueLengths.north;
    if (elements.queueS) elements.queueS.textContent = data.queueLengths.south;
    if (elements.queueE) elements.queueE.textContent = data.queueLengths.east;
    if (elements.queueW) elements.queueW.textContent = data.queueLengths.west;

    // Highlight queue badges
    ['north', 'south', 'east', 'west'].forEach((dir) => {
      const card = elements.queueCards[dir];
      if (card) {
        if (data.queueLengths[dir] > 0) {
          card.classList.add('active-queue');
        } else {
          card.classList.remove('active-queue');
        }
      }
    });

    // Authoritative Single-Snapshot Adaptive Demand & XAI Update
    updateAdaptiveUI(data.queueLengths);

    // Phase 5: Advanced Traffic Analytics Engine Snapshot & Visualizations
    if (analyticsEngine) {
      analyticsEngine.recordSnapshot(
        data.queueLengths,
        adaptiveController ? adaptiveController.getMode() : 'ADAPTIVE',
        data.throughput,
        data.avgWaitTime
      );

      if (elements.statEfficiencyScore) {
        elements.statEfficiencyScore.textContent = `${analyticsEngine.efficiencyScore}%`;
      }
      if (elements.statDelaySaved) {
        elements.statDelaySaved.textContent = `${analyticsEngine.cumulativeAdaptiveDelaySaved.toFixed(1)}s`;
      }
      // Rate-limit SVG sparkline re-renders to 2Hz to prevent 60fps DOM thrashing
      const nowMs = performance.now();
      if (elements.chartQueueHistory && (nowMs - lastChartUpdate > 500)) {
        elements.chartQueueHistory.innerHTML = analyticsEngine.generateQueueHistorySvg(320, 60);
        lastChartUpdate = nowMs;
      }

      // Update Approach Congestion Heatmap
      const heat = analyticsEngine.getCongestionHeatLevels(data.queueLengths);
      ['north', 'south', 'east', 'west'].forEach((dir) => {
        const cell = elements.heatCells[dir];
        const statusEl = elements.heatStatuses[dir];
        if (cell && statusEl) {
          const lvl = heat[dir];
          if (lvl >= 0.7) {
            cell.style.background = '#450a0a';
            cell.style.borderColor = '#ef4444';
            statusEl.style.color = '#f87171';
            statusEl.textContent = 'HEAVY';
          } else if (lvl >= 0.35) {
            cell.style.background = '#422006';
            cell.style.borderColor = '#f59e0b';
            statusEl.style.color = '#fbbf24';
            statusEl.textContent = 'MODERATE';
          } else {
            cell.style.background = '#0f172a';
            cell.style.borderColor = '#1e293b';
            statusEl.style.color = '#38bdf8';
            statusEl.textContent = 'CLEAR';
          }
        }
      });
    }
  }

  /**
   * Render the 4-State Cycle Table
   */
  function renderStateTable() {
    const states = fsm.getAllStateMetadata();
    elements.stateTableBody.innerHTML = '';

    states.forEach((s) => {
      const tr = document.createElement('tr');
      tr.id = `row-${s.key}`;
      if (s.key === fsm.getCurrentState()) {
        tr.classList.add('active-row');
      }

      const nsClass = s.northSouth.toLowerCase();
      const ewClass = s.eastWest.toLowerCase();

      tr.innerHTML = `
        <td><strong style="color:#60a5fa;">${s.code}</strong> (${s.axisActive})</td>
        <td><span class="light-pill ${nsClass}">${s.northSouth}</span></td>
        <td><span class="light-pill ${ewClass}">${s.eastWest}</span></td>
        <td>
          <input type="number" min="1" max="120" value="${s.duration}" 
                 class="duration-input" data-state="${s.key}" aria-label="Duration for ${s.code}">
        </td>
        <td style="font-family:var(--font-mono); color:#94a3b8;">${s.nextState}</td>
      `;
      elements.stateTableBody.appendChild(tr);
    });

    // Listen for duration updates
    const inputs = elements.stateTableBody.querySelectorAll('.duration-input');
    inputs.forEach((input) => {
      input.addEventListener('change', (e) => {
        const stateKey = e.target.getAttribute('data-state');
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val > 0) {
          fsm.setDuration(stateKey, val);
          if (fsm.getCurrentState() === stateKey && simStatus === SIM_STATUS.STOPPED) {
            remainingSeconds = val;
            updateUI();
          }
          logEvent(`Duration for ${stateKey} updated to ${val}s`);
        }
      });
    });
  }

  /**
   * Update all Visual Lamps based on current FSM signal outputs
   */
  function updateSignalsUI(signals) {
    const directions = ['north', 'south', 'east', 'west'];

    directions.forEach((dir) => {
      const color = signals[dir];
      const lamps = elements.lamps[dir];

      // Reset all lamps in this unit
      lamps.red.classList.remove('active');
      lamps.yellow.classList.remove('active');
      lamps.green.classList.remove('active');

      // Light up the active lamp
      if (color === window.TrafficFSM.LIGHTS.RED) {
        lamps.red.classList.add('active');
      } else if (color === window.TrafficFSM.LIGHTS.YELLOW) {
        lamps.yellow.classList.add('active');
      } else if (color === window.TrafficFSM.LIGHTS.GREEN) {
        lamps.green.classList.add('active');
      }

      // Update countdown display
      const isPriorityHold = (fsm.isHoldingPriorityGreen && fsm.isHoldingPriorityGreen());
      if (isPriorityHold) {
        elements.timers[dir].textContent = 'HOLD';
        elements.timers[dir].classList.add('priority-hold');
      } else {
        elements.timers[dir].textContent = remainingSeconds;
        elements.timers[dir].classList.remove('priority-hold');
      }
    });

    // Update traffic flow indicators
    const isAllRed = fsm.isAllRedHalt();
    const nsActive = !isAllRed && signals.north === window.TrafficFSM.LIGHTS.GREEN;
    const nsCaution = !isAllRed && signals.north === window.TrafficFSM.LIGHTS.YELLOW;
    const ewActive = !isAllRed && signals.east === window.TrafficFSM.LIGHTS.GREEN;
    const ewCaution = !isAllRed && signals.east === window.TrafficFSM.LIGHTS.YELLOW;

    if (isAllRed) {
      elements.flowNS.className = 'flow-pill flow-stopped';
      elements.flowNS.style.background = '';
      elements.flowNS.style.color = '';
      elements.flowNS.style.border = '';
      elements.flowNS.textContent = 'NS: ALL-RED';

      elements.flowEW.className = 'flow-pill flow-stopped';
      elements.flowEW.style.background = '';
      elements.flowEW.style.color = '';
      elements.flowEW.style.border = '';
      elements.flowEW.textContent = 'EW: ALL-RED';
      return;
    }

    if (nsActive) {
      elements.flowNS.className = 'flow-pill flow-active';
      elements.flowNS.style.background = '';
      elements.flowNS.style.color = '';
      elements.flowNS.style.border = '';
      elements.flowNS.textContent = 'NS: FLOWING (GREEN)';
    } else if (nsCaution) {
      elements.flowNS.className = 'flow-pill flow-caution';
      elements.flowNS.style.background = '';
      elements.flowNS.style.color = '';
      elements.flowNS.style.border = '';
      elements.flowNS.textContent = 'NS: CLEARING (YELLOW)';
    } else {
      elements.flowNS.className = 'flow-pill flow-stopped';
      elements.flowNS.style.background = '';
      elements.flowNS.style.color = '';
      elements.flowNS.style.border = '';
      elements.flowNS.textContent = 'NS: STOPPED (RED)';
    }

    if (ewActive) {
      elements.flowEW.className = 'flow-pill flow-active';
      elements.flowEW.style.background = '';
      elements.flowEW.style.color = '';
      elements.flowEW.style.border = '';
      elements.flowEW.textContent = 'EW: FLOWING (GREEN)';
    } else if (ewCaution) {
      elements.flowEW.className = 'flow-pill flow-caution';
      elements.flowEW.style.background = '';
      elements.flowEW.style.color = '';
      elements.flowEW.style.border = '';
      elements.flowEW.textContent = 'EW: CLEARING (YELLOW)';
    } else {
      elements.flowEW.className = 'flow-pill flow-stopped';
      elements.flowEW.style.background = '';
      elements.flowEW.style.color = '';
      elements.flowEW.style.border = '';
      elements.flowEW.textContent = 'EW: STOPPED (RED)';
    }
  }

  /**
   * Continuous Safety Invariant Monitor & Real-time Formal Assertion
   */
  function checkAndRenderSafety(signals) {
    const safety = fsm.validateSafety(signals);
    verifiedTransitionCount++;

    const nsGreen = signals.north === window.TrafficFSM.LIGHTS.GREEN;
    const ewGreen = signals.east === window.TrafficFSM.LIGHTS.GREEN;
    const conflictOccurred = nsGreen && ewGreen;

    if (!safety.isSafe || conflictOccurred) {
      violationCount++;
      elements.badgeInvariant.className = 'badge badge-invariant violated';
      elements.badgeInvariant.textContent = 'CRITICAL: INVARIANT VIOLATION';

      elements.safetyCard.className = 'invariant-card violation';
      elements.safetyStatusLabel.textContent = 'HAZARD DETECTED';
      elements.safetyEquation.textContent = 'VIOLATION: Conflicting directions have active green!';
      elements.safetyMetrics.textContent = `Checks: ${verifiedTransitionCount} | VIOLATIONS: ${violationCount}`;

      // Failsafe: Emergency All-Red Halt
      fsm.triggerAllRedHalt();
      pauseSimulation();
      logEvent(`EMERGENCY: Safety Invariant violated! Fail-safe all-red triggered.`);
      return false;
    }

    elements.badgeInvariant.className = 'badge badge-invariant';
    elements.badgeInvariant.textContent = 'INVARIANT: CONFLICT-FREE';

    elements.safetyCard.className = 'invariant-card';
    elements.safetyStatusLabel.textContent = 'ALL CHECKS PASSED';
    elements.safetyEquation.innerHTML = `Condition: (NS == GREEN) &and; (EW == GREEN) &equiv; FALSE &nbsp;&bull;&nbsp; <strong style="color:#6ee7b7;">VERIFIED SAFE</strong>`;
    elements.safetyMetrics.textContent = `Verified continuous cycles: ${verifiedTransitionCount} | Violations: 0 | Conflict isolation: 100%`;

    return true;
  }

  /**
   * Update full UI (cards, table rows, badges, countdowns)
   */
  function updateUI() {
    const meta = fsm.getCurrentStateMetadata();
    const signals = fsm.getSignals();

    // Check safety
    checkAndRenderSafety(signals);

    // Update Signals
    updateSignalsUI(signals);

    const isPriorityHold = !!(fsm.isHoldingPriorityGreen && fsm.isHoldingPriorityGreen());

    // Update State Card
    if (fsm.isAllRedHalt()) {
      elements.stateTitle.textContent = 'FAIL-SAFE: ALL-RED HALT';
      elements.stateIdBadge.textContent = 'Emergency Mode';
      elements.stateDesc.textContent = 'All approaches are held at RED. Vehicles stop safely at stop lines.';
      elements.activeAxisLabel.textContent = 'Active: None (All Red)';
      elements.countdownSeconds.textContent = 'HOLD';
      elements.elapsedSeconds.textContent = `${elapsedSeconds}s`;
      elements.progressBarFill.style.width = '100%';
      elements.btnAllRed.classList.add('active');
      elements.btnAllRed.innerHTML = '<span aria-hidden="true">&#8635;</span> Resume Normal';
    } else {
      elements.stateTitle.textContent = `${meta.code}: ${meta.title}`;
      elements.stateIdBadge.textContent = `Phase ${meta.id + 1} of 4`;
      elements.stateDesc.textContent = meta.description;
      elements.activeAxisLabel.textContent = `Active: ${meta.axisActive}`;
      if (isPriorityHold) {
        elements.countdownSeconds.innerHTML = '<span class="priority-hold-label">HOLD</span>';
      } else {
        elements.countdownSeconds.textContent = `${remainingSeconds}s`;
      }
      elements.elapsedSeconds.textContent = `${elapsedSeconds}s`;
      const totalDuration = meta.duration || 10;
      const percentage = isPriorityHold ? 100 : Math.max(0, Math.min(100, (remainingSeconds / totalDuration) * 100));
      elements.progressBarFill.style.width = `${percentage}%`;
      elements.btnAllRed.classList.remove('active');
      elements.btnAllRed.innerHTML = '<span aria-hidden="true">&#9888;</span> All-Red Halt';
    }

    // Active row highlight in state table
    const allRows = elements.stateTableBody.querySelectorAll('tr');
    allRows.forEach((row) => row.classList.remove('active-row'));
    if (!fsm.isAllRedHalt()) {
      const activeRow = document.getElementById(`row-${fsm.getCurrentState()}`);
      if (activeRow) {
        activeRow.classList.add('active-row');
      }
    }

    // Dynamic Emergency Priority Banner State Synchronization
    const priority = fsm.getEmergencyPriority();
    if (priority && priority.active) {
      if (elements.emergencyBanner) {
        elements.emergencyBanner.style.display = 'flex';
        const isNorthSouth = priority.direction === 'north' || priority.direction === 'south';
        const targetState = isNorthSouth ? window.TrafficFSM.STATES.S0_NS_GREEN : window.TrafficFSM.STATES.S2_EW_GREEN;

        const dirLane = vehicleManager ? vehicleManager.lanes[priority.direction] : [];
        const activeVeh = dirLane ? dirLane.find(v => v.isEmergency && !v.hasClearedIntersection) : null;
        const isCrossing = activeVeh && activeVeh.pos >= 138;

        if (elements.emergencyBannerText) {
          const typeLabel = activeVeh ? activeVeh.type.replace('_', ' ') : 'EMERGENCY VEHICLE';
          elements.emergencyBannerText.textContent = `${typeLabel} from ${priority.direction.toUpperCase()}`;
        }

        if (fsm.isAllRedHalt()) {
          elements.emergencyBannerPhase.textContent = 'All-Red Emergency Override';
        } else if (fsm.getCurrentState() === targetState) {
          if (isCrossing) {
            elements.emergencyBannerPhase.textContent = 'Priority Green Active (Traversing Intersection Box)';
          } else {
            elements.emergencyBannerPhase.textContent = 'Priority Green Active (Holding for Transit)';
          }
        } else {
          elements.emergencyBannerPhase.textContent = 'Securing Yellow Clearance...';
        }
      }
    } else {
      if (elements.emergencyBanner) {
        elements.emergencyBanner.style.display = 'none';
      }
    }

    // Keep Adaptive UI synchronized with authoritative snapshot
    updateAdaptiveUI();

    // Status Badge
    updateStatusBadge();
  }

  function updateStatusBadge() {
    elements.badgeStatus.className = 'badge badge-status';
    if (fsm.isAllRedHalt()) {
      elements.badgeStatus.classList.add('paused');
      elements.badgeStatus.textContent = 'FAIL-SAFE: ALL-RED';
      elements.btnStart.disabled = true;
      elements.btnPause.disabled = true;
      return;
    }

    if (simStatus === SIM_STATUS.RUNNING) {
      elements.badgeStatus.classList.add('running');
      elements.badgeStatus.textContent = 'SIMULATION: RUNNING';
      elements.btnStart.disabled = true;
      elements.btnPause.disabled = false;
    } else if (simStatus === SIM_STATUS.PAUSED) {
      elements.badgeStatus.classList.add('paused');
      elements.badgeStatus.textContent = 'SIMULATION: PAUSED';
      elements.btnStart.disabled = false;
      elements.btnPause.disabled = true;
    } else {
      elements.badgeStatus.classList.add('stopped');
      elements.badgeStatus.textContent = 'SIMULATION: STOPPED';
      elements.btnStart.disabled = false;
      elements.btnPause.disabled = true;
    }
  }

  /**
   * Simulation Timer Tick Handler (runs once per simulated second)
   */
  function tick() {
    if (simStatus !== SIM_STATUS.RUNNING || fsm.isAllRedHalt()) return;

    // If an emergency vehicle has secured priority green, hold green open until transit is complete
    if (fsm.isHoldingPriorityGreen && fsm.isHoldingPriorityGreen()) {
      elapsedSeconds++;
      if (remainingSeconds < 5) {
        remainingSeconds = 5;
      }
      updateUI();
      return;
    }

    remainingSeconds--;
    elapsedSeconds++;

    if (remainingSeconds <= 0) {
      // Evaluate adaptive timing before entering next state
      const nextMeta = fsm.getCurrentStateMetadata();
      const targetStateKey = nextMeta.nextState;

      if (adaptiveController && vehicleManager) {
        if (targetStateKey === window.TrafficFSM.STATES.S0_NS_GREEN || targetStateKey === window.TrafficFSM.STATES.S2_EW_GREEN) {
          const queues = vehicleManager.getAnalytics().queueLengths;
          const decision = adaptiveController.evaluatePhaseDuration(targetStateKey, queues);

          if (adaptiveController.getMode() === 'ADAPTIVE') {
            fsm.setDuration(targetStateKey, decision.duration);

            const durationInput = document.querySelector(`.duration-input[data-state="${targetStateKey}"]`);
            if (durationInput) durationInput.value = decision.duration;

            logEvent(`Adaptive Control [${decision.axis}]: Green calculated at ${decision.duration}s. Reason: ${decision.rationale}`);
          }

          updateAdaptiveUI(queues);
        }
      }

      // Transition to next FSM state
      const res = fsm.step();
      remainingSeconds = res.metadata.duration;
      elapsedSeconds = 0;
      logEvent(`FSM Transition &rarr; ${res.metadata.code} (${res.metadata.title}) [${res.metadata.duration}s]`);
    }

    updateUI();
  }

  /**
   * Start or Resume Simulation
   */
  function startSimulation() {
    if (fsm.isAllRedHalt()) return;
    if (simStatus === SIM_STATUS.RUNNING && timerInterval) return;

    simStatus = SIM_STATUS.RUNNING;
    updateStatusBadge();

    const intervalMs = Math.round(1000 / speedMultiplier);
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tick, intervalMs);

    logEvent(`Simulation started at ${speedMultiplier}x speed.`);
  }

  /**
   * Pause Simulation
   */
  function pauseSimulation() {
    if (simStatus !== SIM_STATUS.RUNNING) return;

    simStatus = SIM_STATUS.PAUSED;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    updateStatusBadge();
    logEvent('Simulation paused. Vehicles holding positions.');
  }

  /**
   * Reset Simulation to Initial State (S0)
   */
  function resetSimulation() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    simStatus = SIM_STATUS.STOPPED;
    fsm.reset();

    if (elements.emergencyBanner) {
      elements.emergencyBanner.style.display = 'none';
    }

    if (vehicleManager) {
      vehicleManager.reset();
      updateAnalyticsUI();
    }

    if (analyticsEngine) {
      analyticsEngine.reset();
    }

    const meta = fsm.getCurrentStateMetadata();
    remainingSeconds = meta.duration;
    elapsedSeconds = 0;

    updateUI();
    logEvent('Simulation reset to State S0 (NS Green / EW Red). All queues cleared.');
  }

  /**
   * Toggle Fail-Safe All-Red Halt
   */
  function toggleAllRedHalt() {
    if (fsm.isAllRedHalt()) {
      fsm.resumeFromAllRed();
      logEvent('Fail-Safe All-Red Halt released. Resuming normal operations.');
      if (wasRunningBeforeHalt) {
        simStatus = SIM_STATUS.STOPPED;
        startSimulation();
      } else {
        updateStatusBadge();
      }
    } else {
      wasRunningBeforeHalt = (simStatus === SIM_STATUS.RUNNING);
      fsm.triggerAllRedHalt();
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      simStatus = SIM_STATUS.PAUSED;
      logEvent('EMERGENCY: Fail-Safe All-Red Halt activated! All vehicles stopping safely.');
    }
    updateUI();
  }

  /**
   * Manual Single-Step Transition
   */
  function manualStep() {
    if (fsm.isAllRedHalt()) {
      fsm.resumeFromAllRed();
    }

    if (simStatus === SIM_STATUS.RUNNING) {
      pauseSimulation();
    }

    const res = fsm.step();
    remainingSeconds = res.metadata.duration;
    elapsedSeconds = 0;

    updateUI();
    logEvent(`Manual Step &rarr; ${res.metadata.code} (${res.metadata.title})`);
  }

  /**
   * Run the formal Verification Suite and display results in UI
   */
  function runAutomatedVerification(logToConsole = true) {
    if (!window.FSMVerifier) return;

    const results = window.FSMVerifier.runVerificationSuite();
    elements.verificationList.innerHTML = '';

    results.details.forEach((item) => {
      const div = document.createElement('div');
      div.className = `test-item ${item.status === 'FAIL' ? 'failed' : ''}`;
      div.innerHTML = `
        <span class="test-badge ${item.status === 'FAIL' ? 'fail' : ''}">[${item.status}]</span>
        <span class="test-name">${item.test}</span>
      `;
      elements.verificationList.appendChild(div);
    });

    if (results.failed === 0) {
      elements.testSummaryBadge.style.background = '#064e3b';
      elements.testSummaryBadge.style.color = '#6ee7b7';
      elements.testSummaryBadge.textContent = `${results.passed}/${results.total} Passed (100%)`;
      if (logToConsole) {
        logEvent(`Verification suite passed: all ${results.total} formal assertions verified.`);
      }
    } else {
      elements.testSummaryBadge.style.background = '#7f1d1d';
      elements.testSummaryBadge.style.color = '#fca5a5';
      elements.testSummaryBadge.textContent = `${results.failed} Failed!`;
      if (logToConsole) {
        logEvent(`Verification suite failed: ${results.failed} tests failed!`);
      }
    }
  }

  /**
   * Event Logging
   */
  function logEvent(message) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const timeStr = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="log-time">[${timeStr}]</span> ${message}`;
    elements.eventLog.prepend(entry);

    // Keep log bounded to 50 items
    while (elements.eventLog.children.length > 50) {
      elements.eventLog.removeChild(elements.eventLog.lastChild);
    }
  }

  /**
   * Attach UI Event Listeners
   */
  function attachEventListeners() {
    elements.btnStart.addEventListener('click', startSimulation);
    elements.btnPause.addEventListener('click', pauseSimulation);
    elements.btnReset.addEventListener('click', resetSimulation);
    elements.btnStep.addEventListener('click', manualStep);
    elements.btnAllRed.addEventListener('click', toggleAllRedHalt);

    if (elements.modeSelect) {
      elements.modeSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        if (adaptiveController) {
          adaptiveController.setMode(mode);
          updateAdaptiveUI();
        }
        if (elements.adaptiveModeBadge) {
          elements.adaptiveModeBadge.textContent = `${mode} MODE`;
          if (mode === 'ADAPTIVE') {
            elements.adaptiveModeBadge.style.background = '#0c4a6e';
            elements.adaptiveModeBadge.style.color = '#38bdf8';
          } else if (mode === 'FIXED') {
            elements.adaptiveModeBadge.style.background = '#312e81';
            elements.adaptiveModeBadge.style.color = '#c7d2fe';
          } else {
            elements.adaptiveModeBadge.style.background = '#3f3f46';
            elements.adaptiveModeBadge.style.color = '#e4e4e7';
          }
        }
        logEvent(`Timing mode set to ${mode}.`);
      });
    }

    if (elements.btnDispatchAmb) {
      elements.btnDispatchAmb.addEventListener('click', () => {
        const dir = elements.emergencyDirSelect ? elements.emergencyDirSelect.value : 'north';
        if (vehicleManager) {
          vehicleManager.spawnEmergencyVehicle(dir, 'AMBULANCE');
        }
      });
    }

    if (elements.btnDispatchFire) {
      elements.btnDispatchFire.addEventListener('click', () => {
        const dir = elements.emergencyDirSelect ? elements.emergencyDirSelect.value : 'north';
        if (vehicleManager) {
          vehicleManager.spawnEmergencyVehicle(dir, 'FIRE_ENGINE');
        }
      });
    }

    if (elements.btnDispatchPolice) {
      elements.btnDispatchPolice.addEventListener('click', () => {
        const dir = elements.emergencyDirSelect ? elements.emergencyDirSelect.value : 'north';
        if (vehicleManager) {
          vehicleManager.spawnEmergencyVehicle(dir, 'POLICE');
        }
      });
    }

    if (elements.densitySelect) {
      elements.densitySelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        if (vehicleManager) {
          vehicleManager.setDensityMode(mode);
        }
        if (elements.densityBadge) {
          const cap = mode.charAt(0) + mode.slice(1).toLowerCase();
          elements.densityBadge.textContent = `Mode: ${cap}`;
        }
        logEvent(`Traffic density set to ${mode}.`);
      });
    }

    elements.speedSelect.addEventListener('change', (e) => {
      speedMultiplier = parseFloat(e.target.value) || 1;
      logEvent(`Speed changed to ${speedMultiplier}x.`);
      if (simStatus === SIM_STATUS.RUNNING) {
        clearInterval(timerInterval);
        timerInterval = setInterval(tick, Math.round(1000 / speedMultiplier));
      }
    });

    elements.btnRunVerification.addEventListener('click', () => {
      runAutomatedVerification(true);
    });

    elements.btnClearLog.addEventListener('click', () => {
      elements.eventLog.innerHTML = '';
      logEvent('Log cleared.');
    });
  }

  // Self-boot when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
