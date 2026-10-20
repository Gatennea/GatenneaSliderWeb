/**
 * 求解器 · 聚攏 + 填洞補缺（貪心爬山）
 *
 * 對照原版 solver/ml/gather_solver.py（max_overlap / find_best_window / gather_solve）
 * 與 solver/ml/hole_detector.py（detect_holes）。
 *
 * 為什麼不做 IDA*：原版 solver/__init__.py 的註冊表已把 IDA*／貪心爬山歸為
 * 「早期搜索類算法，相對現有宏級流水線已非常低效，保留只為備查」；
 * 真正有效的是**聚攏**與**填洞補缺**這條路線，本模組即照這條路線實作。
 *
 * 核心觀察（把三件事統一成一個目標函數）：
 *   設 T = 與當前局面重疊最高的 m×n（或 n×m）窗口，K = m*n。
 *   - 窗口內的空格 = 洞 + 缺口    → 填洞補缺
 *   - 窗口外的方塊 = 凸起        → 聚攏
 *   兩者都等價於「提高窗口內方塊數 overlap」；overlap == K 時即為已還原。
 * 因此爬山目標就是 overlap，洞/缺口/包圍盒面積只作為同分時的次要排序鍵。
 */

import {
  bbArea,
  blocksOf,
  boundsOf,
  enc,
  enumerateMoves,
  heuristic,
  isInverseAction,
  isSolvedState,
  type SolverAction,
  type State,
} from './model.js';

/** 目標窗口：左上角 (r0,c0)、朝向 (rh,cw)、與當局面的重疊數。 */
export interface TargetWindow {
  r0: number;
  c0: number;
  rh: number;
  cw: number;
  overlap: number;
}

/**
 * 找「聚攏度最高」的目標窗口（平移不變、轉置對稱）。
 * 對照 hole_detector.find_target_region（原版另有 mod 約束版 find_best_window，
 * 這裡先不引入 mod 約束——實測對聚攏目標的選窗影響極小，留待需要時再加）。
 */
export function findTargetWindow(state: State, m: number, n: number): TargetWindow {
  const coords = blocksOf(state);
  const total = m * n;
  if (coords.length === 0) return { r0: 0, c0: 0, rh: m, cw: n, overlap: 0 };

  const b = boundsOf(state);
  let best: TargetWindow = { r0: b.minR, c0: b.minC, rh: m, cw: n, overlap: -1 };

  for (const [rh, cw] of [
    [m, n],
    [n, m],
  ] as const) {
    for (let r0 = b.minR - rh + 1; r0 <= b.maxR; r0++) {
      for (let c0 = b.minC - cw + 1; c0 <= b.maxC; c0++) {
        let cnt = 0;
        for (const [r, c] of coords) {
          if (r >= r0 && r < r0 + rh && c >= c0 && c < c0 + cw) cnt++;
        }
        if (cnt > best.overlap) {
          best = { r0, c0, rh, cw, overlap: cnt };
          if (cnt === total) return best; // 已滿，不可能更好
        }
      }
    }
  }
  return best;
}

/** 窗口內的方塊數（爬山主目標）。 */
export function overlapWith(state: State, win: TargetWindow): number {
  let cnt = 0;
  for (const p of state) {
    // 直接用編碼值比對，避免逐塊解碼
    const r = (p >> 11) - 1024;
    const c = (p & 2047) - 1024;
    if (r >= win.r0 && r < win.r0 + win.rh && c >= win.c0 && c < win.c0 + win.cw) cnt++;
  }
  return cnt;
}

export interface HoleReport {
  /** 洞：被方塊包住的空格（不觸窗口邊緣） */
  holes: [number, number][][];
  /** 缺口：與窗口外緣相連的空格 */
  dents: [number, number][][];
  /** 凸起：落在窗口外的方塊 */
  protrusions: [number, number][];
  /** 窗口內空格總數（洞 + 缺口） */
  emptyInWindow: number;
}

/**
 * 偵測目標窗口內的洞與缺口、窗口外的凸起。
 * 對照 hole_detector.detect_holes：洪水填充連通空格區，
 * 觸及窗口邊緣者為 dent（缺口），否則為 hole（洞）。
 */
