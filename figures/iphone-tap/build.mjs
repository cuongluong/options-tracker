import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../.claude/skills/anatomy/kit/iso-kit.mjs";
import * as G from "../../.claude/skills/anatomy/kit/lathe.mjs";
import { kitScript } from "../../.claude/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

// World units are 0.5 mm. The phone is a 146.6 × 70.6 mm slab (iPhone 15 Pro size);
// display layers are drawn about 3× thick so each one reads.
const WIDTH = 640;
const HEIGHT = 420;

const PLATE = { x: -205, y: -126, w: 410, d: 228, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

const PH = { x: -147, y: -71, w: 294, d: 142, r: 18 };
const WALL = 3;
const IN_R = PH.r - WALL;
const Z = { back: 2, cavity: 4, mid: 14, oled: 16, touch: 18.5, glass: 20, top: 23 };
const CUT = { glass: -26, touch: -4, oled: 14, mid: 30 };

// Touch sensor: transmit rows (Tx) along x, receive columns (Rx) along y, about 5 mm apart.
const PITCH = 10;
const RX = Array.from({ length: 29 }, (_, i) => -140 + PITCH * i);
const TX = Array.from({ length: 8 }, (_, i) => -65 + PITCH * i);
const FINGER_Y = -45;
const REACH = [-118, 118];

// Probe on a gantry beam behind the phone.
const POST_X = 190;
const BEAM_Y = -110;
const BEAM_Z = 70;
const TIP_R = 4.5;
const TIP_REST = Z.top + 9;
const HOUSING = { z0: 42, z1: 68, r: 6 };

// The model: one tap at 120 Hz, in real milliseconds.
const HZ = 120;
const FRAME = 1000 / HZ;
const STAGES = [
  { key: "scan", ms: FRAME / 2, say: "touch scan" },
  { key: "report", ms: 1.0, say: "report to A17 Pro" },
  { key: "app", ms: FRAME, say: "app handles the touch" },
  { key: "render", ms: FRAME, say: "GPU renders the frame" },
  { key: "scanout", ms: FRAME, say: "frame scanned out" },
];
const TOTAL = STAGES.reduce((sum, stage) => sum + stage.ms, 0);

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-POST_X, BEAM_Y, BEAM_Z + 8], [POST_X, BEAM_Y, BEAM_Z + 8], [0, BEAM_Y, BEAM_Z + 8]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 58, elevation: 44 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const arc = (cx, cy, r, a0, a1, steps = 10) => Array.from({ length: steps + 1 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / steps;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});

// Display plates: rounded far corners inside the frame, a straight cut toward the viewer.
const plateRing = (y1) => [
  [-PH.w / 2 + WALL, y1],
  ...arc(-PH.w / 2 + PH.r, PH.y + PH.r, IN_R, Math.PI, Math.PI * 1.5),
  ...arc(PH.w / 2 - PH.r, PH.y + PH.r, IN_R, Math.PI * 1.5, Math.PI * 2),
  [PH.w / 2 - WALL, y1],
];
// A rounded corner of the frame: a quarter ring between the outer and inner radius.
const cornerRing = (cx, cy, a0) => [...arc(cx, cy, PH.r, a0, a0 + Math.PI / 2), ...arc(cx, cy, IN_R, a0 + Math.PI / 2, a0).slice()];
const CX = PH.w / 2 - PH.r;
const CY = PH.d / 2 - PH.r;

function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 24))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Anti-static mat under the phone, with its grounding snap.
  const mat = { x: -176, y: -86, w: 352, d: 166, r: 6 };
  out.push(S(k.slabOf(mat, 0, 0.6, P, 6), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(mat, 3), 0.6, P, 6), { tone: "faint" }));
  out.push(S(k.cylinder(mat.x + 10, mat.y + mat.d - 10, 2.6, 0.6, 1.2, P, 20), { tone: "mid" }));
  out.push(D([at([mat.x + 10, mat.y + mat.d - 10, 1.8])], { size: 0.5, tone: "hi" }));
  // Ruler strip along the near edge, in millimetres (2 units each).
  const strip = { x: -150, y: PLATE.y + PLATE.d - 15, w: 300, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 4, 5, strip.y + 0.8, 0.6, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 1.5, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 1.5, strip.y + 3.5, 0.6])], { size: 0.45 }));
  // Label plate.
  const label = { x: 160, y: PLATE.y + PLATE.d - 26, w: 30, d: 16, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  [[22, 5], [16, 8.5], [19, 12]].forEach(([w, y]) => out.push(L(k.lineOnTop([label.x + 4, label.y + y], [label.x + 4 + w * 0.9, label.y + y], 0.8, P), { tone: "lo", free: true })));
  return out.join("");
}

