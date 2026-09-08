/**
 * 滑塊矩陣核心邏輯（對照 game.py::SliderMatrix 逐函數移植）
 *
 * 移植紀律：分支結構與原版保持一致；只把選中旗標 be_opted
 * 從 Block 物件移到 `selected` 集合，語義不變。
 */

import { Block } from './Block.js';
import { DIRECTION_DELTA, type Cell, type Direction, type GapType } from './rules.js';

export interface Bounds {
  min_row: number;
  max_row: number;
  min_col: number;
  max_col: number;
}

export interface Snapshot {
  blocks: [number, number][];
}

export class SliderMatrix {
  m: number;
  n: number;
  blocks: Block[];

  /** 被選中的滑塊（對照原版 block.be_opted === true） */
  selected: Set<Block>;

  constructor(m = 6, n = 6) {
    this.m = m;
    this.n = n;
    this.blocks = [];
    this.selected = new Set();

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        this.blocks.push(new Block([i, j]));
      }
    }
  }

  get_boundaries(): Bounds {
    if (this.blocks.length === 0) {
      return { min_row: 0, max_row: 0, min_col: 0, max_col: 0 };
    }
    const rows = this.blocks.map((b) => b.row);
    const cols = this.blocks.map((b) => b.col);
    return {
      min_row: Math.min(...rows),
      max_row: Math.max(...rows),
      min_col: Math.min(...cols),
      max_col: Math.max(...cols),
    };
  }

  is_valid_h_line(line: number): boolean {
    const bounds = this.get_boundaries();
    return bounds.min_row <= line && line < bounds.max_row;
  }

  is_valid_v_line(line: number): boolean {
    const bounds = this.get_boundaries();
    return bounds.min_col <= line && line < bounds.max_col;
  }

  /**
   * 檢查移動後是否合法（碰撞 + 全體單一連通）。
   * 對照 game.py::check_move_valid。
   */
  static check_move_valid(
    selectedPositions: Set<string>,
    nonSelectedPositions: Set<string>,
  ): boolean {
    if (selectedPositions.size + nonSelectedPositions.size === 0) return true;
    for (const pos of selectedPositions) {
      if (nonSelectedPositions.has(pos)) return false; // collision
    }
    const all = new Set<string>([...selectedPositions, ...nonSelectedPositions]);
    return SliderMatrix.is_single_connected(all);
  }

  static is_single_connected(positions: Set<string>): boolean {
    if (positions.size === 0) return true;
    const start = positions.values().next().value as string;
    const visited = new Set<string>();
    const stack: string[] = [start];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const [r, c] = current.split(':').map(Number);
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const neighbor = `${r + dr}:${c + dc}`;
        if (positions.has(neighbor) && !visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }
    return visited.size === positions.size;
  }

  /**
   * 選中分割線一側、與選中滑塊連通的整片方塊。
   * 對照 game.py::opt（DFS）。
   * @returns 選中的位置集合（原版直接標 be_opted）
   */
  opt(gapType: GapType, line: number, selectedBlock: Block): Set<string> {
    // 清除舊選中（原版會先清所有 be_opted）
    this.selected.clear();

    const blockSet = new Set(this.blocks.map((b) => `${b.row}:${b.col}`));

    const isConnected = (a: Cell, b: Cell): boolean => {
      // 判斷兩個相鄰方塊是否在同一側（不被分割線隔開）
      if (gapType === 'h') {
        if ((a[0] <= line && b[0] > line) || (a[0] > line && b[0] <= line)) {
          return false;
        }
      } else {
        if ((a[1] <= line && b[1] > line) || (a[1] > line && b[1] <= line)) {
          return false;
        }
      }
      return true;
    };

    const start = selectedBlock.location as Cell;
    const visited = new Set<string>();
    const stack: Cell[] = [start];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const key = `${current[0]}:${current[1]}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const [row, col] = current;
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const neighbor: Cell = [row + dr, col + dc];
        const nKey = `${row + dr}:${col + dc}`;
        if (blockSet.has(nKey) && !visited.has(nKey) && isConnected(current, neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    // 依原版：把 visited 對應的方塊標為選中
    for (const b of this.blocks) {
      if (visited.has(`${b.row}:${b.col}`)) {
        this.selected.add(b);
      }
    }
    return visited;
  }

  /**
   * 預測移動（純邏輯，逐步 1 格驗證）。
   * 對照 game.py::try_move；不合法回傳 null。
   */
  try_move(direction: Direction, step: number): [number, number][] | null {
    const selected = this.blocks.filter((b) => this.selected.has(b));
    const nonSelectedPositions = new Set(
      this.blocks.filter((b) => !this.selected.has(b)).map((b) => `${b.row}:${b.col}`),
    );

    if (selected.length === 0) return null;

    const delta = DIRECTION_DELTA[direction];
    if (!delta) return null;

    let current: Cell[] = selected.map((b) => [b.row, b.col]);

    for (let k = 0; k < step; k++) {
      const next: Cell[] = current.map(([r, c]) => [r + delta[0], c + delta[1]]);
      const nextSet = new Set(next.map(([r, c]) => `${r}:${c}`));
      if (!SliderMatrix.check_move_valid(nextSet, nonSelectedPositions)) {
        return null;
      }
      current = next;
    }

    return current.map(([r, c]) => [r, c]);
  }

  /** 提交移動（對照 game.py::commit_move）。 */
  commit_move(finalPositions: [number, number][]) {
    const selected = this.blocks.filter((b) => this.selected.has(b));
    for (let i = 0; i < selected.length; i++) {
      selected[i].location = [finalPositions[i][0], finalPositions[i][1]];
    }
  }

  is_solved(): boolean {
    if (this.blocks.length === 0) return false;

    const rows = this.blocks.map((b) => b.row);
    const cols = this.blocks.map((b) => b.col);
    const minR = Math.min(...rows);
    const maxR = Math.max(...rows);
    const minC = Math.min(...cols);
    const maxC = Math.max(...cols);
    const height = maxR - minR + 1;
    const width = maxC - minC + 1;

    if (!((height === this.m && width === this.n) || (height === this.n && width === this.m))) {
      return false;
    }

    const posSet = new Set(this.blocks.map((b) => `${b.row}:${b.col}`));
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (!posSet.has(`${r}:${c}`)) return false;
      }
    }
    return true;
  }

  /**
   * 隨機打亂（對照 game.py::shuffle）。
   * 注意：刻意保留原版候選縫隙範圍 `range(min+1, max)` —— 不選邊界縫隙是「規定」，
   * 使網頁版行為與原版逐位元一致。
   */
  shuffle(attempts: number, step: number, rng: () => number = Math.random) {
    for (let i = 0; i < attempts; i++) {
      const bounds = this.get_boundaries();
      const { min_row, max_row, min_col, max_col } = bounds;

      const hLines: number[] = [];
      for (let line = min_row + 1; line < max_row; line++) {
        if (this.is_valid_h_line(line)) hLines.push(line);
      }
      const vLines: number[] = [];
      for (let line = min_col + 1; line < max_col; line++) {
        if (this.is_valid_v_line(line)) vLines.push(line);
      }
      const allGaps: { type: GapType; line: number }[] = [
        ...hLines.map((line) => ({ type: 'h' as GapType, line })),
        ...vLines.map((line) => ({ type: 'v' as GapType, line })),
      ];

      if (allGaps.length === 0) continue;

      const gap = allGaps[Math.floor(rng() * allGaps.length)];
      const direction: Direction = gap.type === 'h' ? (rng() < 0.5 ? 'a' : 'd') : rng() < 0.5 ? 'w' : 's';

      const block = this.blocks[Math.floor(rng() * this.blocks.length)];
      this.opt(gap.type, gap.line, block);

      const finalPositions = this.try_move(direction, step);
      if (!finalPositions) {
        this.selected.clear();
        continue;
      }

      this.commit_move(finalPositions);
      this.selected.clear();
    }
    this.selected.clear();
  }

  /** 導出 map 文本（#=方塊、_=空白）。對照 game.py::export_map。 */
  export_map(): string {
    const { min_row, max_row, min_col, max_col } = this.get_boundaries();
    const blockSet = new Set(this.blocks.map((b) => `${b.row}:${b.col}`));
    const rows: string[] = [];
    for (let row = min_row; row <= max_row; row++) {
      let line = '';
      for (let col = min_col; col <= max_col; col++) {
        line += blockSet.has(`${row}:${col}`) ? '#' : '_';
      }
      rows.push(line);
    }
    return rows.join('\n');
  }

  /** 導入 map 文本。對照 game.py::import_map。 */
  import_map(mapStr: string): boolean {
    const lines = mapStr
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return false;

    this.blocks = [];
    this.selected.clear();
    this.m = lines.length;
    this.n = lines[0]?.length ?? 0;

    for (let row = 0; row < lines.length; row++) {
      const line = lines[row];
      for (let col = 0; col < line.length; col++) {
        if (line[col] === '#') {
          this.blocks.push(new Block([row, col]));
        }
      }
    }
    return true;
  }

  /** 快照當前版面（供 GameHistory 使用）。 */
  snapshot(): Snapshot {
    return { blocks: this.blocks.map((b) => [b.row, b.col] as [number, number]) };
  }

  /** 由快照還原版面。 */
  restore(snapshot: Snapshot) {
    this.blocks = snapshot.blocks.map(([r, c]) => new Block([r, c]));
    this.selected.clear();
  }
}