export function detectHoles(state: State, win: TargetWindow, step: number): HoleReport {
  const { r0, c0, rh, cw } = win;
  const grid: number[][] = [];
  for (let i = 0; i < rh; i++) grid.push(new Array(cw).fill(0));

  const protrusions: [number, number][] = [];
  for (const p of state) {
    const r = (p >> 11) - 1024;
    const c = (p & 2047) - 1024;
    if (r >= r0 && r < r0 + rh && c >= c0 && c < c0 + cw) {
      grid[r - r0][c - c0] = 1;
    } else {
      protrusions.push([r, c]);
    }
  }

  const seen: boolean[][] = [];
  for (let i = 0; i < rh; i++) seen.push(new Array(cw).fill(false));

  const holes: [number, number][][] = [];
  const dents: [number, number][][] = [];

  for (let i = 0; i < rh; i++) {
    for (let j = 0; j < cw; j++) {
      if (grid[i][j] !== 0 || seen[i][j]) continue;
      const cells: [number, number][] = [];
      let touchesEdge = false;
      const stack: [number, number][] = [[i, j]];
      seen[i][j] = true;
      while (stack.length > 0) {
        const [x, y] = stack.pop() as [number, number];
        cells.push([x + r0, y + c0]);
        const nbs: [number, number][] = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ];
        for (const [nx, ny] of nbs) {
          if (nx >= 0 && nx < rh && ny >= 0 && ny < cw) {
            if (grid[nx][ny] === 0 && !seen[nx][ny]) {
              seen[nx][ny] = true;
              stack.push([nx, ny]);
            }
          } else {
            touchesEdge = true; // 越界 = 與外緣相連
          }
        }
      }
      (touchesEdge ? dents : holes).push(cells);
    }
  }

  // step 只影響「洞夠不夠大、能不能整組推進去」的後續判斷，這裡先保留語義；
  // 目前爬山目標用不到它，但呼叫方可藉此決定要不要優先補大洞。
  void step;

  let emptyInWindow = 0;
  for (const g of holes) emptyInWindow += g.length;
  for (const g of dents) emptyInWindow += g.length;

  return { holes, dents, protrusions, emptyInWindow };
}

/**
 * 窗口外方塊到窗口的距離和（曼哈頓）。
 *
 * 這是讓爬山能動起來的關鍵：「窗口內方塊數」是階梯函數，把方塊推近窗口
 * 卻還沒推進去時得分完全不變，貪心只會在平原上亂撞（實測 6×6 成功率僅 5~25%、
 * 平均要一百多步）。加這個連續梯度後，貪心才有「往窗口靠」的方向感
 * —— 原版最有效的算法就叫「梯度聚攏」，正是這個意思。
 */
export function outsideDistance(state: State, win: TargetWindow): number {
  let d = 0;
  const r1 = win.r0 + win.rh - 1;
  const c1 = win.c0 + win.cw - 1;
  for (const p of state) {
    const r = (p >> 11) - 1024;
    const c = (p & 2047) - 1024;
    const dr = r < win.r0 ? win.r0 - r : r > r1 ? r - r1 : 0;
    const dc = c < win.c0 ? win.c0 - c : c > c1 ? c - c1 : 0;
    d += dr + dc;
  }
  return d;
}

// ---------- 爬山評分 ----------
interface Score {
  /** 窗口內方塊數：越大越好（聚攏 + 填洞補缺 的主目標） */
  overlap: number;
  /** 窗口外方塊到窗口的距離和：越小越好（連續梯度，防止卡在平原） */
  outside: number;
  /** 洞的格數：越少越好（洞比缺口難補，優先消） */
  holeCells: number;
  /** 包圍盒面積：越小越好（把形狀往實心矩形收） */
  area: number;
  /** 原版啟發值 h = 1 − Score：越小越好 */
  h: number;
}

function better(a: Score, b: Score): boolean {
  if (a.overlap !== b.overlap) return a.overlap > b.overlap;
  if (a.outside !== b.outside) return a.outside < b.outside;
  if (a.holeCells !== b.holeCells) return a.holeCells < b.holeCells;
  if (a.area !== b.area) return a.area < b.area;
  return a.h < b.h;
}

function scoreState(state: State, win: TargetWindow, step: number, m: number, n: number): Score {
  const rep = detectHoles(state, win, step);
  let holeCells = 0;
  for (const g of rep.holes) holeCells += g.length;
  return {
    overlap: overlapWith(state, win),
    outside: outsideDistance(state, win),
    area: bbArea(state),
    holeCells,
    h: heuristic(state, m, n),
  };
}

export interface GatherOptions {
  /** 最多走幾步（含踢步） */
  maxSteps?: number;
  /** 連續多少步沒有改善就換窗口重開一階段 */
  patience?: number;
  /** 最多重開幾個階段（對照原版 gradient_gather 的 max_stages） */
  maxStages?: number;
  /** 時間預算（毫秒），超時回傳 null */
  timeBudgetMs?: number;
  /** 亂數來源（測試要可重現） */
  rng?: () => number;
}

export interface GatherResult {
  actions: SolverAction[];
  /** 是否真的走到還原（false = 盡力但未完成，例如踩到死局或超出預算） */
  solved: boolean;
  steps: number;
}

/**
 * 聚攏求解：貪心爬山 + 卡死時隨機踢一步。
 *
 * 每一步：枚舉全部合法走法 → 用「與目標窗口的重疊數」評分 → 走最好的一步；
 * 若最好的一步也沒有比現況好，視為陷入平原，隨機踢一步重試，
 * 連續 patience 步無改善就放棄。
 *
 * 注意：本遊戲**存在合法但無法還原的死局**（見「相關數學問題」），
 * 所以失敗不代表程式有錯；solved=false 時呼叫方應如實告知玩家。
 */
