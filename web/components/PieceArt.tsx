import {formName} from "@/lib/brand";

/**
 * The five building forms.
 *
 * One camera and one light direction across all five: a 2:1 isometric projection with the
 * light from the upper right, so the top face is lightest, the right face mid, and the
 * left face darkest. The footprint is identical at every level and only the silhouette
 * grows, which is what makes the five read as one plot developed further rather than five
 * different buildings.
 *
 * Materials are deliberately neutral. Quarter colour is applied by the interface, never
 * baked into the art, and no two levels are coloured as a pair that would read as any
 * existing board game's pieces.
 *
 * Drawn rather than photographed so they stay crisp at any size and weigh nothing. The
 * art brief's 1024px PNGs are still worth commissioning for marketplaces and social
 * cards, which cannot render this.
 */

const BASE = {cx: 100, cy: 150, halfWidth: 58, halfDepth: 29} as const;

const FACE = {
  top: "#8a94a0",
  right: "#5c6672",
  left: "#3b434e",
  outline: "#2a313a",
} as const;

type Box = {
  /** Height of this box in user units. */
  height: number;
  /** How much narrower than the base footprint, 1 = full width. */
  scale: number;
  /** Vertical offset of this box's base above the ground plane. */
  lift: number;
};

function diamond(cy: number, hw: number, hd: number): string {
  const {cx} = BASE;
  return `M ${cx} ${cy - hd} L ${cx + hw} ${cy} L ${cx} ${cy + hd} L ${cx - hw} ${cy} Z`;
}

function leftFace(cy: number, hw: number, hd: number, h: number): string {
  const {cx} = BASE;
  return `M ${cx - hw} ${cy} L ${cx} ${cy + hd} L ${cx} ${cy + hd - h} L ${cx - hw} ${cy - h} Z`;
}

function rightFace(cy: number, hw: number, hd: number, h: number): string {
  const {cx} = BASE;
  return `M ${cx} ${cy + hd} L ${cx + hw} ${cy} L ${cx + hw} ${cy - h} L ${cx} ${cy + hd - h} Z`;
}

function Prism({height, scale, lift}: Box) {
  const hw = BASE.halfWidth * scale;
  const hd = BASE.halfDepth * scale;
  const baseY = BASE.cy - lift;

  return (
    <g>
      <path d={leftFace(baseY, hw, hd, height)} fill={FACE.left} />
      <path d={rightFace(baseY, hw, hd, height)} fill={FACE.right} />
      <path d={diamond(baseY - height, hw, hd)} fill={FACE.top} />
    </g>
  );
}

/** Rows of windows on both visible faces, spaced to read as storeys. */
function Windows({
  storeys,
  storeyHeight,
  scale,
  lift,
}: {
  storeys: number;
  storeyHeight: number;
  scale: number;
  lift: number;
}) {
  const {cx} = BASE;
  const hw = BASE.halfWidth * scale;
  const hd = BASE.halfDepth * scale;
  const baseY = BASE.cy - lift;
  const cells = [0.3, 0.55, 0.8];

  return (
    <g opacity="0.42">
      {Array.from({length: storeys}, (_, s) => {
        const y = baseY - (s + 0.55) * storeyHeight;
        return cells.map((t) => {
          // Points along each face edge, following the same isometric slope as the walls.
          const lx = cx - hw * t;
          const ly = y + hd * t;
          const rx = cx + hw * t;
          const ry = y + hd * t;
          return (
            <g key={`${s}-${t}`}>
              <rect x={lx - 3} y={ly - 3} width="6" height="5" fill="#cdd6e0" rx="0.5" />
              <rect x={rx - 3} y={ry - 3} width="6" height="5" fill="#e6ecf2" rx="0.5" />
            </g>
          );
        });
      })}
    </g>
  );
}

