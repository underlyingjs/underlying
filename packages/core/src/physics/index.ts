// The low-level physics toolkit: the Simulation primitive and the single
// semi-implicit Euler step the whole engine runs on. Import these to build a
// fully custom loop (a canvas particle system, confetti, a 2D physics field)
// that is not bound to an Animatable. For physics bound to a value, prefer
// `value.simulate(simulation)` on the main entry.
export { SIMULATION_TIMESTEP_S, stepSimulation } from './simulation'
export type { Simulation, SimulationState } from './simulation'
