export type WeaponType = "blade" | "bow" | "hammer" | "shield" | "spear";

export const WEAPON_PIXEL_GRIDS: Record<WeaponType, string[]> = {
  blade: [
    "..............#.",
    ".............##.",
    "............##=.",
    "...........##=..",
    "..........##=...",
    ".........##=....",
    "........##=.....",
    ".......##=......",
    "......##=.......",
    ".....##=........",
    "....##=.........",
    "...##==.........",
    "..#####.........",
    ".##=##..........",
    ".#=.............",
    "................",
  ],
  bow: [
    "....#...........",
    "...##...........",
    "..##...........=",
    ".##...........=.",
    ".#...........=..",
    "#...........=...",
    "#..........=....",
    "#.........=.....",
    "#.........=.....",
    "#..........=....",
    "#...........=...",
    ".#...........=..",
    ".##...........=.",
    "..##...........=",
    "...##...........",
    "....#...........",
  ],
  hammer: [
    "................",
    "....#######.....",
    "...#########....",
    "...##=====##....",
    "...##=====##....",
    "...#########....",
    "....#######.....",
    "......###.......",
    "......###.......",
    "......###.......",
    "......###.......",
    "......###.......",
    "......###.......",
    "......###.......",
    "......#=........",
    "................",
  ],
  shield: [
    "................",
    "....########....",
    "...##########...",
    "..############..",
    "..##=======##...",
    "..##=======##...",
    "..##==###==##...",
    "..##==###==##...",
    "..##=======##...",
    "...##=====##....",
    "....##===##.....",
    ".....##=##......",
    "......###.......",
    ".......#........",
    "................",
    "................",
  ],
  spear: [
    "........#.......",
    ".......##.......",
    "......##=.......",
    ".....##=........",
    "....##=.........",
    "...##=..........",
    "..##............",
    ".##.............",
    "##..............",
    "#...............",
    "#...............",
    "##..............",
    ".##.............",
    "..#.............",
    "................",
    "................",
  ],
};

export function toPixelGrid(rows: string[]): number[][] {
  return rows.map((row) =>
    row.split("").map((ch) => {
      if (ch === "#") return 1;
      if (ch === "=") return 2;
      return 0;
    })
  );
}

export function weaponSvg(
  weaponType: WeaponType,
  size: number = 64,
  primaryColor: string = "#4fc3f7",
  accentColor: string = "#81d4fa"
): string {
  const grid = toPixelGrid(WEAPON_PIXEL_GRIDS[weaponType]);
  const rows = grid.length;
  const cols = grid[0]?.length ?? 16;
  const pixelW = size / cols;
  const pixelH = size / rows;

  const rects: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = grid[r][c];
      if (val === 0) continue;
      const color = val === 1 ? primaryColor : accentColor;
      const x = (c * pixelW).toFixed(2);
      const y = (r * pixelH).toFixed(2);
      const w = pixelW.toFixed(2);
      const h = pixelH.toFixed(2);
      rects.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${rects.join("")}</svg>`;
}

export interface BuiltinSkillDef {
  id: string;
  name: string;
  weaponType: WeaponType;
  description: string;
  actionLabel: string;
  themeColors: { primary: string; secondary: string; accent: string };
}

/** No builtin skills — users import their own. */
export const BUILTIN_SKILLS: BuiltinSkillDef[] = [];