export function PieceArt({level, className = ""}: {level: number; className?: string}) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label={`${formName(level)}, level ${level}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* The plot. Identical at every level, so the footprint never appears to move. */}
      <path
        d={diamond(BASE.cy + 6, BASE.halfWidth + 10, BASE.halfDepth + 5)}
        fill="#161d25"
        stroke={FACE.outline}
        strokeWidth="1"
      />

      {level === 1 && <House />}
      {level === 2 && <Residence />}
      {level === 3 && <Building />}
      {level === 4 && <Tower />}
      {level === 5 && <Landmark />}
    </svg>
  );
}

/** Single storey, pitched roof. */
function House() {
  const {cx, cy} = BASE;
  const hw = BASE.halfWidth * 0.78;
  const hd = BASE.halfDepth * 0.78;
  const h = 26;
  const ridge = 20;

  return (
    <g>
      <Prism height={h} scale={0.78} lift={0} />
      {/* A ridge running along one axis, which is what makes it read as a roof rather
          than a box with a lid. */}
      <path
        d={`M ${cx - hw} ${cy - h} L ${cx} ${cy + hd - h} L ${cx} ${cy + hd - h - ridge} L ${cx - hw} ${cy - h - ridge * 0.5} Z`}
        fill="#6e7885"
      />
      <path
        d={`M ${cx} ${cy + hd - h} L ${cx + hw} ${cy - h} L ${cx + hw} ${cy - h - ridge * 0.5} L ${cx} ${cy + hd - h - ridge} Z`}
        fill="#9aa4b0"
      />
      <path
        d={`M ${cx - hw} ${cy - h - ridge * 0.5} L ${cx} ${cy + hd - h - ridge} L ${cx + hw} ${cy - h - ridge * 0.5} L ${cx} ${cy - hd - h - ridge * 0.5 + hd} Z`}
        fill="#b4bec9"
        opacity="0.9"
      />
    </g>
  );
}

/** Two to three storeys on the same plot. */
function Residence() {
  return (
    <g>
      <Prism height={52} scale={0.82} lift={0} />
      <Windows storeys={3} storeyHeight={17} scale={0.82} lift={0} />
      <Prism height={7} scale={0.88} lift={52} />
    </g>
  );
}

/** Mid-rise, flat roof, a visible grid of windows. */
function Building() {
  return (
    <g>
      <Prism height={84} scale={0.86} lift={0} />
      <Windows storeys={5} storeyHeight={17} scale={0.86} lift={0} />
      <Prism height={5} scale={0.9} lift={84} />
    </g>
  );
}

/** High-rise with setbacks. */
function Tower() {
  return (
    <g>
      <Prism height={62} scale={0.88} lift={0} />
      <Windows storeys={4} storeyHeight={15} scale={0.88} lift={0} />
      <Prism height={48} scale={0.68} lift={62} />
      <Windows storeys={3} storeyHeight={15} scale={0.68} lift={62} />
      <Prism height={30} scale={0.48} lift={110} />
      <Windows storeys={2} storeyHeight={14} scale={0.48} lift={110} />
    </g>
  );
}

/** The only level allowed a signature silhouette: a crown and a spire. */
function Landmark() {
  const {cx, cy} = BASE;
  const crownTop = cy - 168;

  return (
    <g>
      <Prism height={66} scale={0.9} lift={0} />
      <Windows storeys={4} storeyHeight={16} scale={0.9} lift={0} />
      <Prism height={46} scale={0.7} lift={66} />
      <Windows storeys={3} storeyHeight={15} scale={0.7} lift={66} />
      <Prism height={30} scale={0.5} lift={112} />
      <Windows storeys={2} storeyHeight={14} scale={0.5} lift={112} />

      {/* Crown: a tapered cap, then a spire. */}
      <path
        d={`M ${cx - BASE.halfWidth * 0.5} ${cy - 142} L ${cx} ${cy - 142 + BASE.halfDepth * 0.5} L ${cx} ${crownTop + 12} L ${cx - 6} ${crownTop + 16} Z`}
        fill="#6e7885"
      />
      <path
        d={`M ${cx} ${cy - 142 + BASE.halfDepth * 0.5} L ${cx + BASE.halfWidth * 0.5} ${cy - 142} L ${cx + 6} ${crownTop + 16} L ${cx} ${crownTop + 12} Z`}
        fill="#a7b1bd"
      />
      <path
        d={`M ${cx} ${crownTop + 14} L ${cx + 2.2} ${crownTop + 2} L ${cx} ${crownTop - 14} L ${cx - 2.2} ${crownTop + 2} Z`}
        fill="#dbb864"
      />
    </g>
  );
}
