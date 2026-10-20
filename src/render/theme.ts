/**
 * 畫風 token（對照 docs/theme.md；來源 GUI.py::self.colors 與 gui/renderer.py）
 * 單一來源，渲染與選單共用，禁止散落寫死色值。
 */

function rgb(r: number, g: number, b: number): string {
  return `rgb(${r}, ${g}, ${b})`;
}

export const COLORS = {
  background: rgb(30, 30, 30),
  block: rgb(60, 150, 200),
  block_selected: rgb(0, 200, 100),
  border: rgb(100, 100, 100),
  gap: rgb(80, 80, 80),
  line: rgb(255, 0, 0),
  grid: rgb(40, 40, 40),
  menu_bg: rgb(50, 50, 50),
  menu_hover: rgb(70, 70, 70),
  menu_text: rgb(220, 220, 220),
  menu_selected: rgb(80, 130, 180),
  status_bg: rgb(40, 40, 40),
  status_text: rgb(200, 200, 200),
  dialog_bg: rgb(45, 45, 48),
  dialog_border: rgb(100, 100, 100),
  dialog_text: rgb(230, 230, 230),
  dialog_title: rgb(255, 255, 255),
  solved: rgb(0, 200, 80),
  unsolved: rgb(200, 160, 0),
  input_bg: rgb(60, 60, 65),
  input_active: rgb(80, 80, 120),
  input_text: rgb(255, 255, 255),
  selection_bg: rgb(50, 80, 160),
  button_bg: rgb(70, 130, 180),
  button_hover: rgb(90, 150, 200),
  separator: rgb(80, 80, 80),
  timer_running: rgb(255, 200, 80),
  macro_base_mark: rgb(255, 200, 50),
  // 棋盤標記（原版 board_marks_enabled：目標框 + 洞/缺口/凸起記號，metrics_panel.py）
  mark_target: rgb(80, 220, 100),
  mark_hole_large: rgb(255, 80, 80),
  mark_hole_small: rgb(80, 160, 255),
  mark_protrusion: rgb(255, 210, 60),
  // 復原成功懸浮窗（原版 draw_solved_popup）
  popup_glow: rgb(130, 130, 140),
  popup_body: rgb(215, 215, 220),
  popup_score: rgb(240, 225, 150),
  popup_pb: rgb(255, 190, 90),
} as const;

export const GEOMETRY = {
  base_cell_size: 60,
  gap_width: 4,
  padding: 10,
  block_radius: 5, // 原版 int(5 * zoom)，zoom=1 時為 5
  block_border_width: 2, // 原版 max(1, int(2 * zoom))
  selected_line_width: 3,
  menu_bar_height: 32,
  status_bar_height: 28,
  right_panel_width: 132,
  min_width: 1000,
  min_height: 618,
} as const;

/** 原版 ease_out：1 - (1-t)^2 */
export function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * 介面字型：原版全 UI 都用 SimHei（黑體，`_gui_safe_font('SimHei', …)`）。
 * 這裡優先同名，其後才是跨平台的中文黑體替代，最後才退回系統預設。
 *
 * ⚠️ 為什麼要再掛一串 **TC（繁體）** 字型：介面文案歷史上是簡繁並存（見
 * `docs/remediation-plan.md` 第 2 項）。只給 SC 字型的話，遇到「謎/擬/鍵」這類
 * SC 字型沒收的字形，瀏覽器會跳出字型棧去系統預設字型裡找——**同一行文字裡
 * 簡體是黑體、繁體是別的字型**，就是玩家說的「繁簡字體混用」。
 * TC 字型排在 SC 之後：缺字時優先在黑體家族內補齊，而不是掉到系統預設。
 */
export const FONT_FAMILY =
  "'SimHei', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', 'Source Han Sans SC', "
  + "'PingFang TC', 'Noto Sans CJK TC', 'Microsoft JhengHei', 'Source Han Sans TC', "
  + 'system-ui, sans-serif';

export const TEXT = {
  solved: '状态：复原',
  unsolved: '状态：未复原',
  stepPrefix: '步数：',
  puzzlePrefix: '谜题：',
  // 原版選單列順序（GUI.py::self.menu_items）
  menuItems: ['文件', '编辑', '谜题', '宏定义', '设置', '帮助', '教程', '官网'],
} as const;
