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

export const TEXT = {
  solved: '狀態：復原',
  unsolved: '狀態：未復原',
  stepPrefix: '步數：',
  puzzlePrefix: '謎題：',
  menuItems: ['文件', '編輯', '謎題', '宏', '設置'],
} as const;
