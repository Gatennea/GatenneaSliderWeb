/**
 * 成績記錄（M6）：按 puzzle 分組存 localStorage，統計 count/best/worst/ao5/ao12/dnf。
 * 對照 records.py 的語義（AoN 取最近 n 次、去掉最好與最差、DNF 視為無窮）。
 */

export interface RecordItem {
  id: string;
  ts: number;
  m: number;
  n: number;
  step: number;
  time_ms: number;
  moves: number;
  dnf: boolean;
  /**
   * 開局局面（打亂後的方塊座標），對照原版 records.py 的 initial_matrix。
   * 2026-10-19 才開始記錄，舊資料沒有這個欄位 → 讀取時要容許 undefined。
   */
  initial?: [number, number][];
}

export type RecordsMap = Record<string, RecordItem[]>;

const STORAGE_KEY = 'gatennea-slider-web:records';

/** 平均（AoN）。不足 n 次回 null；窗口內含 DNF 回 'DNF'；否則平均毫秒。 */
export function avgOf(times: (number | null)[], n: number): number | 'DNF' | null {
  if (times.length < n) return null;
  const window = times.slice(-n);
  const vals = window.map((t) => (t === null ? Infinity : t)).sort((a, b) => a - b);
  const trimmed = vals.slice(1, -1);
  if (trimmed.some((v) => v === Infinity)) return 'DNF';
  return trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
}

export interface Stats {
  count: number;
  best: number | null;
  worst: number | null;
  /** 所有有效（非 DNF）成績的平均；一筆有效都沒有時為 null */
  mean: number | null;
  dnf_count: number;
  ao5: number | 'DNF' | null;
  ao12: number | 'DNF' | null;
}

export function stats(records: RecordItem[]): Stats {
  const times: (number | null)[] = records.map((r) => (r.dnf ? null : r.time_ms));
  const valid = times.filter((t): t is number => t !== null);
  return {
    count: records.length,
    best: valid.length ? Math.min(...valid) : null,
    worst: valid.length ? Math.max(...valid) : null,
    mean: valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : null,
    dnf_count: times.length - valid.length,
    ao5: avgOf(times, 5),
    ao12: avgOf(times, 12),
  };
}

export interface SeriesRow {
  item: RecordItem;
  /** 以這條成績為**結尾**的滑動窗口算出的 Ao5/Ao12（csTimer 風格，與原版 series() 同義） */
  ao5: number | 'DNF' | null;
  ao12: number | 'DNF' | null;
}

/**
 * 逐行成績：每條都帶上「到那一條為止」的 Ao5/Ao12。
 * 對照原版 records.py::series —— 列表是 csTimer 那種三列，不是只看最後一個平均值。
 */
export function series(records: RecordItem[]): SeriesRow[] {
  const times: (number | null)[] = records.map((r) => (r.dnf ? null : r.time_ms));
  return records.map((item, i) => ({
    item,
    ao5: avgOf(times.slice(0, i + 1), 5),
    ao12: avgOf(times.slice(0, i + 1), 12),
  }));
}

/** TPS（每秒步數），與原版同口徑：moves / 秒。時間 0 或無步數時回 0。 */
export function tpsOf(item: RecordItem): number {
  if (!item.time_ms || item.time_ms <= 0) return 0;
  return item.moves / (item.time_ms / 1000);
}

/** 取一系列 AoN 裡的最優（最小）有效值；沒有有效值回 null。 */
function bestAvg(values: (number | 'DNF' | null)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number');
  return nums.length > 0 ? Math.min(...nums) : null;
}

/**
 * 把一組方塊座標畫成等寬文字地圖（開局局面用）。
 * 正常化到左上角為原點，每格兩個字寬（██ / ··），讓 HTML 裡對齊得像棋盤。
 */
export function blocksToMap(blocks: [number, number][]): string[] {
  if (!blocks || blocks.length === 0) return [];
  const rows = blocks.map((b) => b[0]);
  const cols = blocks.map((b) => b[1]);
  const minR = Math.min(...rows);
  const maxR = Math.max(...rows);
  const minC = Math.min(...cols);
  const maxC = Math.max(...cols);
  const set = new Set(blocks.map(([r, c]) => `${r}:${c}`));
  const out: string[] = [];
  for (let r = minR; r <= maxR; r++) {
    let line = '';
    for (let c = minC; c <= maxC; c++) line += set.has(`${r}:${c}`) ? '██' : '··';
    out.push(line);
  }
  return out;
}

export function puzzleKey(m: number, n: number, step: number): string {
  return `${step}~${m}*${n}`;
}

export class Records {
  private data: RecordsMap = {};

  constructor() {
    this.load();
  }

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.data = raw ? (JSON.parse(raw) as RecordsMap) : {};
    } catch {
      this.data = {};
    }
  }

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* ignore */
    }
  }

  /** numbered：數字形態另算一組（對照原版 puzzle_key 的 #num 後綴）。 */
  add(
    m: number,
    n: number,
    step: number,
    timeMs: number,
    moves: number,
    dnf: boolean,
    numbered = false,
    initial?: [number, number][],
  ): RecordItem {
    const item: RecordItem = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      m,
      n,
      step,
      time_ms: Math.round(timeMs),
      moves,
      dnf,
    };
    if (initial && initial.length) item.initial = initial;
    const key = numbered ? `${puzzleKey(m, n, step)}#num` : puzzleKey(m, n, step);
    (this.data[key] ??= []).push(item);
    this.save();
    return item;
  }

  /**
   * 競速成績錄入 + PB 判定（對照原版 _last_timed_result 的 pb_single/pb_ao5/pb_ao12）。
   * 先算「加入前」的最優基線，加入後再比對：
   *   single：本條破歷史最快；ao5/ao12：以本條為結尾的平均創歷史新低。
   */
  addTimed(
    m: number,
    n: number,
    step: number,
    timeMs: number,
    moves: number,
    dnf: boolean,
    numbered = false,
    initial?: [number, number][],
  ): { item: RecordItem; pb: { single: boolean; ao5: boolean; ao12: boolean } } {
    const key = numbered ? `${puzzleKey(m, n, step)}#num` : puzzleKey(m, n, step);
    const before = this.data[key] ?? [];
    const bestSingleBefore = stats(before).best;
    const bestAo5Before = bestAvg(series(before).map((r) => r.ao5));
    const bestAo12Before = bestAvg(series(before).map((r) => r.ao12));
    const item = this.add(m, n, step, timeMs, moves, dnf, numbered, initial);
    const rows = series(this.get(key));
    const last = rows[rows.length - 1];
    const ok = !item.dnf;
    return {
      item,
      pb: {
        single: ok && (bestSingleBefore === null || item.time_ms < bestSingleBefore),
        ao5: ok && typeof last.ao5 === 'number' && (bestAo5Before === null || last.ao5 < bestAo5Before),
        ao12: ok && typeof last.ao12 === 'number' && (bestAo12Before === null || last.ao12 < bestAo12Before),
      },
    };
  }

  get(key: string): RecordItem[] {
    return this.data[key] ?? [];
  }
  delete(key: string, id: string): boolean {
    const list = this.data[key];
    if (!list) return false;
    const idx = list.findIndex((r) => r.id === id);
    if (idx < 0) return false;
    list.splice(idx, 1);
    if (list.length === 0) delete this.data[key];
    this.save();
    return true;
  }

  allKeys(): string[] {
    return Object.keys(this.data);
  }
}
