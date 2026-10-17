import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import type { Engine } from "@clockwyrks/simple-2d";
import { game } from "./game";
import type { CaromDebugApi, CaromState } from "./game";
import * as C from "./constants";

const engines: Engine<CaromState, CaromDebugApi>[] = [];
afterEach(() => {
  engines.forEach((e) => e.destroy());
  engines.length = 0;
});
async function setup(ms = 8) {
  const target = new EventTarget();
  const engine = createEngine({
    canvas: createCanvas(C.FIELD_W, C.FIELD_H) as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    game,
    layout: C.LAYOUT,
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  engines.push(engine);
  await engine.initialize();
  const d = engine.debug;
  const key = (code: string, type = "keydown") =>
    target.dispatchEvent(
      Object.assign(new Event(type), { code, repeat: false }),
    );
  const tap = async (code: string) => {
    key(code);
    await engine.advance(1);
    key(code, "keyup");
  };
  const pointer = (
    type: string,
    x: number,
    y: number,
    id = 1,
    device = "mouse",
  ) =>
    target.dispatchEvent(
      Object.assign(new Event(type), {
        clientX: x,
        clientY: y,
        pointerId: id,
        pointerType: device,
        isPrimary: id === 1,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
      }),
    );
  const flight = (x: number, y: number, vx: number, vy = 0) => {
    engine.apply((s) => d.clearWorld(s));
    engine.apply((s) => d.spawnBall(s));
    engine.apply((s) => d.setBallPosition(s, x, y));
    engine.apply((s) => d.setBallVelocity(s, vx, vy));
    engine.apply((s) => d.setBallHeld(s, false));
    engine.apply((s) => d.setScreen(s, "playing"));
  };
  return { engine, d, key, tap, pointer, flight };
}
describe("menus, input and the engine", () => {
  it("initializes the complete title, registers pure diagnostics and draws", async () => {
    const { engine, d } = await setup();
    const s = d.snapshot(engine.state);
    expect(s.screen).toBe("title");
    expect(s.ball?.held).toBe(true);
    expect(s.obstacles).toHaveLength(2);
    expect(s.version).toBe(C.CAROM_DEBUG_VERSION);
    const before = engine.state;
    expect(engine.diagnostics().every((v) => v.error === undefined)).toBe(true);
    expect(engine.state).toBe(before);
    await engine.advance(1);
    expect(engine.state.simTime).toBeCloseTo(0.008);
    expect(engine.state.obstacleClock).toBe(0);
  });
  it("wraps menus, gives movement priority, and remembers title selection", async () => {
    const { engine, tap, key } = await setup();
    await tap("KeyW");
    expect(engine.state.menuIndex).toBe(2);
    key("KeyS");
    key("Enter");
    await engine.advance(1);
    key("KeyS", "keyup");
    key("Enter", "keyup");
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(0);
    await tap("ArrowDown");
    await tap("Enter");
    expect(engine.state.mode).toBe("versus");
    expect(engine.state.titleIndex).toBe(1);
    await tap("Escape");
    expect(engine.state.screen).toBe("paused");
    await tap("KeyW");
    await tap("Enter");
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
  });
  it("opens and leaves instructions with confirm or back", async () => {
    const { engine, tap } = await setup();
    await tap("KeyW");
    await tap("Enter");
    expect(engine.state.screen).toBe("howto");
    await tap("Enter");
    expect(engine.state.menuIndex).toBe(2);
    await tap("Enter");
    await tap("Escape");
    expect(engine.state.screen).toBe("title");
  });
  it("pauses exactly once on Escape and freezes the entire field", async () => {
    const { engine, tap } = await setup();
    await tap("Enter");
    await engine.advance(130);
    await tap("Escape");
    const s = engine.state;
    await engine.advance(50);
    expect(engine.state.ball).toEqual(s.ball);
    expect(engine.state.paddles).toEqual(s.paddles);
    expect(engine.state.obstacleClock).toBe(s.obstacleClock);
    expect(engine.state.simTime).toBeGreaterThan(s.simTime);
    await tap("Escape");
    expect(engine.state.screen).toBe("playing");
  });
  it("restarts from pause and toggles mute from every screen", async () => {
    const { engine, tap, d } = await setup();
    for (const screen of [
      "title",
      "howto",
      "countdown",
      "playing",
      "paused",
      "matchover",
    ] as const) {
      engine.apply((s) => d.setScreen(s, screen));
      const muted = engine.state.muted;
      await tap("KeyM");
      expect(engine.state.muted).toBe(!muted);
    }
    engine.apply((s) => d.setScreen(s, "paused"));
    await tap("KeyS");
    await tap("Enter");
    expect(engine.state.score).toEqual({ p1: 0, p2: 0 });
    expect(engine.state.screen).toBe("countdown");
  });
  it.each(["mouse", "touch"])(
    "confirms a %s gesture across frames and on one frame",
    async (device) => {
      const { engine, pointer, d } = await setup();
      const r = d.menuItemRect(engine.state, 1)!;
      pointer("pointerdown", r.x + 20, r.y + 20, 1, device);
      await engine.advance(1);
      expect(engine.state.menuIndex).toBe(1);
      pointer("pointerup", r.x + 20, r.y + 20, 1, device);
      await engine.advance(1);
      expect(engine.state.mode).toBe("versus");
      engine.apply((s) => d.reset(s));
      const h = d.menuItemRect(engine.state, 2)!;
      pointer("pointerdown", h.x + 5, h.y + 5, 1, device);
      pointer("pointerup", h.x + 5, h.y + 5, 1, device);
      await engine.advance(1);
      expect(engine.state.screen).toBe("howto");
    },
  );
  it("does not confirm mismatched press/release regions", async () => {
    const { engine, pointer } = await setup();
    pointer("pointerdown", 500, 380);
    await engine.advance(1);
    pointer("pointerup", 500, 450);
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
  });
  it("keyboard confirm wins over a simultaneous pointer confirm", async () => {
    const { engine, pointer, key } = await setup();
    key("Enter");
    pointer("pointerdown", 500, 450);
    pointer("pointerup", 500, 450);
    await engine.advance(1);
    expect(engine.state.mode).toBe("solo");
  });
});
describe("render-free simulation through counted engine frames", () => {
  it("counts the hold, moves paddles, serves with the posed sign, but does not fly that frame", async () => {
    const { engine, d, key } = await setup(10);
    engine.apply((s) => d.setScreen(s, "countdown"));
    engine.apply((s) => d.setBallHoldTimer(s, 0.01));
    engine.apply((s) => d.setBallServeSign(s, -1));
    key("KeyS");
    await engine.advance(1);
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.ball?.x).toBe(C.FIELD_CX);
    expect(engine.state.ball?.vy).toBeLessThan(0);
    expect(engine.state.paddles.left.cy).toBeCloseTo(C.FIELD_CY + 7.2);
    expect(
      Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
    ).toBeCloseTo(C.SERVE_SPEED);
  });
  it("integrates driven paddles and reports actual velocity at the bound", async () => {
    const { engine, d } = await setup();
    engine.apply((s) => d.setScreen(s, "playing"));
    engine.apply((s) => d.setPaddleVy(s, "left", C.PADDLE_SPEED));
    expect(engine.state.paddles.left.vy).toBe(0);
    engine.apply((s) => d.setPaddleDriven(s, "left", true));
    await engine.advance(100);
    expect(engine.state.paddles.left.cy).toBe(C.PADDLE_MAX_CY);
    expect(engine.state.paddles.left.vy).toBe(0);
    expect(engine.state.paddles.left.drivenVy).toBe(C.PADDLE_SPEED);
  });
  it("uses all movement keys for Solo but independent keys in Versus", async () => {
    const { engine, d, key } = await setup(10);
    engine.apply((s) => d.setScreen(s, "countdown"));
    key("ArrowDown");
    await engine.advance(1);
    expect(engine.state.paddles.left.cy).toBeCloseTo(367.2);
    expect(engine.state.paddles.right.cy).toBe(C.FIELD_CY);
    engine.apply((s) => d.setMode(s, "versus"));
    await engine.advance(1);
    expect(engine.state.paddles.right.cy).toBeCloseTo(367.2);
  });
  it("gates AI tracking and movement independently", async () => {
    const { engine, d, flight } = await setup();
    flight(950, 580, 400, 50);
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(C.AI_SPEED);
    engine.apply((s) => d.setAiMovement(s, false));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(0);
    engine.apply((s) => d.setAiMovement(s, true));
    engine.apply((s) => d.setAiTracking(s, false));
    engine.apply((s) => d.setPaddleCy(s, "right", 500));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(-C.AI_SPEED);
  });
  it("reflects walls without changing speed and deduplicates audio per frame", async () => {
    const { engine, flight } = await setup(16);
    const cues: string[] = [];
    engine.events.on("cue:played", (e) => cues.push(e.cue));
    flight(300, 12, 200, -900);
    await engine.advance(1);
    expect(engine.state.ball?.vy).toBeGreaterThan(0);
    expect(
      Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
    ).toBeCloseTo(Math.hypot(200, 900));
    expect(cues).toEqual([C.CUES.wallBounce]);
  });
  it("adds speed and motion spin on a paddle face", async () => {
    const { engine, d, flight } = await setup(8);
    flight(C.P1_X1 + C.BALL_R + 1, 360, -C.SERVE_SPEED);
    engine.apply((s) => d.setPaddleVy(s, "left", 200));
    engine.apply((s) => d.setPaddleDriven(s, "left", true));
    await engine.advance(1);
    expect(engine.state.ball?.vx).toBeGreaterThan(0);
    expect(d.snapshot(engine.state).ball?.speed).toBeCloseTo(
      C.SERVE_SPEED * C.SPEED_MULT,
    );
    expect(engine.state.ball?.spin).toBeGreaterThan(160);
  });
  it("reflects paddle end caps without a speed bonus", async () => {
    const { engine, flight } = await setup();
    flight(56, 292, 0, 500);
    await engine.advance(1);
    expect(engine.state.ball?.vy).toBe(-500);
    expect(engine.state.ball?.spin).toBe(0);
  });
  it.each([0, 0.4, 1.3])(
    "reflects a normal incidence on an obstacle at clock %s",
    async (t) => {
      const { engine, d, flight } = await setup(8);
      flight(0, 0, 0);
      engine.apply((s) => d.spawnObstacle(s, 0));
      engine.apply((s) => d.setObstacleClock(s, t));
      engine.apply((s) => d.setObstacleClockRunning(s, false));
      const o = engine.state.obstacles[0],
        nx = Math.cos(o.theta),
        ny = Math.sin(o.theta);
      engine.apply((s) =>
        d.setBallPosition(
          s,
          o.cx + nx * (C.OBSTACLE_HW + C.BALL_R + 1),
          o.cy + ny * (C.OBSTACLE_HW + C.BALL_R + 1),
        ),
      );
      engine.apply((s) => d.setBallVelocity(s, -400 * nx, -400 * ny));
      await engine.advance(1);
      expect(
        engine.state.ball!.vx * nx + engine.state.ball!.vy * ny,
      ).toBeCloseTo(400);
      expect(d.snapshot(engine.state).ball?.speed).toBeCloseTo(400);
    },
  );
  it("curves velocity, preserves its magnitude, and decays spin by time", async () => {
    const { engine, d, flight } = await setup(8);
    flight(300, 300, 300);
    engine.apply((s) => d.setBallSpin(s, 200));
    await engine.advance(50);
    expect(engine.state.ball?.vy).toBeGreaterThan(40);
    expect(d.snapshot(engine.state).ball?.speed).toBeCloseTo(300);
    expect(engine.state.ball?.spin).toBeCloseTo(
      200 * Math.pow(0.5, 0.4 / C.SPIN_HALFLIFE),
    );
    expect(
      engine.state.ball!.trail.every(
        (p) => engine.state.simTime - p.t <= C.TRAIL_TIME,
      ),
    ).toBe(true);
  });
  it("scores only beyond the whole ball, parks and directs the next serve", async () => {
    const { engine, flight } = await setup();
    flight(C.FIELD_W + C.BALL_R, 100, 0);
    await engine.advance(1);
    expect(engine.state.score.p1).toBe(0);
    flight(C.FIELD_W + C.BALL_R + 1, 100, 1);
    await engine.advance(1);
    expect(engine.state.score.p1).toBe(1);
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.receiver).toBe("right");
    expect(engine.state.ball?.trail).toEqual([]);
  });
  it("continues at deuce and wins by two; matchover menus play again", async () => {
    const { engine, d, flight, tap } = await setup();
    engine.apply((s) => d.setScore(s, 10, 10));
    flight(1300, 100, 1);
    await engine.advance(1);
    expect(engine.state.screen).toBe("countdown");
    flight(1300, 100, 1);
    await engine.advance(1);
    expect(engine.state.screen).toBe("matchover");
    expect(engine.state.winner).toBe("left");
    await tap("Enter");
    expect(engine.state.score.p1).toBe(0);
  });
  it("absent entities neither simulate nor draw and invalid poses throw", async () => {
    const { engine, d } = await setup();
    engine.apply((s) => d.clearWorld(s));
    engine.apply((s) => d.setScreen(s, "playing"));
    await engine.advance(20);
    expect(engine.state.ball).toBeNull();
    expect(engine.state.obstacles).toEqual([]);
    expect(() => engine.apply((s) => d.setBallSpin(s, 1))).toThrow();
    expect(() => engine.apply((s) => d.spawnObstacle(s, 2))).toThrow();
    expect(d.menuItemRect(engine.state, 0)).toBeNull();
  });
  it("all scalar poses read back without integrating; reset restores everything", async () => {
    const { engine, d } = await setup();
    const original = engine.state;
    engine.apply((s) => d.setMode(s, "versus"));
    engine.apply((s) => d.setTitleIndex(s, 2));
    engine.apply((s) => d.setMenuIndex(s, 1));
    engine.apply((s) => d.setResumeScreen(s, "countdown"));
    engine.apply((s) => d.setWinner(s, "right"));
    engine.apply((s) => d.setReceiver(s, "right"));
    engine.apply((s) => d.setBallSpin(s, 800));
    engine.apply((s) => d.setBallHoldTimer(s, 3));
    engine.apply((s) => d.setMuted(s, true));
    engine.apply((s) => d.setObstacleClock(s, 1));
    const posed = engine.state;
    engine.apply((s) => d.reconcile(s));
    expect(engine.state).toEqual(posed);
    expect(engine.state.simTime).toBe(0);
    expect(original.ball?.spin).toBe(0);
    expect(d.snapshot(engine.state).winner).toBe("right");
    engine.apply((s) => d.drawBallServeSign(s));
    expect([-1, 1]).toContain(engine.state.ball?.serveSign);
    engine.apply((s) => d.reset(s));
    expect(engine.state.screen).toBe("title");
    expect(engine.state.ai).toEqual({ tracking: true, movement: true });
    expect(engine.state.muted).toBe(true);
  });
  it("agrees across 2ms and 16ms frame lengths", async () => {
    const run = async (ms: number) => {
      const { engine, d, flight } = await setup(ms);
      flight(300, 150, 450, -180);
      engine.apply((s) => d.setBallSpin(s, 240));
      await engine.advance(800 / ms);
      return d.snapshot(engine.state);
    };
    const a = await run(2),
      b = await run(16);
    expect(a.score).toEqual(b.score);
    expect(a.ball!.speed).toBeCloseTo(b.ball!.speed);
    expect(Math.sign(a.ball!.vx)).toBe(Math.sign(b.ball!.vx));
    expect(Math.sign(a.ball!.vy)).toBe(Math.sign(b.ball!.vy));
    expect(a.ball!.spin).toBeCloseTo(b.ball!.spin, 5);
  });
});
