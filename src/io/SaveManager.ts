/**
 * 存檔/導入（M4）：localStorage 自動快照 + 檔案下載/上傳 + 解析 map 文本。
 * 存檔 JSON 與原版完全一致（{version, puzzle, step_count, history:{history_index, snapshots}}）。
 */

import type { GameStore, SavePayload } from '../store/GameStore.js';

const STORAGE_KEY = 'gatennea-slider-web:last';

/** 移植原版 _compact_json_dumps：讓輸出格式與原版一字不差。 */
export function compactJsonDumps(data: unknown): string {
  const indent = 2;
  const maxLineWidth = 200;

  function format(obj: any, depth: number, sparse: boolean): string {
    const currentPad = ' '.repeat(depth * indent);
    const nextPad = ' '.repeat((depth + 1) * indent);

    if (obj === null) return 'null';
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      const allAtomic = obj.every((x) => typeof x === 'number' || typeof x === 'boolean' || x === null);
      if (allAtomic) {
        const inline = '[' + obj.map((x) => JSON.stringify(x)).join(', ') + ']';
        return inline;
      }
      const items = obj.map((x: any) => format(x, depth + 1, false));
      if (sparse) {
        const sep = ',\n';
        return '[\n' + items.map((it: string) => nextPad + it).join(sep) + '\n' + currentPad + ']';
      }
      const allSingle = items.every((it: string) => !it.includes('\n'));
      if (allSingle) {
        const inline = '[' + items.join(', ') + ']';
        if (inline.length <= maxLineWidth) return inline;
      }
      return '[\n' + items.map((it: string) => nextPad + it).join(',\n') + '\n' + currentPad + ']';
    }
    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length === 0) return '{}';
      const pairs = keys.map((k) => {
        const v = obj[k];
        const vStr = format(v, depth + 1, k === 'matrix' && Array.isArray(v) && v.length > 0 && Array.isArray(v[0]));
        return [JSON.stringify(k), vStr] as const;
      });
      const allSingle = pairs.every(([, v]) => !v.includes('\n'));
      if (allSingle) {
        const inline = '{' + pairs.map(([k, v]) => k + ': ' + v).join(', ') + '}';
        if (inline.length <= maxLineWidth) return inline;
      }
      return '{\n' + pairs.map(([k, v]) => nextPad + k + ': ' + v).join(',\n') + '\n' + currentPad + '}';
    }
    return JSON.stringify(obj);
  }

  return format(data, 0, false);
}

function puzzleTag(store: GameStore): string {
  return `${store.currentStep}~${store.currentM}*${store.currentN}`;
}

function nowStamp(): string {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const p4 = (n: number) => String(n).padStart(4, '0');
  return `${p4(d.getFullYear())}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
}

/** localStorage 自動快照（對照原版 temp_history.json）。 */
export function autosave(store: GameStore): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, compactJsonDumps(store.serialize()));
    return true;
  } catch {
    return false;
  }
}

/** 啟動時恢復 localStorage 快照。回傳是否恢復成功。 */
export function autoload(store: GameStore): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw) as SavePayload;
    return store.deserialize(p);
  } catch {
    return false;
  }
}

/** 下載存檔：內容與原版完全一致，檔名也沿用原版 step-m-n-日期時間.json。 */
export function downloadSave(store: GameStore): void {
  const p = store.serialize();
  const name = `${store.currentStep}-${store.currentM}-${store.currentN}-${nowStamp()}.json`;
  downloadText(name, compactJsonDumps(p));
}

/** 從 JSON 或 map 文本導入。回傳結果文案。 */
export function importData(store: GameStore, text: string): { ok: boolean; message: string } {
  const t = text.trim();
  if (!t) return { ok: false, message: '內容為空' };

  if (t[0] === '{') {
    try {
      const p = JSON.parse(t) as SavePayload;
      if (store.deserialize(p)) return { ok: true, message: '已導入存檔' };
      return { ok: false, message: '存檔內容不合法' };
    } catch {
      return { ok: false, message: 'JSON 解析失敗' };
    }
  }

  if (store.game.import_map(t)) {
    return { ok: true, message: '已導入 map' };
  }
  return { ok: false, message: 'map 解析失敗' };
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