function gantryBack() {
  const out = [];
  for (const x of [-POST_X, POST_X]) {
    out.push(S(k.cylinder(x, BEAM_Y, 8, 0, 3, P, 28), { tone: "mid" }));
    out.push(D(k.corners({ x: x - 8, y: BEAM_Y - 8, w: 16, d: 16 }, 3.4).map(([px, py]) => at([px, py, 3])).slice(1, 3), { size: 0.4 }));
    out.push(S(k.cylinder(x, BEAM_Y, 4.2, 3, BEAM_Z - 3, P, 24), { tone: "mid", crease: "none" }));
    out.push(L([20, 40, 60].map((z) => k.sideArc(x, BEAM_Y, 4.2, z, P, 16)).join(""), { tone: "faint" }));
  }
  const beam = { x: -POST_X - 7, y: BEAM_Y - 4, w: POST_X * 2 + 14, d: 8, r: 1.5 };
  out.push(S(k.slabOf(beam, BEAM_Z, 7, P, 3, 0.5), { tone: "mid" }));
  out.push(D([-POST_X, POST_X].map((x) => at([x, BEAM_Y, BEAM_Z + 7])), { size: 0.5 }));
  // Linear scale on the beam's front face, so the finger's x reads off it.
  const ticks = k.sideTicks(REACH[0] - 10, REACH[1] + 10, 4, 5, BEAM_Y + 4, BEAM_Z + 7, [1.4, 2.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

function carriage() {
  const out = [];
  const block = { x: -11, y: BEAM_Y + 4, w: 22, d: 5, r: 1 };
  out.push(S(k.slabOf(block, BEAM_Z - 8, 17, P, 3, 0.4), { tone: "mid" }));
  out.push(D([[-7, BEAM_Z + 6], [7, BEAM_Z + 6], [-7, BEAM_Z - 5], [7, BEAM_Z - 5]].map(([x, z]) => at([x, BEAM_Y + 9, z])), { size: 0.45 }));
  const cap = { x: -11, y: BEAM_Y - 5, w: 22, d: 9, r: 1 };
  out.push(S(k.slabOf(cap, BEAM_Z + 7, 2, P, 3, 0.4), { tone: "mid" }));
  // Arm out over the glass.
  const arm = { x: -3, y: BEAM_Y + 9, w: 6, d: FINGER_Y - HOUSING.r - BEAM_Y - 9 + 0.4, r: 1.5 };
  out.push(S(k.slabOf(arm, HOUSING.z1 - 8, 4, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([0, arm.y + 4, HOUSING.z1 - 4]), at([0, arm.y + arm.d - 4, HOUSING.z1 - 4])], { size: 0.4 }));
  return out.join("");
}

function probeRod() {
  const out = [];
  const [x, y] = [0, FINGER_Y];
  out.push(S(k.cylinder(x, y, 1.8, 3, 22, P, 18), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y, 2.8, 2.6, 1.4, P, 20), { tone: "mid" }));
  out.push(`<g data-part="tip">${S(k.cylinder(x, y, TIP_R, 0, 2.6, P, 28, 0.4), { tone: "hi" })}</g>`);
  return out.join("");
}

function probeHousing() {
  const out = [];
  const [x, y] = [0, FINGER_Y];
  out.push(S(k.cylinder(x, y, HOUSING.r, HOUSING.z0, HOUSING.z1 - HOUSING.z0, P, 32), { tone: "mid" }));
  out.push(L(k.sideArc(x, y, HOUSING.r, HOUSING.z0 + 6, P, 24), { tone: "faint" }));
  out.push(L(k.knurl(x, y, HOUSING.r, HOUSING.z1 - 7, HOUSING.z1, 30, P), { tone: "lo" }));
  out.push(L(k.ring(x, y, 2.4, HOUSING.z1, P, 20), { tone: "lo" }));
  out.push(D([at([x, y, HOUSING.z1])], { size: 0.5, tone: "hi" }));
  out.push(S(k.cylinder(x, y, 3.4, HOUSING.z0 - 2, 2, P, 24), { tone: "mid" }));
  return out.join("");
}

function pads() {
  return byDepth(k.corners(PH, 34)).map(([x, y]) => S(k.cylinder(x, y, 7, 0, Z.back, P, 24), { tone: "lo" })).join("");
}

function jaw(side) {
  const out = [];
  const x0 = side < 0 ? PH.x - 12 : PH.x + PH.w;
  const plan = { x: x0, y: -26, w: 12, d: 52, r: 2 };
  out.push(S(k.slabOf(plan, 0, 20, P, 3, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 2.4), 20, P, 3), { tone: "faint" }));
  out.push(D([at([x0 + 6, -19, 20]), at([x0 + 6, 19, 20])], { size: 0.5 }));
  if (side > 0) {
    // Thumb screw on the outside face.
    const F = G.frameAlong([x0 + 12, 0, 10], [1, 0, 0]);
    out.push(S(G.disc(0, 3, 3, F, P), { tone: "mid" }));
    const knob = G.frameAlong([x0 + 15, 0, 10], [1, 0, 0]);
    const ribs = G.ribsOf(knob, 0, 6, 6, 28, P, { fade: [0.1, 0.55] });
    out.push(S(G.disc(0, 6, 6, knob, P), { tone: "mid", inner: k.fadedSvg(ribs, { tone: "lo" }) }));
    out.push(L(G.circleOf(knob, 6, 2.2, P, 24), { tone: "lo" }));
  }
  return out.join("");
}

function frameBack() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(PH, Z.back, 2, P)}" style="filter:blur(6px)"/>`);
  out.push(S(k.slabOf(PH, Z.back, Z.cavity - Z.back, P, 10, 0.6), { tone: "mid" }));
  const h = Z.top - Z.cavity;
  out.push(S(k.extrude(cornerRing(-CX, -CY, Math.PI), Z.cavity, h, P, { convex: false }), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -CX, y: PH.y, w: CX * 2, d: WALL, r: 0 }, Z.cavity, h, P, 1), { tone: "mid" }));
  out.push(S(k.extrude(cornerRing(CX, -CY, Math.PI * 1.5), Z.cavity, h, P, { convex: false }), { tone: "mid" }));
  out.push(S(k.slabOf({ x: PH.x, y: -CY, w: WALL, d: CY * 2, r: 0 }, Z.cavity, h, P, 1), { tone: "mid" }));
  out.push(S(k.extrude(cornerRing(-CX, CY, Math.PI * 0.5), Z.cavity, h, P, { convex: false }), { tone: "mid" }));
  return out.join("");
}

