/**
 * 規則常量（對照 game.py / 術語規定.md）
 *
 * - h 縫隙（橫向，row 之間）只能 a/d（左右）
 * - v 縫隙（縱向，col 之間）只能 w/s（上下）
 * - side 邊界：above/left 含 line（<=），below/right 不含（>）
 */

/** 方向：w 上 / s 下 / a 左 / d 右 */
export type Direction = 'w' | 's' | 'a' | 'd';

/** 縫隙型別：h 橫向（row 之間）/ v 縱向（col 之間） */
export type GapType = 'h' | 'v';

/** 座標（row 向下、col 向右為正） */
export type Cell = readonly [number, number];

export const DIRECTION_DELTA: Record<Direction, Cell> = {
  w: [-1, 0],
  s: [1, 0],
  a: [0, -1],
  d: [0, 1],
};

/** h 縫隙的合法移動方向 */
export const VALID_DIRECTIONS_FOR_GAP: Record<GapType, readonly Direction[]> = {
  h: ['a', 'd'],
  v: ['w', 's'],
};

export function isValidDirectionForGap(gap: GapType, dir: Direction): boolean {
  return VALID_DIRECTIONS_FOR_GAP[gap].includes(dir);
}

/**
 * mod 不變量：step > 1 時，每次合法移動使每塊的 (r % step, c % step) 永不變。
 * 互動邏輯不依賴它，但務必保留此假設（日後接求解器/著色/連鎖時共用）。
 */
export function modGroupOf(r: number, c: number, step: number): number {
  return ((r % step) * step + (c % step)) >>> 0;
}
