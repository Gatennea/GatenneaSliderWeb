/**
 * 計時器測試（M5）：狀態機 idle→ready→running→solved|dnf + formatTime 格式。
 */
import { Timer, formatTime } from '../dist/feature/Timer.js';

export const cases = [
  {
    name: '初始 idle，打亂 ready，start 後 running，solve 後 solved',
    run() {
      const t = new Timer();
      if (t.state !== 'idle') throw new Error('初始應 idle');
      if (t.start(), t.state !== 'idle') throw new Error('idle 下 start 不應變');
      t.enterReady();
      if (t.state !== 'ready') throw new Error('enterReady 後應 ready');
      t.start();
      if (t.state !== 'running') throw new Error('start 後應 running');
      t.solve();
      if (t.state !== 'solved') throw new Error('solve 後應 solved');
    },
  },
  {
    name: 'cancel 回 idle；dnf 進入 dnf',
    run() {
      const t = new Timer();
      t.enterReady();
      t.cancel();
      if (t.state !== 'idle') throw new Error('cancel 後應 idle');
      t.enterReady();
      t.start();
      t.dnf();
      if (t.state !== 'dnf') throw new Error('dnf 後應 dnf');
    },
  },
  {
    name: 'formatTime 輸出厘秒 / 分:秒格式',
    run() {
      if (formatTime(null) !== '-') throw new Error('null 應為 -');
      if (formatTime(0) !== '0.00') throw new Error('0 應為 0.00');
      if (formatTime(12340) !== '12.34') throw new Error('12340ms 應為 12.34');
      if (formatTime(83450) !== '1:23.45') throw new Error('83450ms 應為 1:23.45');
    },
  },
];