function frameFront() {
  const out = [];
  const lip = 4;
  out.push(S(k.slabOf({ x: -CX, y: PH.y + PH.d - WALL, w: CX * 2, d: WALL, r: 0 }, Z.cavity, lip, P, 1), { tone: "mid" }));
  // Side button and its two screws, on the cut-down near wall.
  out.push(S(k.slabOf({ x: 40, y: PH.y + PH.d, w: 26, d: 0.8, r: 0.4 }, Z.cavity + 0.8, 2.4, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: PH.x + PH.w - WALL, y: -CY, w: WALL, d: CY * 2, r: 0 }, Z.cavity, Z.top - Z.cavity, P, 1), { tone: "mid" }));
  out.push(S(k.extrude(cornerRing(CX, CY, 0), Z.cavity, Z.top - Z.cavity, P, { convex: false }), { tone: "mid" }));
  out.push(D([at([-100, PH.y + PH.d - 1.5, Z.cavity + lip]), at([100, PH.y + PH.d - 1.5, Z.cavity + lip])], { size: 0.45 }));
  return out.join("");
}

const BOARD = { x: 56, y: -58, w: 84, d: 120, r: 4 };
const BOARD_TOP = Z.cavity + 1.6;
const SOC = { x: 98, y: 43, w: 22, d: 17, r: 1.5 };
const SOC_TOP = BOARD_TOP + 3;
const DCONN = { x: 70, y: 44, w: 12, d: 7, r: 0.6 };
const FLEX_X = 72;
const FLEX_W = 8;

function battery() {
  const out = [];
  const cell = { x: -66, y: -60, w: 118, d: 122, r: 4 };
  out.push(S(k.slabOf(cell, Z.cavity, Z.mid - Z.cavity, P, 6, 0.6), { tone: "mid", inner: L(k.sideSeam(cell, Z.cavity + 2.4, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline({ x: -50, y: 44, w: 52, d: 13, r: 1 }, Z.mid, P, 3), { tone: "faint" }));
  [[34, 47.5], [22, 51], [28, 54.5]].forEach(([w, y]) => out.push(L(k.lineOnTop([-46, y], [-46 + w, y], Z.mid, P), { tone: "lo", free: true })));
  // Stretch-release pull tabs at the near edge.
  for (const x of [-56, 18]) out.push(S(k.slabOf({ x, y: cell.y + cell.d, w: 10, d: 4, r: 0.6 }, Z.cavity, 0.4, P, 2), { tone: "lo", crease: "none" }));
  // Battery flex to the board.
  out.push(S(k.slabOf({ x: 36, y: 46, w: 16, d: 7, r: 0.4 }, Z.mid, 0.4, P, 2), { tone: "lo", crease: "none" }));
  return out.join("");
}

function boardAndChips() {
  const out = [];
  out.push(S(k.slabOf(BOARD, Z.cavity, 1.6, P, 6, 0.4), { tone: "lo" }));
  // Battery flex down the cell's +x face onto its connector.
  out.push(S(k.slabOf({ x: 58, y: 45, w: 8, d: 9, r: 0.6 }, BOARD_TOP, 1.6, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 52, y: 46, w: 0.4, d: 7, r: 0 }, BOARD_TOP + 1.6, Z.mid + 0.4 - BOARD_TOP - 1.6, P, 1), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ x: 52, y: 46, w: 8, d: 7, r: 0.4 }, BOARD_TOP + 1.6, 0.4, P, 2), { tone: "lo", crease: "none" }));
  // Board screws.
  for (const [x, y] of [[63, 58], [134, 58]]) {
    out.push(L(k.ring(x, y, 2.2, BOARD_TOP, P, 16), { tone: "mid" }));
    out.push(D([at([x, y, BOARD_TOP])], { size: 0.5, tone: "hi" }));
  }
  // Traces from the display connector to the SoC.
  [45.5, 47.5, 49.5].forEach((y) => out.push(L(k.lineOnTop([DCONN.x + DCONN.w, y], [SOC.x, y], BOARD_TOP, P), { tone: "faint" })));
  // Passives around the SoC.
  out.push(D(k.dotGrid(86, 54, 4, 3, 2.2, BOARD_TOP, P), { size: 0.45, tone: "mid" }));
  out.push(D(k.dotGrid(123, 52, 5, 2, 2.2, BOARD_TOP, P), { size: 0.45, tone: "mid" }));
  out.push(S(k.slabOf(DCONN, BOARD_TOP, 1.6, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 72, y: 53, w: 10, d: 8, r: 0.6 }, BOARD_TOP, 1, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 123, y: 42, w: 14, d: 8, r: 0.6 }, BOARD_TOP, 1.4, P, 2, 0.3), { tone: "mid" }));
  out.push(L(k.ring(125.5, 44.5, 0.8, BOARD_TOP + 1.4, P, 10), { tone: "lo" }));
  // SoC: substrate, then the package with memory stacked on it.
  out.push(S(k.slabOf(SOC, BOARD_TOP, 1, P, 3, 0.3), { tone: "mid" }));
  const lid = k.insetPlan(SOC, 2);
  out.push(`<g data-part="soc">${S(k.slabOf(lid, BOARD_TOP + 1, 2, P, 3, 0.5), { tone: "hi", crease: "lo" })}${k.faceTextSvg(k.topMatrix([lid.x + lid.w / 2, lid.y + lid.d / 2 + 1], SOC_TOP, P, "x"), "A17 PRO", { size: 2.6, tone: "lo", anchor: "middle" })}</g>`);
  return out.join("");
}

