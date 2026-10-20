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
  /** 與 blocks 一一對應的編號（僅數字形態有值）；缺了就當成沒有編號。 */
  numbers?: (number | null)[];
}

export class SliderMatrix {
  m: number;
  n: number;
  blocks: Block[];

  /**
   * 自定義「目標形狀」（座標集合 "r:c"）。
   * - 為 null 時：is_solved 走原本的「m×n 實心矩形」判定（練習 / 競速 / 教程沿用）。
   * - 非 null 時：is_solved 改為「當前所有滑塊位置恰好等於此集合」（創造模式手造形狀用）。
   */
  solutionMask: Set<string> | null = null;

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

    // 創造模式：比對自定義目標形狀（不要求矩形）
    if (this.solutionMask) {
      if (this.blocks.length !== this.solutionMask.size) return false;
      const pos = new Set(this.blocks.map((b) => `${b.row}:${b.col}`));
      for (const p of this.solutionMask) {
        if (!pos.has(p)) return false;
      }
      return true;
    }

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

  /**
   * 安全打亂（保證打亂出來的局面一定有解）。
   *
   * 背景與**效力邊界**（2026-10-18 實測校正，別再照舊文案理解）：
   *   · 本遊戲確實存在「走得到卻回不去」的局面，但**極稀少**：完整版 C++ 引擎全圖
   *     復現 (4,4,2) 得可達局面 558,286 個、其中死局僅 **9 個**（≈0.0016%），
   *     踏入死局的入口弧只有 7 條；(3,3,1) 則是 0 個（本倉庫 scripts/probe-deadends.mjs
   *     獨立窮盡 9,908 個局面亦為 0，與原版引擎的 1,284 個 D4 形狀類、上帝之數 10 對上）。
   *   · 「單步不可逆」**不等於**死局：原版測得 (4,4,2) 有約 14% 的邊原路反推不合法
   *     （推完就黏住了），但其中絕大多數繞路仍走得回來 —— 用不可逆邊的數量來論證
   *     「打亂會把人送進死局」是過度推論，本站先前的文案就是這樣寫錯的。
   *   · 所以本改動的價值**不在**「避開那 0.0016%」（雖然確實也避掉了），而在：
   *     打亂出來的開局**自帶一條已知解法**（就是這條路徑反過來），於是指示一步、
   *     自動求解、關卡生成永遠有答案，不必仰賴求解器碰運氣。
   *
   * 做法：與 shuffle() 完全相同的隨機走法，但**每一步都多一道可逆性校驗** ——
   * 推完之後立刻試著用同一條縫、反方向推回去，能精確回到移動前的局面才採用，
   * 否則還原再挑。這樣整條打亂路徑反過來就是一條合法解法，必定可以還原。
   *
   * @param path 可選：逐步記下經過的每個局面（長度 = 成功步數 + 1）。
   *   因為每一步都可逆，這串局面**反過來就是一條合法解法**，Debug 與驗證用。
   *   scripts/certify-shuffle.mjs 會把這條解法**真的逐step走一遍**（每一步都由
   *   opt/try_move/commit_move 判定為合法走法，末端由 is_solved() 判定為已還原），
   *   交出可獨立覆核的見證，而不只是邏輯推論。
   * @returns 真正走成功的步數（可能少於 attempts：某些局面找不到任何可逆走法）
   */
  shuffle_safe(
    attempts: number,
    step: number,
    rng: () => number = Math.random,
    path?: Snapshot[],
  ): number {
    let done = 0;
    if (path) path.push(this.snapshot());
    for (let i = 0; i < attempts; i++) {
      if (this.shuffleStepSafe(step, rng)) {
        done++;
        if (path) path.push(this.snapshot());
      }
    }
    this.selected.clear();
    return done;
  }

