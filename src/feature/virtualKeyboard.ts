/**
 * 虛擬鍵盤：純邏輯部分（佈局計算 + 粘滯連續播放 + 跳到某步）。
 *
 * DOM 長什麼樣由 `main.ts` 決定，這裡只回答三個問題：
 *   1. 面板多大、每個按鈕在哪（對照原版 `gui/virtual_keyboard.py` 的常數）
 *   2. 面板拖到哪裡算合法（原版 `_vk_clamp_position`：不能超出螢幕、不能壓住選單列/狀態列）
 *   3. 粘滯開關按下後「連續撤銷/重做」何時該停（原版 `_toggle_continuous` + `_stop_continuous_undo_redo`）
 *
 * 抽出來是為了能無頭測試——DOM 版的東西安靜地壞掉很難發現（面板被拖出螢幕、
 * 連續撤銷停不下來，都只有人肉點才會看到）。
 */

/** 對照原版 `VirtualKeyboardMixin` 的佈局常數（單位 px） */
export const VK = {
  title_h: 26,
  pad: 8,
  btn: 44,
  btn_gap: 6,
  action_btn_w: 62,
  action_btn_h: 32,
  sticky_w: 54,
  jump_h: 30,
  jump_input_w: 84,
  jump_btn_w: 48,
} as const;

export interface Rect { x: number; y: number; w: number; h: number }

/** 面板寬高：寬度固定（動作列決定），高度隨方向鍵行數變（方形 2 行 / 三角·米字 3 行） */
export function vkPanelSize(dirRows: number): { w: number; h: number } {
  const w = VK.pad * 2 + VK.action_btn_w * 2 + VK.sticky_w + VK.btn_gap * 2;
  const h = VK.title_h + VK.pad
    + VK.btn * dirRows + VK.btn_gap * dirRows
    + VK.action_btn_h + VK.btn_gap
    + VK.jump_h + VK.pad;
  return { w, h };
}

/** 方向鍵行數：網頁版只有矩形形態，恆為 2（原版三角/米字才是 3） */
export const vkDirectionRows = (): number => 2;

export interface VkLayout {
  panel: Rect;
  title: Rect;
  close: Rect;
  /** action 名 → 矩形。含 'sticky' / 'undo' / 'redo' 與 'move_*' */
  buttons: Record<string, Rect>;
  jumpInput: Rect;
  jumpBtn: Rect;
}

/**
 * 依面板左上角座標算出所有元件矩形（原版 `_vk_build_layout`）。
 * 水平一律以面板中線對稱排列，與原版 center_x 同義。
 */
export function vkBuildLayout(x: number, y: number, dirRows = vkDirectionRows()): VkLayout {
  const { w, h } = vkPanelSize(dirRows);
  const centerX = x + w / 2;
  const buttons: Record<string, Rect> = {};

  const topRowY = y + VK.title_h + VK.pad;
  // 方向鍵：上（第 1 行）；左 / 下 / 右（第 2 行）
  buttons['move_up'] = { x: centerX - VK.btn / 2, y: topRowY, w: VK.btn, h: VK.btn };
  const midRowY = topRowY + VK.btn + VK.btn_gap;
  buttons['move_left'] = {
    x: centerX - VK.btn - VK.btn_gap - VK.btn / 2, y: midRowY, w: VK.btn, h: VK.btn,
  };
  buttons['move_down'] = { x: centerX - VK.btn / 2, y: midRowY, w: VK.btn, h: VK.btn };
  buttons['move_right'] = {
    x: centerX + VK.btn_gap + VK.btn / 2, y: midRowY, w: VK.btn, h: VK.btn,
  };

  // 動作列：粘滯 + 撤銷 / 重做
  const actionRowY = topRowY + (VK.btn + VK.btn_gap) * dirRows;
  const totalActionW = VK.sticky_w + VK.action_btn_w * 2 + VK.btn_gap * 2;
  const actionStartX = centerX - totalActionW / 2;
  buttons['sticky'] = { x: actionStartX, y: actionRowY, w: VK.sticky_w, h: VK.action_btn_h };
  buttons['undo'] = {
    x: actionStartX + VK.sticky_w + VK.btn_gap, y: actionRowY,
    w: VK.action_btn_w, h: VK.action_btn_h,
  };
  buttons['redo'] = {
    x: actionStartX + VK.sticky_w + VK.action_btn_w + VK.btn_gap * 2, y: actionRowY,
    w: VK.action_btn_w, h: VK.action_btn_h,
  };

  // 跳到某步：步數輸入框 + 「跳到」按鈕
  const jumpRowY = actionRowY + VK.action_btn_h + VK.btn_gap;
  const jumpTotalW = VK.jump_input_w + VK.btn_gap + VK.jump_btn_w;
  const jumpStartX = centerX - jumpTotalW / 2;

  return {
    panel: { x, y, w, h },
    title: { x, y, w, h: VK.title_h },
    close: { x: x + w - VK.pad - 20, y: y + (VK.title_h - 20) / 2, w: 20, h: 20 },
    buttons,
    jumpInput: { x: jumpStartX, y: jumpRowY, w: VK.jump_input_w, h: VK.jump_h },
    jumpBtn: {
      x: jumpStartX + VK.jump_input_w + VK.btn_gap, y: jumpRowY, w: VK.jump_btn_w, h: VK.jump_h,
    },
  };
}