const TAPTIC = { x: -124, y: 44, w: 52, d: 20 };
const MASS = { x: -110, y: 47.5, w: 24, d: 13, r: 1 };
const MASS_Z = [Z.cavity + 1.4, 11];
const COIL = { cy: MASS.y + MASS.d / 2, cz: (MASS_Z[0] + MASS_Z[1]) / 2, r: 2.6 };
const coilsAt = (dx) => ({
  left: k.coil(TAPTIC.x + 1.2, MASS.x + dx, [COIL.cy, COIL.cz], COIL.r, 5, "x", P),
  right: k.coil(MASS.x + MASS.w + dx, TAPTIC.x + TAPTIC.w - 1.2, [COIL.cy, COIL.cz], COIL.r, 5, "x", P),
});

function tapticBack() {
  const out = [];
  const t = TAPTIC;
  out.push(S(k.slabOf({ ...t, r: 1.6 }, Z.cavity, 1, P, 3), { tone: "lo" }));
  out.push(S(k.slabOf({ x: t.x, y: t.y, w: t.w, d: 1.2, r: 0 }, Z.cavity + 1, 8, P, 1), { tone: "mid" }));
  out.push(S(k.slabOf({ x: t.x, y: t.y, w: 1.2, d: t.d, r: 0 }, Z.cavity + 1, 8, P, 1), { tone: "mid" }));
  // Magnet rails the mass rides between.
  out.push(L(k.lineOnTop([t.x + 1.2, t.y + 3], [t.x + t.w - 1.2, t.y + 3], Z.cavity + 1, P), { tone: "faint" }));
  out.push(L(k.lineOnTop([t.x + 1.2, t.y + t.d - 3], [t.x + t.w - 1.2, t.y + t.d - 3], Z.cavity + 1, P), { tone: "faint" }));
  out.push(L(k.sideRing([t.x + 1.2, COIL.cy, COIL.cz], COIL.r, "x", P, 32), { tone: "lo" }));
  out.push(D([at([t.x + 1.2, COIL.cy, COIL.cz])], { size: 0.45 }));
  const c = coilsAt(0);
  out.push(`<path data-part="coil-back" class="iso-line" data-tone="lo" d="${c.left.back}"/><path data-part="coil-left" class="iso-line" data-tone="mid" d="${c.left.front}"/>`);
  return out.join("");
}

function tapticMass() {
  const out = [];
  out.push(S(k.slabOf(MASS, MASS_Z[0], MASS_Z[1] - MASS_Z[0], P, 3, 0.5), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(MASS, 2.4), MASS_Z[1], P, 3), { tone: "faint" }));
  out.push(L(k.lineOnTop([MASS.x + MASS.w / 2, MASS.y], [MASS.x + MASS.w / 2, MASS.y + MASS.d], MASS_Z[1], P), { tone: "faint" }));
  out.push(L(k.sideRing([MASS.x + MASS.w, COIL.cy, COIL.cz], COIL.r, "x", P, 32), { tone: "lo" }));
  return out.join("");
}

function tapticFront() {
  const out = [];
  const t = TAPTIC;
  const c = coilsAt(0);
  out.push(`<path data-part="coil-rback" class="iso-line" data-tone="lo" d="${c.right.back}"/><path data-part="coil-front" class="iso-line" data-tone="mid" d="${c.right.front}"/>`);
  out.push(S(k.slabOf({ x: t.x, y: t.y + t.d - 1.2, w: t.w, d: 1.2, r: 0 }, Z.cavity + 1, 8, P, 1), { tone: "mid" }));
  out.push(S(k.slabOf({ x: t.x + t.w - 1.2, y: t.y, w: 1.2, d: t.d, r: 0 }, Z.cavity + 1, 8, P, 1), { tone: "mid" }));
  out.push(D([at([t.x + 3, t.y + t.d - 0.6, Z.cavity + 9]), at([t.x + t.w - 3, t.y + t.d - 0.6, Z.cavity + 9])], { size: 0.4 }));
  return out.join("");
}

