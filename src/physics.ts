import * as C from "./constants";
import type { BallState, CaromState, ObstacleState } from "./game";
import { clamp } from "./world";

type Flight = { x: number; y: number; vx: number; vy: number; spin: number };
/** Expanded rectangle contacts, with deterministic face tie-breaking. */
function hitPaddle(
  b: Flight,
  x0: number,
  x1: number,
  cy: number,
  pvy: number,
  dir: number,
  cues: Set<C.CueName>,
): void {
  const y0 = cy - C.PADDLE_HALF,
    y1 = cy + C.PADDLE_HALF,
    r = C.BALL_R;
  if (!(b.x > x0 - r && b.x < x1 + r && b.y > y0 - r && b.y < y1 + r)) return;
  const depths = [b.x - (x0 - r), x1 + r - b.x, b.y - (y0 - r), y1 + r - b.y];
  const face = depths.indexOf(Math.min(...depths));
  if (face < 2) {
    const speed = Math.min(Math.hypot(b.vx, b.vy) * C.SPEED_MULT, C.SPEED_CAP);
    const angle = clamp((b.y - cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
    b.vx = dir * speed * Math.cos(angle);
    b.vy = speed * Math.sin(angle);
    b.spin = clamp(
      b.spin + pvy * C.SPIN_FROM_PADDLE,
      -C.SPIN_CLAMP,
      C.SPIN_CLAMP,
    );
    b.x = (dir === 1 ? C.P1_X1 : C.P2_X0) + dir * r;
    cues.add(C.CUES.paddleHit);
  } else {
    b.y = face === 2 ? y0 - r : y1 + r;
    if ((face === 2 && b.vy > 0) || (face === 3 && b.vy < 0)) {
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
  }
}
/** Resolve in local axes, then transform the separating normal to world space. */
function hitObstacle(b: Flight, o: ObstacleState, cues: Set<C.CueName>): void {
  const c = Math.cos(o.theta),
    s = Math.sin(o.theta),
    dx = b.x - o.cx,
    dy = b.y - o.cy;
  const lx = dx * c + dy * s,
    ly = -dx * s + dy * c;
  const qx = clamp(lx, -C.OBSTACLE_HW, C.OBSTACLE_HW),
    qy = clamp(ly, -C.OBSTACLE_HH, C.OBSTACLE_HH);
  const ax = lx - qx,
    ay = ly - qy,
    d = Math.hypot(ax, ay);
  if (d >= C.BALL_R) return;
  let nx: number, ny: number, depth: number;
  if (d > 0) {
    nx = ax / d;
    ny = ay / d;
    depth = C.BALL_R - d;
  } else {
    const px = C.OBSTACLE_HW - Math.abs(lx),
      py = C.OBSTACLE_HH - Math.abs(ly);
    if (px <= py) {
      nx = lx < 0 ? -1 : 1;
      ny = 0;
      depth = px + C.BALL_R;
    } else {
      nx = 0;
      ny = ly < 0 ? -1 : 1;
      depth = py + C.BALL_R;
    }
  }
  const wx = nx * c - ny * s,
    wy = nx * s + ny * c,
    dot = b.vx * wx + b.vy * wy;
  if (dot < 0) {
    b.vx -= 2 * dot * wx;
    b.vy -= 2 * dot * wy;
    cues.add(C.CUES.obstacleBounce);
  }
  b.x += wx * depth;
  b.y += wy * depth;
}
export function fly(
  ball: BallState,
  paddles: CaromState["paddles"],
  obstacles: readonly ObstacleState[],
  dt: number,
  cues: Set<C.CueName>,
): BallState {
  const b: Flight = { ...ball };
  const n = Math.max(
      1,
      Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
    ),
    h = dt / n;
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const a = (b.spin / speed) * h,
        c = Math.cos(a),
        s = Math.sin(a),
        vx = b.vx;
      b.vx = vx * c - b.vy * s;
      b.vy = vx * s + b.vy * c;
    }
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
    hitPaddle(b, C.P1_X0, C.P1_X1, paddles.left.cy, paddles.left.vy, 1, cues);
    hitPaddle(
      b,
      C.P2_X0,
      C.P2_X1,
      paddles.right.cy,
      paddles.right.vy,
      -1,
      cues,
    );
    for (const o of obstacles) hitObstacle(b, o, cues);
  }
  return { ...ball, ...b };
}
