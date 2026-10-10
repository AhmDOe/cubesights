/**
 * Importing this module (rather than ./registry directly) guarantees every planner -- the real
 * kociemba one and the six stubs -- has registered itself before getPlanner()/listPlanners() is
 * called. ./registry registers its stubs as a side effect of being loaded; ./kociemba does the
 * same for the real planner. This file is what ties both side effects together for consumers.
 */
import "./kociemba";

export { getPlanner, listPlanners, NotImplementedError, registerPlanner } from "./registry";
export type { MethodCapabilities, MethodPlanner, PlanOptions } from "./registry";