// OLED subpixels on the exposed strip, drawn about 35× enlarged, one group per column.
const SUB_X = Array.from({ length: 71 }, (_, i) => -140 + 4 * i);
const SUB_Y = [1, 5, 9];
function subpixels() {
  const colours = [["r", -1.1], ["g", 0], ["b", 1.1]];
  return `<g data-part="pixels">${SUB_X.map((x) => `<g data-x="${x}" opacity=".22">${colours.map(([c, dx]) => SUB_Y.map((y) => {
    const [sx, sy] = at([x + dx, y, Z.touch]);
    return `<circle class="ph-sub" data-c="${c}" cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r=".6"/>`;
  }).join("")).join("")}</g>`).join("")}</g>`;
}

function displayStack() {
  const out = [];
  out.push(S(k.extrude(plateRing(CUT.mid), Z.mid, Z.oled - Z.mid, P), { tone: "mid" }));
  out.push(D([[-120, 22], [-20, 22], [130, 22]].map(([x, y]) => at([x, y, Z.oled])), { size: 0.45 }));
  out.push(L([-120, -20, 130].map((x) => k.ring(x, 22, 1.8, Z.oled, P, 14)).join(""), { tone: "lo" }));
  out.push(S(k.extrude(plateRing(CUT.oled), Z.oled, Z.touch - Z.oled, P), { tone: "hi", crease: "lo" }));
  out.push(subpixels());
  out.push(S(k.extrude(plateRing(CUT.touch), Z.touch, Z.glass - Z.touch, P), { tone: "hi", crease: "lo" }));
  const rows = TX.map((y) => k.lineOnTop([PH.x + WALL, y], [PH.x + PH.w - WALL, y], Z.glass, P)).join("");
  const cols = RX.map((x) => k.lineOnTop([x, PH.y + WALL], [x, CUT.touch], Z.glass, P)).join("");
  out.push(L(rows, { tone: "faint" }), L(cols, { tone: "faint" }));
  // Live overlay on the sensor: the driven row, the sensed column and the app's ripple.
  out.push(`<clipPath id="ph-sensor"><path d="${k.onTop(plateRing(CUT.touch), Z.glass, P, true)}"/></clipPath>`);
  out.push(`<g clip-path="url(#ph-sensor)"><path data-part="ripple" class="iso-line" data-tone="lit" d="" style="stroke-width:1.1"/><path data-part="ripple2" class="iso-line" data-tone="lit" d="" style="stroke-width:.7"/></g>`);
  out.push(`<path data-part="tx" class="iso-line" data-tone="lit" d="${k.lineOnTop([PH.x + WALL, FINGER_Y], [PH.x + PH.w - WALL, FINGER_Y], Z.glass, P)}" style="stroke-width:1.1;opacity:0"/>`);
  out.push(`<path data-part="rx" class="iso-line" data-tone="lit" d="" style="stroke-width:1.2;opacity:0"/>`);
  out.push(S(k.extrude(plateRing(CUT.glass), Z.glass, Z.top - Z.glass, P, { bevel: 0.8 }), { tone: "hi", crease: "lo", className: "ph-glass" }));
  out.push(L(k.onTop([[-30, -61], [30, -61]], Z.top, P), { tone: "lo" }));
  out.push(L(k.ring(-40, -61, 1.4, Z.top, P, 12), { tone: "lo" }));
  return out.join("");
}

function displayFlex() {
  const out = [];
  out.push(S(k.slabOf({ x: FLEX_X, y: CUT.oled, w: FLEX_W, d: CUT.mid - CUT.oled + 0.4, r: 0.4 }, Z.oled, 0.4, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ x: FLEX_X + 1.5, y: CUT.oled + 3, w: 5, d: 4, r: 0.4 }, Z.oled + 0.4, 0.8, P, 2, 0.2), { tone: "mid" }));
  out.push(S(k.slabOf({ x: FLEX_X, y: CUT.mid, w: FLEX_W, d: 0.4, r: 0 }, BOARD_TOP + 1.6, Z.oled + 0.4 - BOARD_TOP - 1.6, P, 1), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ x: FLEX_X, y: CUT.mid, w: FLEX_W, d: DCONN.y + 4 - CUT.mid, r: 0.4 }, BOARD_TOP + 1.6, 0.4, P, 2), { tone: "lo", crease: "none" }));
  return out.join("");
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A phone on a test bench with its display stack cut back in steps: cover glass, touch sensor, OLED panel and midframe, then the logic board, battery and Taptic Engine underneath. A robot finger on a gantry taps the glass. The touch column under it lights, a pulse runs down the display flex to the A17 Pro chip and back, the OLED pixels ripple out from the touch point and the Taptic Engine's mass shakes.",
  body: [
    bench(),
    gantryBack(),
    pads(),
    jaw(-1),
    frameBack(),
    battery(),
    boardAndChips(),
    tapticBack(),
    `<g data-part="mass">${tapticMass()}</g>`,
    tapticFront(),
    displayStack(),
    displayFlex(),
    frameFront(),
    `<circle data-part="pulse" class="ph-pulse" r="2.2" cx="0" cy="0" opacity="0"/>`,
    `<g data-part="probe" transform="${k.translateAlong(P, [0, 0, 0])}"><path data-part="contact" class="iso-line" data-tone="lit" d="${k.ring(0, FINGER_Y, TIP_R + 2.2, Z.top, P, 28)}" style="opacity:0"/>${carriage()}<g data-part="rod" transform="${k.translateAlong(P, [0, 0, TIP_REST])}">${probeRod()}</g>${probeHousing()}</g>`,
    jaw(1),
  ],
});

