---
"@underlying/core": minor
---

Custom physics. Spring, decay, and tween were always presets over one primitive - a `Simulation`: an acceleration plus a rest condition over a (position, velocity) state. That primitive is now public. `value.simulate(simulation, options?)` drives any value with your own acceleration on the same fixed-timestep clock, fully interruptible and velocity-conserving like every other mode - bring gravity, a force field, a damped bounce, a pendulum. The `Simulation` and `SimulationState` types ship from the main entry; the low-level `stepSimulation` and `SIMULATION_TIMESTEP_S` ship from a new `@underlying/core/physics` subpath for fully manual loops (a canvas particle system, confetti, a Physics2D field) that are not bound to an Animatable. Nothing else changes; spring/decay/to are unchanged sugar over the same step.
