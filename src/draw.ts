import type { RenderApi } from "@clockwyrks/simple-2d";
import type { State } from "./game";
import { BACKGROUND } from "./game";
import * as C from "./constants";
import { items, menuItemRect } from "./controls";

const INK = "#edf5f2",
  MUTED = "#81959f",
  LEFT = "#71efce",
  RIGHT = "#ff9f83",
  GOLD = "#e4ce82";
type Context = CanvasRenderingContext2D;
function text(
  ctx: Context,
  value: string,
  x: number,
  y: number,
  size = 16,
  color = INK,
  align: CanvasTextAlign = "left",
  weight = 500,
): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${size < 18 ? '"Courier New", monospace' : '"Arial", sans-serif'}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}
function line(
  ctx: Context,
  x: number,
  y: number,
  x1: number,
  y1: number,
  color: string,
  width = 1,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function bar(
  ctx: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  r = 8,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function circle(
  ctx: Context,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function field(ctx: Context, s: State, dim = false): void {
  ctx.save();
  if (dim) ctx.globalAlpha = 0.24;
  // Hairline grid and the court's architectural markings remain quiet in play.
  ctx.strokeStyle = "#14222d";
  ctx.lineWidth = 1;
  for (let x = 80; x < C.FIELD_W; x += 80)
    line(ctx, x, 0, x, C.FIELD_H, "#14222d");
  for (let y = 40; y < C.FIELD_H; y += 80)
    line(ctx, 0, y, C.FIELD_W, y, "#14222d");
  ctx.setLineDash([7, 13]);
  line(ctx, C.NET_X, 26, C.NET_X, C.FIELD_H - 26, "#33434c", 2);
  ctx.setLineDash([]);
  ctx.strokeStyle = "#23353e";
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 88, 0, 2 * Math.PI);
  ctx.stroke();
  line(ctx, 28, 16, C.FIELD_W - 28, 16, "#3c515a", 2);
  line(ctx, 28, C.FIELD_H - 16, C.FIELD_W - 28, C.FIELD_H - 16, "#3c515a", 2);
  for (const side of ["left", "right"] as const) {
    const x = side === "left" ? C.P1_X0 : C.P2_X0,
      p = s.paddles[side],
      color = side === "left" ? LEFT : RIGHT;
    bar(
      ctx,
      x - 7,
      p.cy - C.PADDLE_HALF - 7,
      C.PADDLE_W + 14,
      C.PADDLE_H + 14,
      color + "0c",
      12,
    );
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    bar(ctx, x, p.cy - C.PADDLE_HALF, C.PADDLE_W, C.PADDLE_H, color);
    ctx.shadowBlur = 0;
    line(ctx, x + 5, p.cy - 28, x + 5, p.cy + 28, "#ffffff66", 2);
  }
  for (const o of s.obstacles) {
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.theta);
    bar(
      ctx,
      -C.OBSTACLE_HW - 5,
      -C.OBSTACLE_HH - 5,
      C.OBSTACLE_W + 10,
      C.OBSTACLE_H + 10,
      GOLD + "0b",
      12,
    );
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 12;
    bar(
      ctx,
      -C.OBSTACLE_HW,
      -C.OBSTACLE_HH,
      C.OBSTACLE_W,
      C.OBSTACLE_H,
      GOLD,
      7,
    );
    ctx.shadowBlur = 0;
    line(ctx, -3, -48, -3, 48, "#fff4cb88", 2);
    circle(ctx, 0, 0, 3, "#74653d");
    ctx.restore();
    text(ctx, `0${o.index + 1}`, o.cx + 31, o.cy, 10, "#a19160");
  }
  const ball = s.ball;
  if (ball) {
    const samples = ball.trail;
    ctx.lineCap = "round";
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1],
        b = samples[i];
      const fade = Math.max(0, 1 - (s.simTime - b.t) / C.TRAIL_TIME);
      line(
        ctx,
        a.x,
        a.y,
        b.x,
        b.y,
        `rgba(216,245,236,${fade * 0.45})`,
        C.BALL_R * 1.6 * fade,
      );
    }
    ctx.shadowColor = LEFT;
    ctx.shadowBlur = 22;
    circle(ctx, ball.x, ball.y, C.BALL_R, INK);
    ctx.shadowBlur = 0;
    circle(ctx, ball.x - 3, ball.y - 3, 3, "#fff");
  }
  ctx.restore();
}
function footer(ctx: Context, s: State): void {
  text(ctx, "W / S   LEFT PADDLE", 40, 686, 12, LEFT);
  text(
    ctx,
    s.mode === "solo" ? "ARROWS   ALSO MOVE LEFT" : "↑ / ↓   RIGHT PADDLE",
    C.FIELD_W - 40,
    686,
    12,
    RIGHT,
    "right",
  );
  text(
    ctx,
    `P / ESC  PAUSE    ·    M  ${s.muted ? "SOUND OFF" : "SOUND ON"}`,
    C.FIELD_CX,
    686,
    11,
    MUTED,
    "center",
  );
}
function menus(ctx: Context, s: State): void {
  const labels = items(s);
  labels.forEach((label, i) => {
    const r = menuItemRect(s, i);
    if (!r) return;
    const selected = i === s.menuIndex;
    bar(ctx, r.x, r.y, r.w, r.h, selected ? "#19352f" : "#111f29", 7);
    if (selected) {
      ctx.strokeStyle = LEFT;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 7);
      ctx.stroke();
      bar(ctx, r.x, r.y + 16, 3, 22, LEFT, 2);
    }
    text(
      ctx,
      `0${i + 1}`,
      r.x + 22,
      r.y + r.h / 2,
      12,
      selected ? LEFT : "#526872",
    );
    text(
      ctx,
      label,
      r.x + 57,
      r.y + r.h / 2,
      17,
      selected ? INK : MUTED,
      "left",
      600,
    );
    text(
      ctx,
      selected ? "↗" : "—",
      r.x + r.w - 26,
      r.y + r.h / 2,
      21,
      selected ? LEFT : "#40545d",
      "center",
    );
  });
}
function title(ctx: Context, s: State): void {
  // A graphic bank-shot diagram frames the wordmark without obscuring navigation.
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.setLineDash([3, 8]);
  ctx.beginPath();
  ctx.moveTo(65, 540);
  ctx.bezierCurveTo(120, 240, 285, 460, 348, 236);
  ctx.strokeStyle = LEFT;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1215, 180);
  ctx.bezierCurveTo(1150, 480, 995, 260, 932, 484);
  ctx.strokeStyle = RIGHT;
  ctx.stroke();
  ctx.setLineDash([]);
  circle(ctx, 348, 236, 6, LEFT);
  circle(ctx, 932, 484, 6, RIGHT);
  ctx.restore();
  text(ctx, "A GAME OF ANGLES", C.FIELD_CX, 139, 13, LEFT, "center");
  // Closely set, oversized wordmark with a contrasting period.
  text(ctx, C.TITLE_TEXT, C.FIELD_CX, 225, 112, INK, "center", 900);
  line(ctx, 488, 299, 568, 299, LEFT, 2);
  circle(ctx, C.FIELD_CX, 299, 4, GOLD);
  line(ctx, 712, 299, 792, 299, RIGHT, 2);
  text(ctx, "PUT A LITTLE SPIN ON IT.", C.FIELD_CX, 321, 12, MUTED, "center");
  menus(ctx, s);
  text(ctx, "ONE PLAYER", 870, 381, 11, "#657e88");
  text(ctx, "TWO PLAYERS", 870, 447, 11, "#657e88");
  text(ctx, "THE FINER POINTS", 870, 513, 11, "#657e88");
  text(
    ctx,
    "MOVE TO BEND THE BALL. BANK TO BREAK THE RALLY.",
    C.FIELD_CX,
    602,
    12,
    MUTED,
    "center",
  );
  text(
    ctx,
    "↑ ↓ / W S  SELECT     ENTER  PLAY     M  SOUND",
    C.FIELD_CX,
    655,
    11,
    "#718992",
    "center",
  );
  text(ctx, "CAROM / 01", 40, 50, 12, MUTED);
  text(ctx, "LOCAL PADDLE DUEL", C.FIELD_W - 40, 50, 12, MUTED, "right");
  text(ctx, "SPIN  /  SWAY  /  RICOCHET", 40, 689, 10, "#4d626c");
  text(
    ctx,
    "FIRST TO 11 · WIN BY 2",
    C.FIELD_W - 40,
    689,
    10,
    "#4d626c",
    "right",
  );
}
function howto(ctx: Context, s: State): void {
  text(ctx, "THE FINER POINTS", C.FIELD_CX, 92, 13, LEFT, "center");
  text(ctx, "Make every angle count.", C.FIELD_CX, 145, 46, INK, "center", 700);
  const cols = [
    {
      x: 140,
      n: "01",
      title: "MOVE",
      color: LEFT,
      lines: [
        "SOLO: W / S or ↑ / ↓",
        "VERSUS: W / S vs ↑ / ↓",
        "Keep your paddle in the rally.",
      ],
    },
    {
      x: 505,
      n: "02",
      title: "CURVE",
      color: INK,
      lines: [
        "Move as you strike the ball.",
        "Up adds lift. Down adds curl.",
        "Edge hits make sharper angles.",
      ],
    },
    {
      x: 870,
      n: "03",
      title: "BANK",
      color: GOLD,
      lines: [
        "The gold bars sway and rotate.",
        "Use their faces for bank shots.",
        "Every rally opens a new route.",
      ],
    },
  ];
  for (const col of cols) {
    text(ctx, col.n, col.x, 242, 12, col.color);
    line(ctx, col.x, 269, col.x + 265, 269, "#32434d");
    text(ctx, col.title, col.x, 310, 30, col.color, "left", 700);
    col.lines.forEach((t, i) => text(ctx, t, col.x, 360 + i * 29, 13, MUTED));
  }
  text(
    ctx,
    "Pass the far edge to score. First to 11, with a two-point lead, wins.",
    C.FIELD_CX,
    508,
    15,
    INK,
    "center",
  );
  text(
    ctx,
    "P / ESC  PAUSE       M  MUTE       TOUCH CONTROLS ON TOUCHSCREENS",
    C.FIELD_CX,
    548,
    11,
    MUTED,
    "center",
  );
  menus(ctx, s);
}
export function render(s: State, { ctx }: RenderApi): void {
  ctx.save();
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  const menu = s.screen === "title" || s.screen === "howto";
  field(ctx, s, menu);
  if (menu) {
    // Opaque central wash keeps the title typography crisp over the court.
    const wash = ctx.createLinearGradient(250, 0, 1030, 0);
    wash.addColorStop(0, "#0b121b00");
    wash.addColorStop(0.2, "#0b121bf5");
    wash.addColorStop(0.8, "#0b121bf5");
    wash.addColorStop(1, "#0b121b00");
    ctx.fillStyle = wash;
    ctx.fillRect(200, 65, 880, 590);
    if (s.screen === "title") title(ctx, s);
    else howto(ctx, s);
  } else {
    bar(ctx, 431, 24, 418, 100, "#0b121bea", 12);
    text(ctx, "PLAYER 01", 520, 44, 10, LEFT, "center");
    text(
      ctx,
      s.mode === "solo" ? "COMPUTER" : "PLAYER 02",
      760,
      44,
      10,
      RIGHT,
      "center",
    );
    text(
      ctx,
      String(s.score.p1).padStart(2, "0"),
      520,
      88,
      54,
      LEFT,
      "center",
      700,
    );
    text(
      ctx,
      String(s.score.p2).padStart(2, "0"),
      760,
      88,
      54,
      RIGHT,
      "center",
      700,
    );
    text(ctx, "/", C.FIELD_CX, 83, 26, "#3c535e", "center");
    text(
      ctx,
      s.mode === "solo" ? "SOLO / HUMAN VS MACHINE" : "VERSUS / LOCAL DUEL",
      40,
      47,
      11,
      MUTED,
    );
    text(ctx, "11 POINTS · WIN BY 2", C.FIELD_W - 40, 47, 11, MUTED, "right");
    footer(ctx, s);
    if (s.screen === "countdown") {
      bar(ctx, 510, 414, 260, 58, "#14232bea", 9);
      text(
        ctx,
        `SERVE ${s.receiver === "left" ? "←" : "→"}  ${Math.max(1, Math.ceil(s.ball?.holdTimer ?? 1))}`,
        C.FIELD_CX,
        438,
        18,
        INK,
        "center",
        600,
      );
      text(ctx, "GET INTO POSITION", C.FIELD_CX, 458, 10, MUTED, "center");
    }
    if (s.screen === "paused" || s.screen === "matchover") {
      ctx.fillStyle = "#080f17d9";
      ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
      text(
        ctx,
        s.screen === "paused" ? "TAKE A BREATHER" : "MATCH COMPLETE",
        C.FIELD_CX,
        185,
        12,
        LEFT,
        "center",
      );
      text(
        ctx,
        s.screen === "paused"
          ? "Paused."
          : `${s.winner === "left" ? "PLAYER 01" : s.mode === "solo" ? "COMPUTER" : "PLAYER 02"} WINS`,
        C.FIELD_CX,
        251,
        s.screen === "paused" ? 68 : 49,
        INK,
        "center",
        800,
      );
      text(
        ctx,
        s.screen === "paused"
          ? "Your next angle can wait."
          : `${s.score.p1}  —  ${s.score.p2}   /   WELL PLAYED.`,
        C.FIELD_CX,
        307,
        15,
        MUTED,
        "center",
      );
      menus(ctx, s);
      text(
        ctx,
        "↑ ↓  SELECT     ENTER  CONFIRM",
        C.FIELD_CX,
        608,
        11,
        MUTED,
        "center",
      );
    }
  }
  ctx.restore();
}