const live = `
const P = ${JSON.stringify(P)};
const RX = ${JSON.stringify(RX)}, TX = ${JSON.stringify(TX)}, SUB_X = ${JSON.stringify(SUB_X)};
const FINGER_Y = ${FINGER_Y}, TOP = ${Z.top}, GLASS = ${Z.glass}, CUT_TOUCH = ${CUT.touch}, CUT_OLED = ${CUT.oled}, TIP_R = ${TIP_R}, TIP_REST = ${TIP_REST};
const REACH = ${JSON.stringify(REACH)}, STAGES = ${JSON.stringify(STAGES)}, TOTAL = ${TOTAL}, HZ = ${HZ}, FRAME = ${FRAME};
const PLATE_Y0 = ${PH.y + WALL};
const MASS = ${JSON.stringify(MASS)}, TAPTIC = ${JSON.stringify(TAPTIC)}, COIL = ${JSON.stringify(COIL)};
const FLEX = ${FLEX_X + FLEX_W / 2}, FLEX_TOP = ${Z.oled + 0.4}, MIDCUT = ${CUT.mid}, BOARD_TOP = ${BOARD_TOP}, CONN = ${JSON.stringify([DCONN.x + DCONN.w / 2, DCONN.y + 3.5, BOARD_TOP + 1.6 + 0.4])}, SOC = ${JSON.stringify([SOC.x + SOC.w / 2, SOC.y + SOC.d / 2, SOC_TOP])};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const $ = (name) => svg.querySelector('[data-part="' + name + '"]');
const probe = $("probe"), rod = $("rod"), tip = $("tip"), rx = $("rx"), tx = $("tx"), soc = $("soc"), pulse = $("pulse"), contact = $("contact");
const ripple = $("ripple"), ripple2 = $("ripple2"), mass = $("mass"), coilBack = $("coil-back"), coilLeft = $("coil-left"), coilRBack = $("coil-rback"), coilFront = $("coil-front");
const columns = [...svg.querySelectorAll('[data-part="pixels"] > g')];
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const window01 = (t, a, b, fadeIn = 0.08, fadeOut = 0.12) => smooth((t - a) / fadeIn) * (1 - smooth((t - b) / fadeOut));

// Page seconds for each phase of a tap; the readout maps them back to real milliseconds.
const PHASES = [
  ["down", 0.5], ["scan", 0.7], ["report", 1.3], ["app", 0.7], ["render", 0.7], ["scanout", 1.0], ["light", 1.4], ["up", 0.5],
];
const START = {}; let acc = 0; for (const [name, s] of PHASES) { START[name] = acc; acc += s; } const LENGTH = acc;
const endOf = (name) => START[name] + PHASES.find((p) => p[0] === name)[1];
const realStart = {}; { let r = 0; for (const s of STAGES) { realStart[s.key] = r; r += s.ms; } }
const realAt = (t) => {
  if (t < START.scan) return null;
  for (const s of STAGES) { const a = START[s.key], b = endOf(s.key); if (t < b) return realStart[s.key] + s.ms * (t - a) / (b - a); }
  return TOTAL;
};

const columnOf = (x) => Math.round((x - RX[0]) / (RX[1] - RX[0]));
let x = 0, target = 0, tapAt = -1, clock = 0, touring = true, visible = false, idleTimer = 0, last = 0, frame = 0, tourNext = 1.2;
let tapX = 0;

const path = (points) => points.map((p, i) => (i ? "L" : "M") + iso(p, P).map((v) => v.toFixed(1)).join(" ")).join("");
const along = (points, share) => {
  const lens = []; let total = 0;
  for (let i = 1; i < points.length; i++) { const l = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]); lens.push(l); total += l; }
  let d = clamp(share, 0, 1) * total;
  for (let i = 0; i < lens.length; i++) { if (d <= lens[i] || i === lens.length - 1) { const f = lens[i] ? d / lens[i] : 0; return points[i].map((v, j) => v + (points[i + 1][j] - v) * f); } d -= lens[i]; }
  return points[points.length - 1];
};
const upPath = (cx) => [[cx, FINGER_Y, GLASS], [cx, CUT_TOUCH, GLASS], [FLEX, CUT_TOUCH, GLASS], [FLEX, CUT_TOUCH, GLASS - 1.5], [FLEX, CUT_OLED, GLASS - 1.5], [FLEX, CUT_OLED, FLEX_TOP], [FLEX, MIDCUT + 0.4, FLEX_TOP], [FLEX, MIDCUT + 0.4, CONN[2]], [FLEX, CONN[1], CONN[2]], [CONN[0] + 6, CONN[1], BOARD_TOP], [SOC[0] - 8, CONN[1], BOARD_TOP], [SOC[0] - 8, CONN[1], SOC[2]], SOC];
const downPath = () => [SOC, [SOC[0] - 8, CONN[1], SOC[2]], [SOC[0] - 8, CONN[1], BOARD_TOP], [CONN[0] + 6, CONN[1], BOARD_TOP], [FLEX, CONN[1], CONN[2]], [FLEX, MIDCUT + 0.4, CONN[2]], [FLEX, MIDCUT + 0.4, FLEX_TOP], [FLEX, CUT_OLED, FLEX_TOP]];

function ringPath(cx, cy, r) {
  if (r <= 0.2) return "";
  const pts = []; for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), GLASS]); }
  return path(pts);
}

function draw() {
  const t = tapAt < 0 ? -1 : clock - tapAt;
  probe.setAttribute("transform", translateAlong(P, [x, 0, 0]));
  // Probe stroke: down onto the glass, hold, lift.
  let lift = 1;
  if (t >= 0) {
    if (t < START.scan) lift = 1 - smooth(t / PHASES[0][1]);
    else if (t < START.up) lift = 0;
    else lift = smooth((t - START.up) / PHASES[7][1]);
  }
  rod.setAttribute("transform", translateAlong(P, [0, 0, TOP + (TIP_REST - TOP) * lift]));
  const touching = t >= 0 && lift < 0.02;
  tip.querySelector(".iso-solid").toggleAttribute("data-lit", touching);
  contact.style.opacity = touching ? String(1 - smooth((t - START.light) / 1.2) * 0.6) : "0";
  const cx = RX[clamp(columnOf(tapX), 0, RX.length - 1)];
  // Sensor: the driven row and the sensed column under the finger.
  const sense = t < 0 ? 0 : window01(t, START.scan, endOf("report") - 0.4, 0.15, 0.4);
  rx.setAttribute("d", path([[cx, PLATE_Y0, GLASS], [cx, CUT_TOUCH, GLASS]]));
  rx.style.opacity = sense.toFixed(3);
  tx.style.opacity = (t < 0 ? 0 : window01(t, START.scan, START.report, 0.15, 0.3)).toFixed(3);
  // A pulse up the flex to the chip, and back down to the panel.
  let p = null, po = 0;
  if (t >= START.scan + 0.35 && t < START.app) { p = along(upPath(cx), (t - START.scan - 0.35) / (START.app - START.scan - 0.35)); po = window01(t, START.scan + 0.35, START.app - 0.08, 0.1, 0.08); }
  else if (t >= START.scanout && t < START.light) { p = along(downPath(), (t - START.scanout) / PHASES[5][1]); po = window01(t, START.scanout, START.light - 0.06, 0.1, 0.06); }
  if (p) { const [sx, sy] = iso(p, P); pulse.setAttribute("cx", sx.toFixed(1)); pulse.setAttribute("cy", sy.toFixed(1)); }
  pulse.setAttribute("opacity", po.toFixed(3));
  const thinking = t >= START.app && t < START.scanout;
  soc.querySelector(".iso-solid").toggleAttribute("data-lit", thinking);
  // Ripple drawn by the app, lighting pixels as it passes.
  const rt = t - START.light;
  const radius = rt >= 0 ? 4 + rt * 70 : 0;
  const fade = rt >= 0 ? 1 - smooth(rt / (PHASES[6][1] + PHASES[7][1])) : 0;
  ripple.setAttribute("d", fade > 0.01 ? ringPath(cx, FINGER_Y, radius) : "");
  ripple.style.opacity = fade.toFixed(3);
  ripple2.setAttribute("d", fade > 0.01 && radius > 14 ? ringPath(cx, FINGER_Y, radius - 10) : "");
  ripple2.style.opacity = (fade * 0.5).toFixed(3);
  columns.forEach((g, i) => {
    const sx = SUB_X[i];
    const d = Math.hypot(sx - cx, 5 - FINGER_Y);
    const band = fade > 0.01 ? Math.exp(-(((d - radius) / 9) ** 2)) * fade : 0;
    const o = (0.22 + 0.78 * band).toFixed(2);
    if (g.getAttribute("opacity") !== o) g.setAttribute("opacity", o);
  });
  // Taptic Engine: a decaying shake of the mass on its springs.
  const ht = t - START.app - 0.15;
  const dx = ht >= 0 && ht < 1.2 ? 3.2 * Math.exp(-ht / 0.28) * Math.sin(ht * Math.PI * 2 * 4.2) * smooth(ht / 0.05) : 0;
  mass.setAttribute("transform", translateAlong(P, [dx, 0, 0]));
  mass.querySelector(".iso-solid").toggleAttribute("data-lit", Math.abs(dx) > 0.15);
  const left = coil(TAPTIC.x + 1.2, MASS.x + dx, [COIL.cy, COIL.cz], COIL.r, 5, "x", P);
  const right = coil(MASS.x + MASS.w + dx, TAPTIC.x + TAPTIC.w - 1.2, [COIL.cy, COIL.cz], COIL.r, 5, "x", P);
  coilBack.setAttribute("d", left.back);
  coilLeft.setAttribute("d", left.front);
  coilRBack.setAttribute("d", right.back);
  coilFront.setAttribute("d", right.front);
  // Readout: real time on the model's clock.
  const ms = t < 0 ? null : realAt(t);
  let text;
  const col = columnOf(tapX) + 1, row = TX.indexOf(FINGER_Y) + 1;
  if (ms === null) text = "Rx " + (columnOf(x) + 1) + " · Tx " + row + " · " + HZ + " Hz";
  else if (ms < TOTAL) { const s = STAGES.find((s) => ms < realStart[s.key] + s.ms) || STAGES[STAGES.length - 1]; text = ms.toFixed(1) + " ms · " + s.say; }
  else text = "Rx " + col + " × Tx " + row + " · lit after " + TOTAL.toFixed(1) + " ms";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(columnOf(x) + 1));
  stage.setAttribute("aria-valuetext", text);
}

function tap() {
  if (tapAt >= 0 && clock - tapAt < LENGTH) return;
  tapX = x = target = RX[clamp(columnOf(target), 0, RX.length - 1)];
  if (still.matches) { tapAt = clock - START.up - 0.01; draw(); return; }
  tapAt = clock; run();
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now; clock += dt;
  const busy = tapAt >= 0 && clock - tapAt < LENGTH;
  if (touring && !busy && clock > tourNext) {
    const stops = [-90, 40, -20, 100, -60, 70];
    target = stops[Math.floor(clock / 7) % stops.length];
    if (Math.abs(target - x) < 1) { tap(); tourNext = clock + LENGTH + 1.4; }
  }
  if (!busy) { x = x + (target - x) * (1 - Math.exp(-dt / 0.3)); if (Math.abs(target - x) < 0.05) x = target; }
  draw();
  const settled = !touring && !busy && x === target;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const quiet = () => { touring = false; clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; tourNext = clock + 0.5; run(); }, 5000); run(); };
const steer = (next) => { target = clamp(next, REACH[0], REACH[1]); quiet(); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
const share = (event) => { const box = svg.getBoundingClientRect(); return clamp(((event.clientX - box.left) / box.width - 0.22) / 0.56, 0, 1); };
stage.addEventListener("pointermove", (event) => { if (event.pointerType === "mouse") steer(REACH[0] + share(event) * (REACH[1] - REACH[0])); });
stage.addEventListener("click", (event) => { steer(REACH[0] + share(event) * (REACH[1] - REACH[0])); if (event.pointerType !== "mouse") x = target; tap(); });
stage.addEventListener("keydown", (event) => {
  const here = clamp(columnOf(target), 0, RX.length - 1);
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = Math.min(RX.length - 1, here + 1);
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = Math.max(0, here - 1);
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = RX.length - 1;
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); quiet(); tap(); return; }
  if (to === null) return;
  event.preventDefault();
  steer(clamp(RX[to], REACH[0], REACH[1]));
});
draw();
`;

