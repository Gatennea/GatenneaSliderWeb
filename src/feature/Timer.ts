/**
 * 計時器（M5）：狀態機 ready → running → solved | dnf。
 * 用 performance.now() 測量，elapsed 毫秒在 rAF 中刷新顯示。
 */

export type TimerState = 'ready' | 'running' | 'solved' | 'dnf';

export function formatTime(ms: number | null): string {
  if (ms === null) return '-';
  const total = ms / 1000;
  const minutes = Math.floor(total / 60);
  const sec = total - minutes * 60;
  if (minutes > 0) return `${minutes}:${sec.toFixed(2).padStart(5, '0')}`;
  return sec.toFixed(2);
}

export class Timer {
  state: TimerState = 'ready';
  private startMs = 0;
  private endMs = 0;

  get elapsedMs(): number {
    if (this.state === 'running') return performance.now() - this.startMs;
    return this.endMs - this.startMs;
  }

  /** 進入 ready（打亂後待開始）。 */
  reset(): void {
    this.state = 'ready';
    this.startMs = 0;
    this.endMs = 0;
  }

  /** 首次合法移動時開始計時。 */
  start(): void {
    if (this.state !== 'ready') return;
    this.state = 'running';
    this.startMs = performance.now();
  }

  /** 完成（solved 自動停錶）。 */
  solve(): number {
    if (this.state !== 'running') return this.elapsedMs;
    this.endMs = performance.now();
    this.state = 'solved';
    return this.elapsedMs;
  }

  /** 手動 DNF。 */
  dnf(): void {
    this.state = 'dnf';
    this.endMs = performance.now();
  }

  get isRunning(): boolean {
    return this.state === 'running';
  }
}