export function solveByGather(
  state: State,
  m: number,
  n: number,
  step: number,
  opts: GatherOptions = {},
): GatherResult {
  const maxSteps = opts.maxSteps ?? 400;
  const patience = opts.patience ?? 40;
  const maxStages = opts.maxStages ?? 4;
  const timeBudgetMs = opts.timeBudgetMs ?? 5000;
  const rng = opts.rng ?? Math.random;
  /** 卡住時每隔幾步重選一次目標窗口（形狀會因踢步而改變） */
  const replanEvery = 12;
  /** 平原上每隔幾步隨機擾動一次（其餘時候走當下最好的一步） */
  const kickEvery = 5;

  const deadline = Date.now() + timeBudgetMs;
  let cur: State = new Set(state);
  const path: SolverAction[] = [];
  // 窗口在一個階段內固定：每步重選會讓目標一直漂，貪心反而沒有穩定方向
  let win = findTargetWindow(cur, m, n);
  let stuck = 0;
  let stage = 0;

  if (isSolvedState(cur, m, n)) return { actions: path, solved: true, steps: 0 };

  for (let i = 0; i < maxSteps; i++) {
    if (isSolvedState(cur, m, n)) return { actions: path, solved: true, steps: path.length };
    if (Date.now() > deadline) break;

    const curScore = scoreState(cur, win, step, m, n);
    const moves = enumerateMoves(cur, step).filter(
      (mv) => !path.length || !isInverseAction(path[path.length - 1], mv.action),
    );
    if (moves.length === 0) break; // 完全凍結的死局

    let bestMove: (typeof moves)[number] | null = null;
    let bestScore: Score | null = null;
    for (const mv of moves) {
      const s = scoreState(mv.next, win, step, m, n);
      if (bestScore === null || better(s, bestScore)) {
        bestScore = s;
        bestMove = mv;
      }
    }
    if (!bestMove || !bestScore) break;

    if (better(bestScore, curScore)) {
      cur = bestMove.next;
      path.push(bestMove.action);
      stuck = 0;
    } else {
      // 平原：先換目標窗口再說，真的沒救才隨機踢一步
      stuck++;
      if (stuck > patience) {
        stage++;
        if (stage > maxStages) break;
        win = findTargetWindow(cur, m, n);
        stuck = 0;
        continue;
      }
      if (stuck % replanEvery === 0) win = findTargetWindow(cur, m, n);
      // 平原時不再一律亂踢：填洞常常得先「惡化」一步（挪開讓出通道），
      // 純爬山拒絕任何惡化步就只能在原地亂撞。這裡改走當下最好的一步——
      // 有「到窗口的距離」這個連續梯度導引，它多半仍在往目標靠；
      // 只每隔幾步才隨機擾動一次，避免整條路線被同一個局部極值鎖死。
      if (stuck % kickEvery === 0) {
        const kick = moves[Math.floor(rng() * moves.length) % moves.length];
        cur = kick.next;
        path.push(kick.action);
      } else {
        cur = bestMove.next;
        path.push(bestMove.action);
      }
    }
  }

  return {
    actions: path,
    solved: isSolvedState(cur, m, n),
    steps: path.length,
  };
}

/**
 * 只挑「當下最好的一步」，不做完整求解。
 * 「提示一步」用這個：一步前瞻很便宜，且與求解器共用同一套評分標準，
 * 所以提示的方向一定不會跟自動求解的第一步打架。
 */
export function bestMove(
  state: State,
  m: number,
  n: number,
  step: number,
): { action: SolverAction; next: State } | null {
  const win = findTargetWindow(state, m, n);
  const curScore = scoreState(state, win, step, m, n);
  const moves = enumerateMoves(state, step);
  if (moves.length === 0) return null; // 完全凍結

  let bm: (typeof moves)[number] | null = null;
  let bs: Score | null = null;
  for (const mv of moves) {
    const s = scoreState(mv.next, win, step, m, n);
    if (bs === null || better(s, bs)) {
      bs = s;
      bm = mv;
    }
  }
  if (!bm || !bs) return null;
  // 當下沒有更好的一步時，仍然回傳最好的一步（可能等於現況）：
  // 提示的目的是給方向，寧可給一個「最接近目標」的，也不要空白。
  void curScore;
  return { action: bm.action, next: bm.next };
}

/**
 * 求解後的收尾：把連續「同一組來回推」的贅步壓掉，讓回放更乾淨。
 * 只移除相鄰的互逆步驟（其餘順序一律保留，避免破壞可行性）。
 */
export function trimPath(actions: SolverAction[]): SolverAction[] {
  const out: SolverAction[] = [];
  for (const a of actions) {
    const last = out[out.length - 1];
    if (last && isInverseAction(last, a)) out.pop();
    else out.push(a);
  }
  return out;
}

/** 方便外部從 SliderMatrix 的 blocks 建立狀態。 */
export function stateOf(blocks: readonly [number, number][]): State {
  const s: State = new Set();
  for (const [r, c] of blocks) s.add(enc(r, c));
  return s;
}
