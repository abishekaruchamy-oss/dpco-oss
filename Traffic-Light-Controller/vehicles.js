/**
 * Vehicle Simulation Engine for 4-Way Traffic Light Controller
 *
 * Models physical vehicle dynamics, approaching from North, South, East, and West.
 * Features:
 * - Anti-collision following logic & queuing discipline (strictly non-overlapping)
 * - Red light stopping & Green light traversal
 * - Traffic density modes: LOW, MEDIUM, HIGH
 * - Real-time traffic analytics (generated, passed, queue lengths, avg wait time, throughput)
 * - Safe fail-safe halt handling & intersection clearance protection
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.VehicleManager = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DENSITY_MODES = Object.freeze({
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH'
  });

  const DENSITY_CONFIGS = Object.freeze({
    [DENSITY_MODES.LOW]: {
      name: 'Low Traffic',
      spawnInterval: 4.5, // seconds between spawn attempts per lane
      variance: 1.5,
      maxPerLane: 3
    },
    [DENSITY_MODES.MEDIUM]: {
      name: 'Medium Traffic',
      spawnInterval: 2.8,
      variance: 0.8,
      maxPerLane: 5
    },
    [DENSITY_MODES.HIGH]: {
      name: 'High Traffic',
      spawnInterval: 1.4,
      variance: 0.4,
      maxPerLane: 8
    }
  });

  const VEHICLE_COLORS = [
    '#38bdf8', // Sky Blue
    '#34d399', // Emerald
    '#fbbf24', // Amber
    '#f43f5e', // Rose
    '#a78bfa', // Purple
    '#e2e8f0', // Silver
    '#fb923c'  // Orange
  ];

  const CONSTANTS = Object.freeze({
    CAR_LENGTH: 26,
    CAR_WIDTH: 14,
    MIN_GAP: 12,
    SAFE_FOLLOW_DIST: 38, // CAR_LENGTH + MIN_GAP
    STOP_LINE_POS: 138,
    JUNCTION_ENTRY: 146,
    JUNCTION_EXIT: 294,
    DESPAWN_POS: 460,
    MAX_SPEED: 70, // pixels per second
    ACCEL: 95,
    BRAKE: 150
  });

  class Vehicle {
    /**
     * @param {number} id
     * @param {string} direction 'north' | 'south' | 'east' | 'west'
     * @param {string} color
     */
    constructor(id, direction, color) {
      this.id = id;
      this.direction = direction;
      this.color = color;
      this.pos = -30; // Starts off-canvas
      this.speed = 0;
      this.targetSpeed = CONSTANTS.MAX_SPEED;
      this.hasClearedStopLine = false;
      this.waitTime = 0; // Cumulative wait time in queue in seconds
      this.isWaiting = false;
      this.domElement = null;
    }

    /**
     * Compute actual canvas coordinates (x, y) and CSS rotation based on 1D progress pos
     */
    getCanvasCoords() {
      let x = 0;
      let y = 0;
      let rotation = 0;

      switch (this.direction) {
        case 'north':
          x = 185;
          y = this.pos;
          rotation = 180;
          break;
        case 'south':
          x = 255;
          y = 440 - this.pos;
          rotation = 0;
          break;
        case 'west':
          x = this.pos;
          y = 185;
          rotation = 90;
          break;
        case 'east':
          x = 440 - this.pos;
          y = 255;
          rotation = 270;
          break;
      }

      return { x, y, rotation };
    }
  }

  class VehicleManager {
    /**
     * @param {Object} options
     */
    constructor(options = {}) {
      this.densityMode = options.densityMode || DENSITY_MODES.MEDIUM;
      this.autoSpawn = options.autoSpawn !== false;
      this.lanes = {
        north: [],
        south: [],
        east: [],
        west: []
      };

      this.spawnTimers = {
        north: 0,
        south: 0.6,
        east: 1.2,
        west: 1.8
      };

      this.nextVehicleId = 1;
      this.totalSimulationTime = 0;

      // Analytics
      this.analytics = {
        totalGenerated: 0,
        totalPassed: 0,
        totalWaitTimeAccumulator: 0,
        vehiclesWaitCount: 0,
        avgWaitTime: 0,
        queueLengths: { north: 0, south: 0, east: 0, west: 0 },
        throughput: 0 // vehicles per minute
      };

      this.containerElement = options.containerElement || null;
    }

    /**
     * Set Traffic Density Mode (LOW, MEDIUM, HIGH)
     */
    setDensityMode(mode) {
      if (!DENSITY_CONFIGS[mode]) {
        throw new Error(`Invalid density mode: ${mode}`);
      }
      this.densityMode = mode;
    }

    getDensityConfig() {
      return DENSITY_CONFIGS[this.densityMode];
    }

    /**
     * Reset simulation state & analytics
     */
    reset() {
      // Remove DOM elements
      Object.keys(this.lanes).forEach((dir) => {
        this.lanes[dir].forEach((v) => {
          if (v.domElement && v.domElement.parentNode) {
            v.domElement.parentNode.removeChild(v.domElement);
          }
        });
        this.lanes[dir] = [];
        this.spawnTimers[dir] = Math.random() * 2;
      });

      this.nextVehicleId = 1;
      this.totalSimulationTime = 0;

      this.analytics = {
        totalGenerated: 0,
        totalPassed: 0,
        totalWaitTimeAccumulator: 0,
        vehiclesWaitCount: 0,
        avgWaitTime: 0,
        queueLengths: { north: 0, south: 0, east: 0, west: 0 },
        throughput: 0
      };
    }

    /**
     * Spawn a vehicle in the specified lane if capacity and spacing permit
     */
    spawnVehicle(direction) {
      const lane = this.lanes[direction];
      const config = this.getDensityConfig();

      if (lane.length >= config.maxPerLane) {
        return null;
      }

      // Check if entry of lane has enough clearance from last spawned car
      if (lane.length > 0) {
        const lastCar = lane[lane.length - 1];
        if (lastCar.pos < CONSTANTS.SAFE_FOLLOW_DIST - 10) {
          return null; // Entry point blocked
        }
      }

      const color = VEHICLE_COLORS[(this.nextVehicleId - 1) % VEHICLE_COLORS.length];
      const vehicle = new Vehicle(this.nextVehicleId++, direction, color);

      // Create DOM element if container is attached
      if (this.containerElement && typeof document !== 'undefined') {
        const el = document.createElement('div');
        el.className = 'sim-vehicle';
        el.style.backgroundColor = color;
        el.id = `veh-${vehicle.id}`;
        this.containerElement.appendChild(el);
        vehicle.domElement = el;
      }

      lane.push(vehicle);
      this.analytics.totalGenerated++;
      return vehicle;
    }

    /**
     * Determine if intersection central collision zone currently has vehicles from the conflicting axis
     */
    isConflictingAxisInIntersection(direction) {
      const isNorthSouth = direction === 'north' || direction === 'south';
      const conflictingLanes = isNorthSouth
        ? [this.lanes.east, this.lanes.west]
        : [this.lanes.north, this.lanes.south];

      for (let i = 0; i < conflictingLanes.length; i++) {
        const lane = conflictingLanes[i];
        for (let j = 0; j < lane.length; j++) {
          const v = lane[j];
          if (v.pos >= CONSTANTS.JUNCTION_ENTRY && v.pos <= CONSTANTS.JUNCTION_EXIT) {
            return true; // Conflicting vehicle is inside the junction box
          }
        }
      }
      return false;
    }

    /**
     * Advance vehicle physics by deltaTime seconds
     * @param {number} dt Delta time in seconds
     * @param {Object} signals { north, south, east, west }
     * @param {boolean} [isPaused=false]
     */
    update(dt, signals, isPaused = false) {
      if (isPaused) {
        // Render current state without advancing physics
        this.renderAll();
        return;
      }

      this.totalSimulationTime += dt;
      const config = this.getDensityConfig();

      // 1. Spawning Loop
      if (this.autoSpawn) {
        const directions = ['north', 'south', 'east', 'west'];
        directions.forEach((dir) => {
          this.spawnTimers[dir] += dt;
          const targetInterval = config.spawnInterval + (Math.sin(this.totalSimulationTime + dir.length) * config.variance);
          if (this.spawnTimers[dir] >= targetInterval) {
            this.spawnVehicle(dir);
            this.spawnTimers[dir] = 0;
          }
        });
      }

      // 2. Physics & Queuing Update for Each Lane
      const directions = ['north', 'south', 'east', 'west'];
      directions.forEach((dir) => {
        const lane = this.lanes[dir];
        const signalColor = signals ? signals[dir] : 'RED';
        let currentQueueCount = 0;

        for (let i = 0; i < lane.length; i++) {
          const vehicle = lane[i];
          const isLead = (i === 0);
          const leader = isLead ? null : lane[i - 1];

          // Compute target stopping position
          let allowedStopPos = CONSTANTS.DESPAWN_POS;

          if (isLead) {
            if (vehicle.hasClearedStopLine) {
              // Once legitimately cleared, proceed through to clear intersection
              allowedStopPos = CONSTANTS.DESPAWN_POS;
            } else {
              if (signalColor === 'RED' || signalColor === 'YELLOW') {
                allowedStopPos = CONSTANTS.STOP_LINE_POS;
              } else if (signalColor === 'GREEN') {
                if (this.isConflictingAxisInIntersection(dir)) {
                  allowedStopPos = CONSTANTS.STOP_LINE_POS;
                } else {
                  allowedStopPos = CONSTANTS.DESPAWN_POS;
                }
              }
            }
          } else {
            // Following vehicle must strictly respect safe following distance behind leader
            const leaderStopLimit = leader.pos - CONSTANTS.SAFE_FOLLOW_DIST;
            allowedStopPos = Math.min(allowedStopPos, leaderStopLimit);

            if (!vehicle.hasClearedStopLine && (signalColor === 'RED' || signalColor === 'YELLOW')) {
              allowedStopPos = Math.min(allowedStopPos, CONSTANTS.STOP_LINE_POS);
            }
          }

          // Distance to target stop position
          const distanceToStop = allowedStopPos - vehicle.pos;

          if (distanceToStop <= 0.5) {
            vehicle.speed = Math.max(0, vehicle.speed - CONSTANTS.BRAKE * dt);
            if (vehicle.speed < 1) vehicle.speed = 0;
          } else if (distanceToStop < 35) {
            const decelSpeed = Math.sqrt(2 * CONSTANTS.BRAKE * Math.max(0, distanceToStop - 1));
            vehicle.targetSpeed = Math.min(CONSTANTS.MAX_SPEED, decelSpeed);
            if (vehicle.speed > vehicle.targetSpeed) {
              vehicle.speed = Math.max(vehicle.targetSpeed, vehicle.speed - CONSTANTS.BRAKE * dt);
            } else {
              vehicle.speed = Math.min(vehicle.targetSpeed, vehicle.speed + CONSTANTS.ACCEL * dt);
            }
          } else {
            vehicle.targetSpeed = CONSTANTS.MAX_SPEED;
            vehicle.speed = Math.min(CONSTANTS.MAX_SPEED, vehicle.speed + CONSTANTS.ACCEL * dt);
          }

          // Advance position with strict boundary clamping
          const nextPos = vehicle.pos + vehicle.speed * dt;
          if (allowedStopPos !== CONSTANTS.DESPAWN_POS && nextPos >= allowedStopPos) {
            vehicle.pos = allowedStopPos;
            vehicle.speed = 0;
          } else {
            vehicle.pos = nextPos;
          }

          if (vehicle.pos >= CONSTANTS.STOP_LINE_POS && allowedStopPos === CONSTANTS.DESPAWN_POS) {
            vehicle.hasClearedStopLine = true;
          }

          // Track waiting time and queue status
          if (vehicle.pos <= CONSTANTS.STOP_LINE_POS + 2) {
            if (vehicle.speed < 8) {
              vehicle.isWaiting = true;
              vehicle.waitTime += dt;
              currentQueueCount++;
            } else {
              vehicle.isWaiting = false;
            }
          } else {
            // Vehicle crossed stop line
            if (!vehicle.hasClearedStopLine) {
              vehicle.hasClearedStopLine = true;
              vehicle.isWaiting = false;
              if (vehicle.waitTime > 0.2) {
                this.analytics.totalWaitTimeAccumulator += vehicle.waitTime;
                this.analytics.vehiclesWaitCount++;
                this.analytics.avgWaitTime = (
                  this.analytics.totalWaitTimeAccumulator / this.analytics.vehiclesWaitCount
                );
              }
            }
          }
        }

        this.analytics.queueLengths[dir] = currentQueueCount;

        // 3. Despawn vehicles that exited the intersection
        while (lane.length > 0 && lane[0].pos >= CONSTANTS.DESPAWN_POS) {
          const exited = lane.shift();
          this.analytics.totalPassed++;
          if (exited.domElement && exited.domElement.parentNode) {
            exited.domElement.parentNode.removeChild(exited.domElement);
          }
        }
      });

      // 4. Update throughput (vehicles passed per minute)
      if (this.totalSimulationTime > 3) {
        this.analytics.throughput = Math.round((this.analytics.totalPassed / this.totalSimulationTime) * 60);
      } else {
        this.analytics.throughput = 0;
      }

      // Render positions to DOM
      this.renderAll();
    }

    /**
     * Render vehicle positions, rotations, and styles
     */
    renderAll() {
      if (!this.containerElement || typeof document === 'undefined') return;

      const directions = ['north', 'south', 'east', 'west'];
      directions.forEach((dir) => {
        const lane = this.lanes[dir];
        lane.forEach((v) => {
          if (!v.domElement) return;
          const { x, y, rotation } = v.getCanvasCoords();
          // Center anchor transformation
          v.domElement.style.transform = `translate(${x - CONSTANTS.CAR_WIDTH / 2}px, ${y - CONSTANTS.CAR_LENGTH / 2}px) rotate(${rotation}deg)`;
        });
      });
    }

    /**
     * Get current snapshot of traffic analytics
     */
    getAnalytics() {
      return {
        ...this.analytics,
        queueTotal: (
          this.analytics.queueLengths.north +
          this.analytics.queueLengths.south +
          this.analytics.queueLengths.east +
          this.analytics.queueLengths.west
        )
      };
    }
  }

  VehicleManager.DENSITY_MODES = DENSITY_MODES;
  VehicleManager.DENSITY_CONFIGS = DENSITY_CONFIGS;
  VehicleManager.CONSTANTS = CONSTANTS;
  VehicleManager.Vehicle = Vehicle;

  return VehicleManager;
});