export interface VkViewport { width: number; height: number }
/** 上一層（選單列）與下一層（狀態列）的高度，面板不得壓上去 */
export interface VkChrome { top: number; bottom: number }

/**
 * 把面板左上角夾回可視範圍（原版 `_vk_clamp_position`）。
 * 面板比可視區還大時（極窄螢幕）優先把左上角貼到邊界，至少標題欄還看得到。
 */
export function vkClampPosition(
  pos: { x: number; y: number },
  viewport: VkViewport,
  size: { w: number; h: number },
  chrome: VkChrome,
): { x: number; y: number } {
  const maxX = Math.max(0, viewport.width - size.w);
  const maxY = Math.max(chrome.top, viewport.height - chrome.bottom - size.h);
  return {
    x: Math.max(0, Math.min(pos.x, maxX)),
    y: Math.max(chrome.top, Math.min(pos.y, maxY)),
  };
}

/**
 * 默認位置：原版 `vk_pos = [screen_width - 200, menu_bar_height + 60]`（右上角）。
 *
 * 注意面板寬是 206、不是 200，所以這個 x 一定會被 clamp 收進來 6px
 * （原版也是這樣：`_vk_clamp_position` 在每次繪製前跑）。別把這裡「改對」成
 * W-206——那會讓面板比原版更貼邊，右側留白不一樣。
 */
export function vkDefaultPosition(viewport: VkViewport, chrome: VkChrome): { x: number; y: number } {
  return vkClampPosition(
    { x: viewport.width - 200, y: chrome.top + 60 },
    viewport,
    vkPanelSize(vkDirectionRows()),
    chrome,
  );
}

export interface JumpResolution {
  ok: boolean;
  target: number;
  /** 輸入超出歷史長度、被夾到最後一步 */
  clamped: boolean;
  message: string;
}

/**
 * 「跳到某步」的目標步號（原版 `_vk_do_jump`）。
 *
 * 原版語義：超出範圍**不是報錯了事**，而是夾到最後一步並告訴使用者跳到哪
 * （"超出范围，已跳到第 N 步"）——玩家想跳到「最後」時不必知道確切步數。
 */
export function resolveJumpTarget(raw: string, historyLen: number): JumpResolution {
  if (raw.trim() === '') return { ok: false, target: 0, clamped: false, message: '' };
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, target: 0, clamped: false, message: '请输入步数' };
  }
  if (historyLen <= 0) return { ok: false, target: 0, clamped: false, message: '尚无歷史步骤' };
  if (n < 0) return { ok: false, target: 0, clamped: false, message: '步数不能为負' };
  if (n < historyLen) return { ok: true, target: n, clamped: false, message: `跳到第 ${n} 步` };
  const target = historyLen - 1;
  return { ok: true, target, clamped: true, message: `超出范围，已跳到第 ${target} 步` };
}

/**
 * 粘滯模式下的連續撤銷/重做（原版 `_toggle_continuous` + `_stop_continuous_undo_redo`）。
 *
 * 原版是**開關語義**：再按一次同一顆鍵就停，不是「按下去一路跑到頭」。
 * 網頁版舊實作是 `setInterval` 一路跑到 canUndo 為假才停，中途沒有任何停法
 * （連把粘滯關掉也停不下來）——這裡改成純狀態機，用 JS 這邊的計時器驅動。
 */
export class StickyPlayer {
  /** 粘滯開關：開=撤銷/重做連播；關=單步（原版 vk_sticky） */
  sticky = true;
  /** 正在連播的方向（null = 沒在播） */
  private playing: 'undo' | 'redo' | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** 連播間隔，原版是逐幀；這裡給一個看得清的節奏 */
  readonly intervalMs: number;

  constructor(
    private readonly step: (kind: 'undo' | 'redo') => void,
    private readonly canStep: (kind: 'undo' | 'redo') => boolean,
    intervalMs = 200,
  ) {
    this.intervalMs = intervalMs;
  }

  get isPlaying(): boolean { return this.playing !== null; }
  get playingKind(): 'undo' | 'redo' | null { return this.playing; }

  /**
   * 按下撤銷/重做。粘滯關 = 走一步；粘滯開 = 切換連播（正在播就停）。
   * @returns 是否真的走了至少一步（給呼叫方決定要不要提示）
   */
  press(kind: 'undo' | 'redo'): boolean {
    if (!this.sticky) {
      if (!this.canStep(kind)) return false;
      this.step(kind);
      return true;
    }
    if (this.playing === kind) { this.stop(); return false; }
    // 換方向：先把前一條停掉，避免兩個 interval 打架
    this.stop();
    if (!this.canStep(kind)) return false;
    this.playing = kind;
    this.step(kind);
    this.timer = setInterval(() => {
      if (!this.canStep(kind)) { this.stop(); return; }
      this.step(kind);
    }, this.intervalMs);
    return true;
  }

  /** 停止連播。切回單步、換局、關面板都該叫它，否則計時器會一直跑下去 */
  stop(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    this.playing = null;
  }

  /**
   * 切換粘滯開關。原版關掉粘滯時會連帶停止正在進行的連播
   * （`_stop_continuous_undo_redo`），保證切到單步後狀態是乾淨的。
   */
  toggleSticky(): boolean {
    this.sticky = !this.sticky;
    if (!this.sticky) this.stop();
    return this.sticky;
  }
}
