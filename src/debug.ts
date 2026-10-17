import type {
  BallState,
  CaromState,
  Mode,
  Screen,
  Side,
  State,
  PaddleState,
} from "./game";
import { initialState, obstacle, park, drawSign } from "./world";
import { menuItemRect } from "./controls";
import { CAROM_DEBUG_VERSION } from "./constants";
function ballPatch(s: State, patch: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("No ball on the field");
  return { ...s, ball: { ...s.ball, ...patch } };
}
function paddlePatch(
  s: State,
  side: Side,
  patch: Partial<PaddleState>,
): CaromState {
  return {
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], ...patch } },
  };
}
export function createDebug() {
  return {
    version: CAROM_DEBUG_VERSION,
    clearWorld: (s: State): CaromState => ({ ...s, ball: null, obstacles: [] }),
    spawnBall: (s: State): CaromState => ({ ...s, ball: park() }),
    spawnObstacle: (s: State, index: number): CaromState => ({
      ...s,
      obstacles: [
        ...s.obstacles.filter((o) => o.index !== index),
        obstacle(index, s.obstacleClock),
      ].sort((a, b) => a.index - b.index),
    }),
    reset: (s: State): CaromState => initialState(s.muted),
    reconcile: (s: State): CaromState => ({
      ...s,
      obstacles: s.obstacles.map((o) => obstacle(o.index, s.obstacleClock)),
    }),
    setScreen: (s: State, screen: Screen): CaromState => ({ ...s, screen }),
    setMode: (s: State, mode: Mode): CaromState => ({ ...s, mode }),
    setMenuIndex: (s: State, menuIndex: number): CaromState => ({
      ...s,
      menuIndex,
    }),
    setTitleIndex: (s: State, titleIndex: number): CaromState => ({
      ...s,
      titleIndex,
    }),
    setResumeScreen: (
      s: State,
      resumeScreen: "countdown" | "playing",
    ): CaromState => ({ ...s, resumeScreen }),
    setScore: (s: State, p1: number, p2: number): CaromState => ({
      ...s,
      score: { p1, p2 },
    }),
    setWinner: (s: State, winner: Side | null): CaromState => ({
      ...s,
      winner,
    }),
    setReceiver: (s: State, receiver: Side): CaromState => ({ ...s, receiver }),
    setPaddleCy: (s: State, side: Side, cy: number) =>
      paddlePatch(s, side, { cy }),
    setPaddleVy: (s: State, side: Side, drivenVy: number) =>
      paddlePatch(s, side, { drivenVy }),
    setPaddleDriven: (s: State, side: Side, driven: boolean) =>
      paddlePatch(s, side, { driven }),
    setBallPosition: (s: State, x: number, y: number) => ballPatch(s, { x, y }),
    setBallVelocity: (s: State, vx: number, vy: number) =>
      ballPatch(s, { vx, vy }),
    setBallSpin: (s: State, spin: number) => ballPatch(s, { spin }),
    setBallHeld: (s: State, held: boolean) => ballPatch(s, { held }),
    setBallHoldTimer: (s: State, holdTimer: number) =>
      ballPatch(s, { holdTimer }),
    setBallServeSign: (s: State, serveSign: 1 | -1) =>
      ballPatch(s, { serveSign }),
    drawBallServeSign: (s: State) => ballPatch(s, { serveSign: drawSign() }),
    setAiTracking: (s: State, tracking: boolean): CaromState => ({
      ...s,
      ai: { ...s.ai, tracking },
    }),
    setAiMovement: (s: State, movement: boolean): CaromState => ({
      ...s,
      ai: { ...s.ai, movement },
    }),
    setMuted: (s: State, muted: boolean): CaromState => ({ ...s, muted }),
    setObstacleClock: (s: State, obstacleClock: number): CaromState => ({
      ...s,
      obstacleClock,
      obstacles: s.obstacles.map((o) => obstacle(o.index, obstacleClock)),
    }),
    setObstacleClockRunning: (
      s: State,
      obstacleClockRunning: boolean,
    ): CaromState => ({ ...s, obstacleClockRunning }),
    snapshot: (s: State) => ({
      ...s,
      version: CAROM_DEBUG_VERSION,
      ball: s.ball
        ? { ...s.ball, speed: Math.hypot(s.ball.vx, s.ball.vy) }
        : null,
    }),
    menuItemRect,
  };
}
