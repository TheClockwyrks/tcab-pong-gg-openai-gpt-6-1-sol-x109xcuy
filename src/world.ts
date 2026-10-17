import type { UpdateApi } from "@clockwyrks/simple-2d";
import type {
  BallState,
  CaromState,
  Mode,
  ObstacleState,
  PaddleState,
  State,
} from "./game";
import * as C from "./constants";
import { fly } from "./physics";

export const clamp = (x: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, x));
export const drawSign = (): 1 | -1 => (Math.random() < 0.5 ? -1 : 1);
export const park = (): BallState => ({
  x: C.FIELD_CX,
  y: C.FIELD_CY,
  vx: 0,
  vy: 0,
  spin: 0,
  held: true,
  holdTimer: C.HOLD_TIME,
  serveSign: drawSign(),
  trail: [],
});
export function obstacle(index: number, t: number): ObstacleState {
  const base = C.OBSTACLE_CENTERS[index];
  if (!base) throw new Error(`No obstacle ${index}`);
  return {
    index,
    cx: base.x,
    cy:
      base.y +
      (index === 0 ? 1 : -1) *
        C.OBSTACLE_SWAY_AMP *
        Math.sin((2 * Math.PI * t) / C.OBSTACLE_SWAY_PERIOD),
    theta: C.OBSTACLE_SPIN_RATE * t,
  };
}
const paddle = (): PaddleState => ({
  cy: C.FIELD_CY,
  vy: 0,
  driven: false,
  drivenVy: 0,
});
export function initialState(muted = false): CaromState {
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: { left: paddle(), right: paddle() },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: park(),
    obstacles: C.OBSTACLE_CENTERS.map((_, i) => obstacle(i, 0)),
    obstacleClock: 0,
    obstacleClockRunning: true,
    simTime: 0,
    muted,
  };
}
export function toTitle(s: State): CaromState {
  return {
    ...initialState(s.muted),
    titleIndex: s.titleIndex,
    menuIndex: s.titleIndex,
    simTime: s.simTime,
  };
}
export function startMatch(s: State, mode: Mode): CaromState {
  return {
    ...s,
    mode,
    screen: "countdown",
    resumeScreen: "playing",
    menuIndex: 0,
    score: { p1: 0, p2: 0 },
    winner: null,
    receiver: "left",
    ball: park(),
    paddles: {
      left: { ...s.paddles.left, cy: C.FIELD_CY, vy: 0 },
      right: { ...s.paddles.right, cy: C.FIELD_CY, vy: 0 },
    },
    obstacleClock: 0,
    obstacleClockRunning: true,
    obstacles: s.obstacles.map((o) => obstacle(o.index, 0)),
  };
}
export function integrate(p: PaddleState, vy: number, dt: number): PaddleState {
  const raw = p.cy + vy * dt,
    cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: raw !== cy && dt > 0 ? (cy - p.cy) / dt : vy };
}
function move(
  s: State,
  input: UpdateApi["input"],
  dt: number,
): CaromState["paddles"] {
  const held = (n: string) => input.value(n) > 0;
  const solo = s.mode === "solo";
  const leftVy =
    (Number(held("p1-down") || (solo && held("p2-down"))) -
      Number(held("p1-up") || (solo && held("p2-up")))) *
    C.PADDLE_SPEED;
  let rightVy =
    (Number(held("p2-down")) - Number(held("p2-up"))) * C.PADDLE_SPEED;
  if (solo) {
    let target = C.AI_HOME_Y,
      zone = C.AI_HOME_DEADZONE;
    if (s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0) {
      target = s.ball.y - s.ball.vy * C.AI_REACT;
      zone = C.AI_DEADZONE;
    }
    const diff = target - s.paddles.right.cy;
    rightVy =
      !s.ai.movement || Math.abs(diff) <= zone || dt <= 0
        ? 0
        : Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt);
  }
  return {
    left: integrate(
      s.paddles.left,
      s.paddles.left.driven ? s.paddles.left.drivenVy : leftVy,
      dt,
    ),
    right: integrate(
      s.paddles.right,
      s.paddles.right.driven ? s.paddles.right.drivenVy : rightVy,
      dt,
    ),
  };
}
export function advanceWorld(
  s: State,
  input: UpdateApi["input"],
  dt: number,
): { state: CaromState; cues: Set<C.CueName> } {
  const cues = new Set<C.CueName>();
  if (s.screen !== "playing" && s.screen !== "countdown")
    return { state: s, cues };
  let next: CaromState = { ...s, paddles: move(s, input, dt) };
  let ball = s.ball;
  if (ball) {
    if (s.screen === "countdown") {
      const holdTimer = Math.max(0, ball.holdTimer - dt);
      ball = { ...ball, holdTimer };
      if (holdTimer <= 0) {
        ball = {
          ...ball,
          held: false,
          vx:
            (s.receiver === "left" ? -1 : 1) *
            C.SERVE_SPEED *
            Math.cos(C.SERVE_ANGLE),
          vy: ball.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
          trail: [],
        };
        next = { ...next, screen: "playing" };
      }
    } else if (!ball.held)
      ball = fly(ball, next.paddles, s.obstacles, dt, cues);
    ball = {
      ...ball,
      trail: [...ball.trail, { x: ball.x, y: ball.y, t: s.simTime }].filter(
        (p) => s.simTime - p.t <= C.TRAIL_TIME,
      ),
    };
  }
  const clock = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  next = {
    ...next,
    ball,
    obstacleClock: clock,
    obstacles: s.obstacles.map((o) => obstacle(o.index, clock)),
  };
  if (
    s.screen === "playing" &&
    ball &&
    !ball.held &&
    (ball.x - C.BALL_R > C.FIELD_W || ball.x + C.BALL_R < 0)
  ) {
    cues.add(C.CUES.score);
    const left = ball.x > C.FIELD_CX;
    const score = {
      p1: s.score.p1 + Number(left),
      p2: s.score.p2 + Number(!left),
    };
    if (
      (score.p1 >= C.WIN_SCORE && score.p1 - score.p2 >= C.WIN_LEAD) ||
      (score.p2 >= C.WIN_SCORE && score.p2 - score.p1 >= C.WIN_LEAD)
    )
      next = {
        ...next,
        score,
        winner: left ? "left" : "right",
        screen: "matchover",
        menuIndex: 0,
      };
    else
      next = {
        ...next,
        score,
        ball: park(),
        receiver: left ? "right" : "left",
        screen: "countdown",
      };
  }
  return { state: next, cues };
}