const CSS = `
.ph-glass>.iso-fill{fill-opacity:.3}
.ph-glass>.iso-top{opacity:.35}
.ph-glass>.iso-shade{opacity:.8}
.ph-sub[data-c="r"]{fill:var(--anatomy-red)}
.ph-sub[data-c="g"]{fill:var(--anatomy-green)}
.ph-sub[data-c="b"]{fill:var(--anatomy-blue)}
.ph-pulse{fill:var(--anatomy-lit);stroke:var(--anatomy-card);stroke-width:.8}
.iso-stage{cursor:pointer;outline:none;touch-action:manipulation}
.iso-stage:focus-visible{box-shadow:0 0 0 1px var(--anatomy-mid)}
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "One tap, glass to pixel",
  hint: "Hover to aim · click or Enter to tap",
  readout: `Rx 15 · Tx ${TX.indexOf(FINGER_Y) + 1} · ${HZ} Hz`,
  keys: [
    { mark: "lit", label: "What the signal is doing now: finger, sensed column, pulse, chip, pixels, haptic mass" },
    { mark: "raised", label: "Display stack cut back in steps: glass, touch sensor, OLED, midframe" },
    { mark: "red", label: "OLED subpixels" },
  ],
  caption:
    `A robot finger taps a phone the size of an iPhone 15 Pro (146.6 × 70.6 mm). The touch sensor is a grid of transmit rows and receive columns about 5 mm apart; a fingertip pulls charge from the crossing under it, and the controller finds that crossing on its next scan. The report runs down the display flex to the A17 Pro. At ${HZ} Hz one frame is ${FRAME.toFixed(1)} ms: the app handles the touch in one frame, the GPU renders it in the next, and the panel scans it out in a third, so in this model the pixels change about ${TOTAL.toFixed(0)} ms after the finger lands. That counts half a frame of average scan wait plus 1 ms for the report. The Taptic Engine fires as the app handles the touch. The display layers are drawn about 3× thick and the pixels about 35× large.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Phone touch test: arrow keys move the finger column by column, Enter taps" aria-valuemin="1" aria-valuemax="${RX.length}" aria-valuenow="15">${svg}</div>`,
});

const page = k.pageHtml({ title: "Glass to Pixel", theme, body, script: kitScript() + live }).replace("</style>", CSS + "</style>");
const name = theme === "light" ? "iphone-tap-light.html" : "iphone-tap.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, (page.length / 1024).toFixed(0) + " KB");
