import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { CaromState, State } from "./game";
import * as C from "./constants";
import { startMatch, toTitle } from "./world";
export const items = (s: State): readonly string[] =>
  s.screen === "title"
    ? C.TITLE_ITEMS
    : s.screen === "paused"
      ? C.PAUSE_ITEMS
      : s.screen === "matchover"
        ? C.MATCHOVER_ITEMS
        : s.screen === "howto"
          ? ["BACK TO MENU"]
          : [];
export function menuItemRect(
  s: State,
  index: number,
): { x: number; y: number; w: number; h: number } | null {
  if (index < 0 || index >= items(s).length) return null;
  return {
    x: 460,
    y:
      (s.screen === "howto" ? 590 : s.screen === "title" ? 354 : 350) +
      index * 66,
    w: 360,
    h: 54,
  };
}
function confirm(s: State): CaromState {
  switch (s.screen) {
    case "title": {
      const n = { ...s, titleIndex: s.menuIndex };
      return s.menuIndex === 2
        ? { ...n, screen: "howto", menuIndex: 0 }
        : startMatch(n, s.menuIndex === 0 ? "solo" : "versus");
    }
    case "howto":
      return toTitle(s);
    case "paused":
      return s.menuIndex === 0
        ? { ...s, screen: s.resumeScreen }
        : s.menuIndex === 1
          ? startMatch(s, s.mode)
          : toTitle(s);
    case "matchover":
      return s.menuIndex === 0 ? startMatch(s, s.mode) : toTitle(s);
    default:
      return s;
  }
}
export function readControls(s: State, api: UpdateApi): CaromState {
  const edge = Object.fromEntries(
    C.ACTIONS.map((n) => [n, api.input.pressed(n)]),
  ) as Record<C.ActionName, boolean>;
  const samples = api.input.pointerSamples();
  const contacts = api.input.pointerContacts();
  let next: CaromState = { ...s, muted: edge.mute ? !s.muted : s.muted };
  if ((s.screen === "playing" || s.screen === "countdown") && edge.pause)
    return {
      ...next,
      resumeScreen: s.screen,
      screen: "paused",
      menuIndex: 0,
      menuPresses: {},
    };
  if (s.screen === "paused" && (edge.pause || edge.back))
    return { ...next, screen: s.resumeScreen, menuPresses: {} };
  if ((s.screen === "howto" || s.screen === "matchover") && edge.back)
    return toTitle(next);
  const count = items(s).length;
  if (!count) return { ...next, menuPresses: {} };
  let keyboardConfirm = false;
  if (edge["p1-up"] || edge["p2-up"])
    next = { ...next, menuIndex: (s.menuIndex + count - 1) % count };
  else if (edge["p1-down"] || edge["p2-down"])
    next = { ...next, menuIndex: (s.menuIndex + 1) % count };
  else if (edge.confirm) keyboardConfirm = true;
  // The keyboard's item is captured before pointer selection is applied.
  const keyboardItem = next.menuIndex;
  const hit = (x: number, y: number): number => {
    for (let i = 0; i < count; i++) {
      const r = menuItemRect(s, i);
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
        return i;
    }
    return -1;
  };
  const presses: Record<number, number> = { ...s.menuPresses };
  let pointerConfirm = false;
  for (const p of samples) {
    const index = hit(p.x, p.y);
    if (index >= 0) next = { ...next, menuIndex: index };
    if (p.type === "down") presses[p.id] = index;
    if (p.type === "up") {
      if (index >= 0 && presses[p.id] === index) pointerConfirm = true;
      delete presses[p.id];
    }
  }
  for (const p of contacts) {
    const i = hit(p.x, p.y);
    if (i >= 0) next = { ...next, menuIndex: i };
  }
  next = { ...next, menuPresses: presses };
  if (keyboardConfirm)
    return {
      ...confirm({ ...next, menuIndex: keyboardItem }),
      menuPresses: {},
    };
  return pointerConfirm ? { ...confirm(next), menuPresses: {} } : next;
}
