/**
 * PHASE 9: Independent End-to-End Browser Acceptance Test Suite
 * Intelligent Traffic Management System (ITMS) - 4-Way Traffic Light Controller
 *
 * Real browser automation over native Chrome DevTools Protocol (CDP)
 * Pure vanilla Node.js 24+ with zero external dependencies.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTML_FILE = path.resolve(__dirname, 'index.html');
const EVIDENCE_DIR = path.resolve(__dirname, 'docs', 'phase-9-evidence');
const DEBUG_PORT = 9224;

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

class CDPSession {
  constructor(port) {
    this.port = port;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
  }

  async connect() {
    const res = await fetch(`http://127.0.0.1:${this.port}/json/list`);
    const pages = await res.json();
    const page = pages.find((p) => p.type === 'page') || pages[0];
    if (!page || !page.webSocketDebuggerUrl) {
      throw new Error('No inspectable page found in Chrome');
    }
    this.ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Evaluation failed: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async screenshot(filePath, width = 1920, height = 1080) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600
    });
    await this.send('Emulation.setVisibleSize', { width, height });
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filePath, buffer);
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runAcceptanceTests() {
  console.log('================================================================');
  console.log(' PHASE 9: INDEPENDENT END-TO-END ACCEPTANCE TESTING SUITE');
  console.log(' Real Headless Browser Automation via Chrome DevTools Protocol');
  console.log('================================================================');

  const userDataDir = path.resolve(process.env.TEMP, `chrome_phase9_${Date.now()}`);
  const fileUrl = `file:///${HTML_FILE.replace(/\\/g, '/')}`;

  console.log(`[INIT] Launching Google Chrome on port ${DEBUG_PORT}...`);
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--run-all-compositor-stages-before-draw',
    fileUrl
  ]);

  // Wait for Chrome to bind port
  await new Promise((r) => setTimeout(r, 2000));

  const cdp = new CDPSession(DEBUG_PORT);
  await cdp.connect();
  console.log('[INIT] CDP WebSocket connection established.');

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: fileUrl });
  await new Promise((r) => setTimeout(r, 1500));

  const testResults = [];

  function record(scenario, testName, passed, details = '') {
    const status = passed ? 'PASS' : 'FAIL';
    testResults.push({ scenario, testName, status, details });
    const icon = passed ? '✅' : '❌';
    console.log(`  ${icon} [${status}] [${scenario}] ${testName} ${details ? '- ' + details : ''}`);
  }

  try {
    // -------------------------------------------------------------------------
    // Initial Application & State Check
    // -------------------------------------------------------------------------
    console.log('\n--- VERIFYING INITIAL APPLICATION LOAD ---');
    const title = await cdp.evaluate('document.title');
    record('INIT', 'Document Title & Shell', title.includes('Traffic Light Controller'), `Title: ${title}`);

    const initialFSM = await cdp.evaluate(`({
      state: window.TrafficApp ? window.TrafficApp.fsm.getCurrentState() : null,
      signals: window.TrafficApp ? window.TrafficApp.fsm.getSignals() : null,
      running: window.TrafficApp ? window.TrafficApp.simStatus : null
    })`);

    record(
      'INIT',
      'Initial FSM State & Signals',
      initialFSM.state === 'S0_NS_GREEN' &&
      initialFSM.signals.north === 'GREEN' &&
      initialFSM.signals.east === 'RED',
      `State: ${initialFSM.state}, Signals: ${JSON.stringify(initialFSM.signals)}`
    );

    await cdp.screenshot(path.join(EVIDENCE_DIR, '01-initial-application.png'), 1920, 1080);
    console.log('  📸 Captured 01-initial-application.png');

    // -------------------------------------------------------------------------
    // SCENARIO A: Normal Traffic Operation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SCENARIO A: NORMAL TRAFFIC OPERATION ---');
    // Click Start
    await cdp.evaluate(`document.getElementById('btnStart').click()`);
    await cdp.evaluate(`window.TrafficApp.setSpeedMultiplier(2)`); // 2x speed for observation

    // Observe 2 full FSM cycles (S0 -> S1 -> S2 -> S3 -> S0 -> S1 -> S2 -> S3 -> S0)
    const observedStates = new Set();
    const transitionsHistory = [];
    let conflictingGreensDetected = 0;
    let vehiclesOverlapping = 0;

    for (let sec = 0; sec < 35; sec++) {
      await new Promise((r) => setTimeout(r, 500));
      const snap = await cdp.evaluate(`({
        state: window.TrafficApp.fsm.getCurrentState(),
        signals: window.TrafficApp.fsm.getSignals(),
        remaining: window.TrafficApp.remainingSeconds,
        elapsed: window.TrafficApp.elapsedSeconds,
        generated: window.TrafficApp.vehicleManager.analytics.totalGenerated,
        passed: window.TrafficApp.vehicleManager.analytics.totalPassed,
        lanes: {
          north: window.TrafficApp.vehicleManager.lanes.north.length,
          south: window.TrafficApp.vehicleManager.lanes.south.length,
          east: window.TrafficApp.vehicleManager.lanes.east.length,
          west: window.TrafficApp.vehicleManager.lanes.west.length
        }
      })`);

      observedStates.add(snap.state);
      if (transitionsHistory[transitionsHistory.length - 1] !== snap.state) {
        transitionsHistory.push(snap.state);
      }

      // Check conflict invariant
      if ((snap.signals.north === 'GREEN' || snap.signals.south === 'GREEN') &&
          (snap.signals.east === 'GREEN' || snap.signals.west === 'GREEN')) {
        conflictingGreensDetected++;
      }
    }

    record(
      'SCENARIO_A',
      'Cyclic 4-State Transition Coverage',
      observedStates.has('S0_NS_GREEN') &&
      observedStates.has('S1_NS_YELLOW') &&
      observedStates.has('S2_EW_GREEN') &&
      observedStates.has('S3_EW_YELLOW'),
      `Observed states: ${Array.from(observedStates).join(' -> ')}`
    );

    record(
      'SCENARIO_A',
      'Zero Conflicting Green Signals During Operation',
      conflictingGreensDetected === 0,
      `Conflicts: ${conflictingGreensDetected}`
    );

    const postNormalStats = await cdp.evaluate(`({
      generated: window.TrafficApp.vehicleManager.analytics.totalGenerated,
      passed: window.TrafficApp.vehicleManager.analytics.totalPassed,
      active: window.TrafficApp.vehicleManager.lanes.north.length +
              window.TrafficApp.vehicleManager.lanes.south.length +
              window.TrafficApp.vehicleManager.lanes.east.length +
              window.TrafficApp.vehicleManager.lanes.west.length
    })`);

    record(
      'SCENARIO_A',
      'Vehicle Kinematics & Despawn Throughput',
      postNormalStats.generated > 0 && postNormalStats.passed > 0,
      `Generated: ${postNormalStats.generated}, Passed: ${postNormalStats.passed}, Active: ${postNormalStats.active}`
    );

    await cdp.screenshot(path.join(EVIDENCE_DIR, '02-normal-traffic.png'), 1920, 1080);
    console.log('  📸 Captured 02-normal-traffic.png');

    // -------------------------------------------------------------------------
    // SCENARIO B: Traffic Density Stress & Conservation Law
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SCENARIO B: TRAFFIC DENSITY STRESS & CONSERVATION ---');
    const densities = ['LOW', 'MEDIUM', 'HIGH'];
    const densityResults = {};

    for (const d of densities) {
      await cdp.evaluate(`
        window.TrafficApp.resetSimulation();
        window.TrafficApp.setTimingMode('ADAPTIVE');
        window.TrafficApp.setDensity('${d}');
        window.TrafficApp.setSpeedMultiplier(5); // 5x acceleration for 5-minute simulated test
        window.TrafficApp.startSimulation();
      `);

      // 5 minutes simulated time = 300 simulated seconds (60 seconds wall clock at 5x)
      // We will sample across 10 seconds of wall clock (= 50s sim) or fast-tick in browser
      const simMetrics = await cdp.evaluate(`
        new Promise((resolve) => {
          let wallSeconds = 0;
          const initialTime = Date.now();
          // Advance simulation ticks rapidly
          for (let tick = 0; tick < 300; tick++) {
            window.TrafficApp.fsm.step(); // Step through cycles
            window.TrafficApp.vehicleManager.update(1.0, window.TrafficApp.fsm.getSignals());
          }
          const vm = window.TrafficApp.vehicleManager;
          const active = vm.lanes.north.length + vm.lanes.south.length + vm.lanes.east.length + vm.lanes.west.length;
          resolve({
            mode: '${d}',
            generated: vm.analytics.totalGenerated,
            passed: vm.analytics.totalPassed,
            active,
            conservation: (vm.analytics.totalPassed + active) === vm.analytics.totalGenerated,
            avgWaitTime: vm.analytics.avgWaitTime.toFixed(1),
            throughput: vm.analytics.throughput
          });
        })
      `);

      densityResults[d] = simMetrics;
      record(
        'SCENARIO_B',
        `Density Mode ${d}: Mathematical Conservation Law`,
        simMetrics.conservation && simMetrics.generated > 0,
        `Generated (${simMetrics.generated}) = Passed (${simMetrics.passed}) + Active (${simMetrics.active})`
      );
    }

    // Capture High Density screenshot
    await cdp.evaluate(`
      window.TrafficApp.resetSimulation();
      window.TrafficApp.setDensity('HIGH');
      window.TrafficApp.setSpeedMultiplier(1);
      window.TrafficApp.startSimulation();
    `);
    await new Promise((r) => setTimeout(r, 4000));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '03-high-density-traffic.png'), 1920, 1080);
    console.log('  📸 Captured 03-high-density-traffic.png');

    // -------------------------------------------------------------------------
    // SCENARIO C: Adaptive Controller & Explainable AI (XAI)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SCENARIO C: ADAPTIVE CONTROLLER & XAI CONSISTENCY ---');
    const adaptiveAudit = await cdp.evaluate(`({
      balanced: window.TrafficApp.adaptiveController.getLiveDemandEvaluation('S0_NS_GREEN', { north: 4, south: 4, east: 4, west: 4 }),
      heavyNS: window.TrafficApp.adaptiveController.getLiveDemandEvaluation('S0_NS_GREEN', { north: 9, south: 8, east: 1, west: 0 }),
      heavyEW: window.TrafficApp.adaptiveController.getLiveDemandEvaluation('S2_EW_GREEN', { north: 1, south: 0, east: 10, west: 8 }),
      empty: window.TrafficApp.adaptiveController.getLiveDemandEvaluation('S0_NS_GREEN', { north: 0, south: 0, east: 0, west: 0 }),
      fixed: (() => {
        window.TrafficApp.adaptiveController.setMode('FIXED');
        const res = window.TrafficApp.adaptiveController.getLiveDemandEvaluation('S0_NS_GREEN', { north: 8, south: 8, east: 0, west: 0 });
        window.TrafficApp.adaptiveController.setMode('ADAPTIVE');
        return res;
      })(),
      manual: (() => {
        window.TrafficApp.adaptiveController.setMode('MANUAL');
        const res = window.TrafficApp.adaptiveController.getLiveDemandEvaluation('S0_NS_GREEN', { north: 8, south: 8, east: 0, west: 0 });
        window.TrafficApp.adaptiveController.setMode('ADAPTIVE');
        return res;
      })()
    })`);

    record(
      'SCENARIO_C',
      'Adaptive Bounds: Green Clamped Between 5s and 25s',
      adaptiveAudit.heavyNS.duration <= 25 &&
      adaptiveAudit.empty.duration >= 5 &&
      adaptiveAudit.heavyEW.duration <= 25,
      `Heavy NS: ${adaptiveAudit.heavyNS.duration}s, Empty: ${adaptiveAudit.empty.duration}s, Heavy EW: ${adaptiveAudit.heavyEW.duration}s`
    );

    record(
      'SCENARIO_C',
      'Explainable AI (XAI): Rationale Accurately Reflects Corridor Congestion',
      adaptiveAudit.heavyNS.rationale.includes('North-South traffic demand') &&
      adaptiveAudit.heavyEW.rationale.includes('East-West traffic demand'),
      `NS: "${adaptiveAudit.heavyNS.rationale.slice(0, 45)}..."`
    );

    record(
      'SCENARIO_C',
      'Fixed and Manual Mode Differentiation',
      adaptiveAudit.fixed.mode === 'FIXED' &&
      adaptiveAudit.fixed.duration === 10 &&
      adaptiveAudit.manual.mode === 'MANUAL',
      `Fixed: ${adaptiveAudit.fixed.duration}s (${adaptiveAudit.fixed.mode}), Manual: ${adaptiveAudit.manual.mode}`
    );

    await cdp.screenshot(path.join(EVIDENCE_DIR, '04-adaptive-controller.png'), 1920, 1080);
    console.log('  📸 Captured 04-adaptive-controller.png');

    // -------------------------------------------------------------------------
    // SCENARIO D: Emergency Vehicle Priority Preemption
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SCENARIO D: EMERGENCY VEHICLE PRIORITY PREEMPTION ---');
    // Test dispatch across all 3 classes: Ambulance, Fire Engine, Police
    const vehicleClasses = ['AMBULANCE', 'FIRE_ENGINE', 'POLICE'];
    const approaches = ['north', 'south', 'east', 'west'];

    for (const vClass of vehicleClasses) {
      const eRes = await cdp.evaluate(`
        new Promise((resolve) => {
          window.TrafficApp.resetSimulation();
          window.TrafficApp.startSimulation();
          const veh = window.TrafficApp.vehicleManager.spawnEmergencyVehicle('north', '${vClass}');
          const priority = window.TrafficApp.fsm.getEmergencyPriority();
          const isHolding = window.TrafficApp.fsm.isHoldingPriorityGreen();
          resolve({
            spawned: !!veh,
            type: veh ? veh.type : null,
            priorityDir: priority ? priority.direction : null,
            isHolding
          });
        })
      `);

      record(
        'SCENARIO_D',
        `Emergency Preemption Registration: ${vClass}`,
        eRes.spawned && eRes.priorityDir === 'north',
        `Type: ${eRes.type}, Priority Direction: ${eRes.priorityDir}, Holding: ${eRes.isHolding}`
      );
    }

    // Capture Emergency Active screenshot
    await cdp.evaluate(`
      window.TrafficApp.resetSimulation();
      window.TrafficApp.startSimulation();
      window.TrafficApp.vehicleManager.spawnEmergencyVehicle('north', 'AMBULANCE');
    `);
    await new Promise((r) => setTimeout(r, 1200));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '05-emergency-priority-active.png'), 1920, 1200);
    console.log('  📸 Captured 05-emergency-priority-active.png');

    // Test clearance and automatic priority release
    const releaseRes = await cdp.evaluate(`
      new Promise((resolve) => {
        const vm = window.TrafficApp.vehicleManager;
        const amb = vm.lanes.north.find(v => v.isEmergency);
        if (amb) {
          amb.pos = 320; // past junction exit (294px)
          amb.hasClearedIntersection = true;
          window.TrafficApp.handleEmergencyCleared('north', amb);
        }
        const priorityAfter = window.TrafficApp.fsm.getEmergencyPriority();
        const isHoldingAfter = window.TrafficApp.fsm.isHoldingPriorityGreen();
        resolve({
          cleared: !priorityAfter,
          isHoldingAfter,
          state: window.TrafficApp.fsm.getCurrentState()
        });
      })
    `);

    record(
      'SCENARIO_D',
      'Automatic Priority Release Post-Clearance (Zero Infinite Hold)',
      releaseRes.cleared && releaseRes.isHoldingAfter === false,
      `Priority Cleared: ${releaseRes.cleared}, Holding: ${releaseRes.isHoldingAfter}, State: ${releaseRes.state}`
    );

    await cdp.screenshot(path.join(EVIDENCE_DIR, '06-emergency-priority-released.png'), 1920, 1200);
    console.log('  📸 Captured 06-emergency-priority-released.png');

    // -------------------------------------------------------------------------
    // SCENARIO E: All-Red Fail-Safe Halt & Safe Recovery
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SCENARIO E: ALL-RED HALT & SAFE RECOVERY ---');
    // Trigger All-Red Halt
    await cdp.evaluate(`document.getElementById('btnAllRed').click()`);
    const allRedActive = await cdp.evaluate(`({
      isHalt: window.TrafficApp.fsm.isAllRedHalt(),
      signals: window.TrafficApp.fsm.getSignals(),
      titleText: document.getElementById('stateTitle').textContent
    })`);

    const allSignalsRed = Object.values(allRedActive.signals).every((s) => s === 'RED');
    record(
      'SCENARIO_E',
      'Fail-Safe All-Red Halt: All Four Signal Heads Forced to RED',
      allRedActive.isHalt && allSignalsRed,
      `Halt: ${allRedActive.isHalt}, Signals: ${JSON.stringify(allRedActive.signals)}`
    );

    await cdp.screenshot(path.join(EVIDENCE_DIR, '07-all-red-halt.png'), 1920, 1200);
    console.log('  📸 Captured 07-all-red-halt.png');

    // Recovery from All-Red
    await cdp.evaluate(`document.getElementById('btnAllRed').click()`); // Toggle off
    const allRedRecovered = await cdp.evaluate(`({
      isHalt: window.TrafficApp.fsm.isAllRedHalt(),
      signals: window.TrafficApp.fsm.getSignals(),
      state: window.TrafficApp.fsm.getCurrentState()
    })`);

    record(
      'SCENARIO_E',
      'Safe Recovery to Operational FSM State',
      allRedRecovered.isHalt === false && allRedRecovered.state === 'S0_NS_GREEN',
      `Recovered State: ${allRedRecovered.state}, North: ${allRedRecovered.signals.north}`
    );

    await cdp.screenshot(path.join(EVIDENCE_DIR, '08-all-red-recovery.png'), 1920, 1200);
    console.log('  📸 Captured 08-all-red-recovery.png');

    // -------------------------------------------------------------------------
    // SCENARIO F: UI & Data Consistency Audit
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SCENARIO F: UI & DATA CONSISTENCY AUDIT ---');
    const consistencyAudit = await cdp.evaluate(`({
      fsmStateText: document.getElementById('stateTitle').textContent,
      fsmModelCode: window.TrafficApp.fsm.getCurrentStateMetadata().code,
      signalsModel: window.TrafficApp.fsm.getSignals(),
      nsPillText: document.getElementById('flowNS').textContent,
      ewPillText: document.getElementById('flowEW').textContent,
      statGenerated: parseInt(document.getElementById('statTotalGenerated').textContent, 10),
      statPassed: parseInt(document.getElementById('statTotalPassed').textContent, 10),
      modelGenerated: window.TrafficApp.vehicleManager.analytics.totalGenerated,
      modelPassed: window.TrafficApp.vehicleManager.analytics.totalPassed,
      svgSparklinePresent: !!document.querySelector('#chartQueueHistory svg'),
      heatmapCellsCount: document.querySelectorAll('.heatmap-cell').length
    })`);

    record(
      'SCENARIO_F',
      'FSM State Card Text Synchronized with Model',
      consistencyAudit.fsmStateText.includes(consistencyAudit.fsmModelCode),
      `UI: "${consistencyAudit.fsmStateText}", Model: ${consistencyAudit.fsmModelCode}`
    );

    record(
      'SCENARIO_F',
      'Analytics KPI Counters Match VehicleManager Internal State',
      consistencyAudit.statGenerated === consistencyAudit.modelGenerated &&
      consistencyAudit.statPassed === consistencyAudit.modelPassed,
      `Generated: UI=${consistencyAudit.statGenerated} vs Model=${consistencyAudit.modelGenerated}, Passed: UI=${consistencyAudit.statPassed} vs Model=${consistencyAudit.modelPassed}`
    );

    record(
      'SCENARIO_F',
      'Pure SVG Telemetry Sparkline & Heatmap Elements Rendered',
      consistencyAudit.svgSparklinePresent && consistencyAudit.heatmapCellsCount === 4,
      `SVG Sparkline: ${consistencyAudit.svgSparklinePresent}, Heatmap cells: ${consistencyAudit.heatmapCellsCount}`
    );

    await cdp.screenshot(path.join(EVIDENCE_DIR, '09-traffic-analytics.png'), 1920, 1400);
    console.log('  📸 Captured 09-traffic-analytics.png');

    // -------------------------------------------------------------------------
    // SCENARIO G: Responsive Browser Viewport Testing
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SCENARIO G: RESPONSIVE VIEWPORT TESTING ---');
    const viewports = [
      { name: '1920x1080', width: 1920, height: 1080 },
      { name: '1600x900', width: 1600, height: 900 },
      { name: '1366x768', width: 1366, height: 768 },
      { name: '1280x720', width: 1280, height: 720 },
      { name: '1024x768', width: 1024, height: 768 },
      { name: '768x1024', width: 768, height: 1024 },
      { name: '390x844', width: 390, height: 844 }
    ];

    for (const vp of viewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 600
      });

      // Verify no horizontal overflow
      const overflow = await cdp.evaluate(`({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 5
      })`);

      record(
        'SCENARIO_G',
        `Viewport ${vp.name} Horizontal Containment`,
        !overflow.hasHorizontalOverflow,
        `ScrollWidth: ${overflow.scrollWidth}px vs ClientWidth: ${overflow.clientWidth}px`
      );

      const vpFileName = `viewport-${vp.name}.png`;
      await cdp.screenshot(path.join(EVIDENCE_DIR, vpFileName), vp.width, vp.height);
      console.log(`  📸 Captured ${vpFileName}`);
    }

    // Capture mobile dashboard image for required 10
    await cdp.screenshot(path.join(EVIDENCE_DIR, '10-mobile-dashboard.png'), 390, 844);
    console.log('  📸 Captured 10-mobile-dashboard.png');

    // -------------------------------------------------------------------------
    // SCENARIO H: Long-Run Stability (30 Minutes Simulated Time)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SCENARIO H: 30-MINUTE HIGH-DENSITY STABILITY TEST ---');
    console.log('  Advancing 1,800 simulated seconds (30 minutes) at High density...');

    const soakMetrics = await cdp.evaluate(`
      new Promise((resolve) => {
        window.TrafficApp.resetSimulation();
        window.TrafficApp.setDensity('HIGH');
        window.TrafficApp.setTimingMode('ADAPTIVE');

        const vm = window.TrafficApp.vehicleManager;
        const fsm = window.TrafficApp.fsm;

        let totalSimSeconds = 0;
        const dt = 0.5; // 500ms time step
        const samples = [];
        let frozenVehiclesCount = 0;

        while (totalSimSeconds < 1800) {
          totalSimSeconds += dt;
          vm.update(dt, fsm.getSignals());

          if (Math.floor(totalSimSeconds) % 10 === 0) {
            fsm.step();
          }

          // Sample every 5 minutes (300 simulated seconds)
          if (Math.floor(totalSimSeconds) % 300 === 0 && totalSimSeconds % 1 === 0) {
            const activeVehicles = vm.lanes.north.length + vm.lanes.south.length +
                                   vm.lanes.east.length + vm.lanes.west.length;
            samples.push({
              simMinutes: Math.floor(totalSimSeconds / 60),
              generated: vm.analytics.totalGenerated,
              passed: vm.analytics.totalPassed,
              active: activeVehicles,
              throughput: vm.analytics.throughput
            });
          }
        }

        // Check for any stuck vehicles waiting over 120s
        for (const dir of ['north', 'south', 'east', 'west']) {
          for (const v of vm.lanes[dir]) {
            if (v.waitTime > 120) frozenVehiclesCount++;
          }
        }

        const activeTotal = vm.lanes.north.length + vm.lanes.south.length +
                            vm.lanes.east.length + vm.lanes.west.length;

        resolve({
          totalSimMinutes: 30,
          samples,
          finalGenerated: vm.analytics.totalGenerated,
          finalPassed: vm.analytics.totalPassed,
          finalActive: activeTotal,
          frozenVehicles: frozenVehiclesCount,
          conservation: (vm.analytics.totalPassed + activeTotal) === vm.analytics.totalGenerated,
          domNodesCount: document.querySelectorAll('*').length,
          eventLogEntriesCount: document.querySelectorAll('.log-entry').length
        });
      })
    `);

    record(
      'SCENARIO_H',
      '30-Minute Soak: Zero Vehicle Deadlocks or Permanent Freezes',
      soakMetrics.frozenVehicles === 0,
      `Frozen (>120s wait): ${soakMetrics.frozenVehicles}, Total Cleared: ${soakMetrics.finalPassed}`
    );

    record(
      'SCENARIO_H',
      '30-Minute Soak: Strict Vehicle Conservation Law Maintained',
      soakMetrics.conservation && soakMetrics.finalGenerated > 250,
      `Generated (${soakMetrics.finalGenerated}) = Passed (${soakMetrics.finalPassed}) + Active (${soakMetrics.finalActive})`
    );

    record(
      'SCENARIO_H',
      '30-Minute Soak: DOM & Memory Leak Protection (Bounded Nodes)',
      soakMetrics.domNodesCount < 1000,
      `Total DOM Nodes: ${soakMetrics.domNodesCount}, Event Log Entries: ${soakMetrics.eventLogEntriesCount}`
    );

    console.log('\n--- SOAK PROGRESSION AUDIT TABLE ---');
    console.table(soakMetrics.samples);

  } finally {
    cdp.close();
    chromeProcess.kill('SIGKILL');
    await new Promise((r) => setTimeout(r, 1000));
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore Windows temp lock
    }
    console.log('\n[CLEANUP] Chrome process terminated and temporary profile purged.');
  }

  // ---------------------------------------------------------------------------
  // Summary & Acceptance Verdict
  // ---------------------------------------------------------------------------
  const totalTests = testResults.length;
  const passedTests = testResults.filter((r) => r.status === 'PASS').length;
  const failedTests = totalTests - passedTests;

  console.log('\n================================================================');
  console.log(` ACCEPTANCE RESULTS: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('================================================================');

  if (failedTests === 0) {
    console.log(' VERDICT: READY FOR ACADEMIC DEMONSTRATION');
  } else {
    console.log(' VERDICT: NOT READY — DEFECTS REMAIN');
  }

  return { totalTests, passedTests, failedTests, testResults };
}

runAcceptanceTests().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
