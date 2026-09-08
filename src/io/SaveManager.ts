/**
 * 存檔/導入（M4）：localStorage 自動快照 + 檔案下載/上傳 + 解析 map 文本。
 *
 * 體驗版核心狀態用 map 文本（# / _），存檔 JSON 結構：
 *   { version, puzzle:{m,n,step}, step_count, map, history }
 */

import type { GameStore, SavePayload } from '../store/GameStore.js';

const STORAGE_KEY = 'gatennea-slider-web:last';

function puzzleTag(store: GameStore): string {
  return `${store.currentStep}~${store.currentM}*${store.currentN}`;
}

/** localStorage 自動快照（對照原版 temp_history.json）。 */
export function autosave(store: GameStore): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store.serialize()));
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

/** 下載存檔 JSON。 */
export function downloadSave(store: GameStore): void {
  const p = store.serialize();
  const name = `${puzzleTag(store)}-save.json`;
  downloadText(name, JSON.stringify(p, null, 2));
}

/** 從 JSON 或 map 文本導入。回傳結果文案。 */
export function importData(store: GameStore, text: string): { ok: boolean; message: string } {
  const t = text.trim();
  if (!t) return { ok: false, message: '內容為空' };

  // 先試 JSON
  if (t[0] === '{') {
    try {
      const p = JSON.parse(t) as SavePayload;
      if (store.deserialize(p)) return { ok: true, message: '已導入存檔' };
      return { ok: false, message: '存檔內容不合法' };
    } catch {
      return { ok: false, message: 'JSON 解析失敗' };
    }
  }

  // 否則視為 map 文本（# / _），沿用目前 puzzle 參數
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