  /** 打亂一步（必須可逆）。回傳是否真的走了一步。 */
  private shuffleStepSafe(step: number, rng: () => number, tries = 40): boolean {
    const gaps = this.candidateGaps();
    if (gaps.length === 0) return false;

    for (let t = 0; t < tries; t++) {
      const gap = gaps[Math.floor(rng() * gaps.length) % gaps.length];
      const direction: Direction =
        gap.type === 'h' ? (rng() < 0.5 ? 'a' : 'd') : rng() < 0.5 ? 'w' : 's';
      const block = this.blocks[Math.floor(rng() * this.blocks.length) % this.blocks.length];

      // 輕量快照：只記座標。刻意不用 snapshot()/restore() —— 那會重建整個
      // Block 陣列，而失敗嘗試很常見（8×8 實測佔用大量時間），純屬浪費。
      const beforeLoc = this.blocks.map((b) => [b.row, b.col] as [number, number]);
      const beforeKey = new Set(beforeLoc.map(([r, c]) => `${r}:${c}`));

      this.opt(gap.type, gap.line, block);
      const moved = [...this.selected];
      if (moved.length === 0) {
        this.selected.clear();
        continue;
      }
      const finalPositions = this.try_move(direction, step);
      if (!finalPositions) {
        this.selected.clear();
        continue;
      }
      this.commit_move(finalPositions);

      // 可逆性：同一條縫、反方向推，能否精確回到移動前的局面
      const reversible = this.canUndoWith(
        gap.type, gap.line, moved[0], oppositeOf(direction), step, beforeKey,
      );
      this.selected.clear();
      if (reversible) return true;

      // 輕量回滾：直接把座標改回去（也保留了 Block.number，比 restore 更省）
      this.blocks.forEach((b, i) => {
        b.location = beforeLoc[i];
      });
    }
    return false;
  }

  /** shuffle() 用的候選縫隙清單（刻意不含邊界縫，與原版一致）。 */
  private candidateGaps(): { type: GapType; line: number }[] {
    const { min_row, max_row, min_col, max_col } = this.get_boundaries();
    const gaps: { type: GapType; line: number }[] = [];
    for (let line = min_row + 1; line < max_row; line++) {
      if (this.is_valid_h_line(line)) gaps.push({ type: 'h', line });
    }
    for (let line = min_col + 1; line < max_col; line++) {
      if (this.is_valid_v_line(line)) gaps.push({ type: 'v', line });
    }
    return gaps;
  }

  /**
   * 從當前局面用同一條縫、反方向推，能否精確回到 targetKey 描述的局面。
   *
   * 只有在 opt 選中的分量與當初推動的那組完全一致時才成立 —— 若移動後該分量
   * 與別的方塊黏成更大一坨，玩家也沒辦法只推回原來那部分，故判定為不可逆。
   * （保守但安全：寧可少走一步，也不放行任何可能回不去的操作。）
   */
  private canUndoWith(
    gapType: GapType,
    line: number,
    representative: Block,
    backDirection: Direction,
    step: number,
    targetKey: Set<string>,
  ): boolean {
    this.opt(gapType, line, representative);
    const selectedNow = [...this.selected];
    if (selectedNow.length === 0) return false;
    const back = this.try_move(backDirection, step);
    if (!back) return false;

    const selectedKey = new Set(selectedNow.map((b) => `${b.row}:${b.col}`));
    const union = new Set<string>();
    for (let i = 0; i < selectedNow.length; i++) union.add(`${back[i][0]}:${back[i][1]}`);
    for (const b of this.blocks) {
      const key = `${b.row}:${b.col}`;
      if (!selectedKey.has(key)) union.add(key);
    }
    if (union.size !== targetKey.size) return false;
    for (const key of union) if (!targetKey.has(key)) return false;
    return true;
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

  /** 原地重設為 m×n 實心矩形（reset 用，避免外部 store 持有舊引用）。 */
  resetTo(m: number, n: number): void {
    this.m = m;
    this.n = n;
    this.blocks = [];
    this.selected.clear();
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        this.blocks.push(new Block([i, j]));
      }
    }
  }

  /** 快照當前版面（供 GameHistory 使用）。編號要一起帶走，否則撤銷會把數字弄丟。 */
  snapshot(): Snapshot {
    const snap: Snapshot = { blocks: this.blocks.map((b) => [b.row, b.col] as [number, number]) };
    if (this.blocks.some((b) => b.number !== null)) {
      snap.numbers = this.blocks.map((b) => b.number);
    }
    return snap;
  }

  /** 由快照還原版面。 */
  restore(snapshot: Snapshot) {
    this.blocks = snapshot.blocks.map(([r, c], i) => {
      const b = new Block([r, c]);
      b.number = snapshot.numbers?.[i] ?? null;
      return b;
    });
    this.selected.clear();
  }

  /**
   * 數字形態：按行主序把編號 1..m*n 寫進滑塊（對照 GUI.new_puzzle 的編號步驟）。
   * 版面被打亂後編號仍跟著各自滑塊，玩家靠它判斷「這塊原本該在哪」。
   */
  assignNumbers(enabled: boolean): void {
    this.blocks.forEach((b, i) => {
      b.number = enabled ? i + 1 : null;
    });
  }
}

/** 反方向（可逆性校验用）。刻意不放在 rules.ts —— 只打亂用得到，避免污染公共 API。 */
function oppositeOf(direction: Direction): Direction {
  switch (direction) {
    case 'w': return 's';
    case 's': return 'w';
    case 'a': return 'd';
    default: return 'a';
  }
}
