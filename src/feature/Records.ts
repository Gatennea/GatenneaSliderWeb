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
    dnf_count: times.length - valid.length,
    ao5: avgOf(times, 5),
    ao12: avgOf(times, 12),
  };
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

  add(m: number, n: number, step: number, timeMs: number, moves: number, dnf: boolean): RecordItem {
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
    const key = puzzleKey(m, n, step);
    (this.data[key] ??= []).push(item);
    this.save();
    return item;
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
