/**
 * 計時器（M5，對照原版競速狀態機）
 * 狀態：idle（待打亂）→ ready（就緒，空格開始）→ running → solved | dnf
 */

export type TimerState = 'idle' | 'ready' | 'running' | 'solved' | 'dnf';

export function formatTime(ms: number | null): string {
  if (ms === null) return '-';
  const total = ms / 1000;
  const minutes = Math.floor(total / 60);
  const sec = total - minutes * 60;
  if (minutes > 0) return `${minutes}:${sec.toFixed(2).padStart(5, '0')}`;
  return sec.toFixed(2);
}

export class Timer {
  state: TimerState = 'idle';
  private startMs = 0;
  private endMs = 0;

  get elapsedMs(): number {
    if (this.state === 'running') return performance.now() - this.startMs;
    if (this.state === 'solved' || this.state === 'dnf') return this.endMs - this.startMs;
    return 0;
  }

  /** 打亂完成後進入 ready（就緒，空格開始）。 */
  enterReady(): void {
    this.state = 'ready';
    this.startMs = 0;
    this.endMs = 0;
  }

  /** 取消計時 / 切模式 / 換謎題：回到 idle（待打亂）。 */
  cancel(): void {
    this.state = 'idle';
    this.startMs = 0;
    this.endMs = 0;
  }

  /** 首次合法移動或按空白：ready → running。 */
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
    if (this.state !== 'running') return;
    this.state = 'dnf';
    this.endMs = performance.now();
  }

  get isRunning(): boolean {
    return this.state === 'running';
  }
}
