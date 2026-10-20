/**
 * Canvas 棋盤渲染（M2：命中測試 + 選中縫隙紅線 + camera/zoom + 移動動畫）。
 *
 * 座標模型（對照 GUI.py，唯一真理源）：
 *   - CELL = base_cell_size、GAP = gap_width（未縮放基底）
 *   - 世界座標以「像素」為單位：滑塊(col,row) 左上角 = (col*(CELL+GAP), row*(CELL+GAP))
 *   - 世界 → 螢幕：screen = world * zoom + camera（不重複乘 zoom）
 *   - 縫隙 h line：y = (line+1)*(CELL+GAP) - GAP/2；v 同理
 */

import type { GameStore } from '../store/GameStore.js';
import type { Block } from '../core/Block.js';
import type { GapType, Direction } from '../core/rules.js';
import { COLORS, GEOMETRY, easeOut, FONT_FAMILY } from './theme.js';
import { DIRECTION_DELTA, VALID_DIRECTIONS_FOR_GAP } from '../core/rules.js';
import { ARROW_IMAGE_DATA_URI } from './arrowImage.js';
import { findTargetWindow, detectHoles } from '../solver/gather.js';
import { stateFromBlocks } from '../solver/model.js';
import { formatTime } from '../feature/Timer.js';
import { shakeAmpCells } from '../feature/dragFollow.js';

const CELL = GEOMETRY.base_cell_size;
const GAP = GEOMETRY.gap_width;

/** 移動動畫狀態 */
export interface MoveAnimation {
  /** 依序與 store.game.blocks 中的滑塊對應的 [起點, 終點] 位置(row,col 各為基數) */
  start: [number, number][];
  end: [number, number][];
  progress: number; // 0..1
  durationMs: number;
}

/** 復原懸浮窗的競速成績內容（對照原版 _last_timed_result 用到的欄位）。 */
export interface SolvedPopupResult {
  time_ms: number;
  moves: number;
  tps: number;
  dnf?: boolean;
  pb?: { single?: boolean; ao5?: boolean; ao12?: boolean };
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0; let g = 0; let b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = v - c;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** 把 rgb(r, g, b) 往白色提亮 amount（0~1），對照原版 _lighten。 */
function lightenCss(color: string, amount: number): string {
  const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return color;
  const ch = [Number(m[1]), Number(m[2]), Number(m[3])].map((c) => Math.round(c + (255 - c) * amount));
  return `rgb(${ch[0]}, ${ch[1]}, ${ch[2]})`;
}

export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  zoom: number;
  cameraX: number;
  cameraY: number;
  animation: MoveAnimation | null = null;
  /** 選中動畫：短暫高亮的格子集合（undo/redo 時顯示移動過的組） */
  highlightCells: Set<string> | null = null;
  /** 創造模式自定義目標形狀的「虛影」：把目標格（且當前未被佔用）畫成淡藍虛線框。 */
  solutionMask: Set<string> | null = null;
  /** 著色器：按 (r%step,c%step) 給滑塊描邊同色 */
  coloringEnabled = false;
  /** 連鎖器：懸停時提亮同組位置（含空格） */
  chainHintEnabled = false;
  /** 目前懸停格（棋盤座標；可為空格） */
  hoverCell: [number, number] | null = null;
  /**
   * 棋盤標記開關（原版 board_marks_enabled，gui/metrics_panel.py）：
   * 綠色目標框（聚攏度最高窗口）+ 洞（圓圈）/缺口（三角）/凸起（黃菱形）。
   * 與 F2 調試面板是兩個獨立開關——這裡只畫標記，不移植面板本體。
   */
  boardMarksEnabled = false;
  /**
   * 復原成功懸浮窗（原版 draw_solved_popup）。null = 未顯示；
   * t = 已顯示毫秒（彈入/呼吸/淡出都按它算）。公開欄位便于無頭測試直接置位。
   */
  solvedPopup: { t: number; result: SolvedPopupResult | null } | null = null;
  private solvedPopupRect: { x: number; y: number; w: number; h: number } | null = null;
  private solvedPopupRaf = 0;
  private solvedPopupT0 = 0;
  /**
   * 拖拽跟隨（缺陷 18）：選中組畫在「實時拖到的位置」，單位=小數格（dr=行, dc=列）。
   * 對照原版 renderer 的 follow_map：只作用於選中（be_opted）的塊，且**動畫播放
   * 期間讓位給動畫**（原版是 anim_map.get(id) or follow_map.get(id)）。
   */
  dragFollow: { dr: number; dc: number } | null = null;
  /**
   * 越界鬆手的撞牆回彈（原版 S1-3 _shake_blocks/_shake_offset，約 200ms）。
   * blocks 是鬆手那刻選中組的快照（拷貝）——單次觸控隨後會清空選中，抖動不能跟著消失。
   */
  followShake: { blocks: Set<Block>; dr: number; dc: number; t0: number } | null = null;
  private lastBounds: { min_row: number; max_row: number; min_col: number; max_col: number } | null = null;

  // ---- 箭頭按鍵（復刻原版 S1-4：選中縫隙 + 選中組後，切片兩端各一個可點箭頭）----
  /** 箭頭按鍵總開關（原版 arrows_enabled，預設開）。 */
  arrowEnabled = true;
  private arrowImage: HTMLImageElement | null = null;
  private arrowSpriteCache = new Map<string, HTMLCanvasElement>();
  /** 每幀重算的命中矩形，供點擊檢測複用同一套幾何（原版 _arrow_buttons）。 */
  arrowButtons: { dir: Direction; x: number; y: number; size: number; angle: number }[] = [];
  /** 上次點中滑塊的「世界座標」，作為箭頭錨點（原版 _gap_anchor_world）。 */
  lastBlockClickWorld: [number, number] | null = null;

  // ---- 點擊漣漪反饋（原版 spawn_click_feedback / draw_click_feedback）----
  private clickFeedback: { x: number; y: number; t0: number }[] = [];
  private static readonly CLICK_FEEDBACK_MS = 380;
  private static readonly CLICK_FEEDBACK_RADIUS = 34;
  private static readonly CLICK_FEEDBACK_MAX = 12;
  /** 漣漪存活期間持續重繪用的回調（main 注入 schedulePaint）。 */
  repaint: (() => void) | null = null;

  constructor(ctx: CanvasRenderingContext2D, zoom = 1) {
    this.ctx = ctx;
    this.zoom = zoom;
    this.cameraX = 0;
    this.cameraY = 0;
    this.loadArrowImage();
  }

  /** 懶加載原版 arrow_B.png（已內聯為 Data URI，無 file:// 污染問題）。 */
  private loadArrowImage(): void {
    // Node 測試環境沒有 Image 構造器；箭頭貼圖只在瀏覽器裡載入
    if (typeof Image === 'undefined' || this.arrowImage) return;
    const img = new Image();
    img.onload = () => { this.arrowImage = img; this.repaint?.(); };
    img.src = ARROW_IMAGE_DATA_URI;
  }

  /** 分組描邊色：由 (r%step, c%step) 唯一決定（對照原版 _group_color）。 */
  groupColor(r: number, c: number, step: number): string {
    const k = ((r % step) + step) % step * step + ((c % step) + step) % step;
    const n = step * step;
    let hue: number;
    if (n <= 16) hue = (k * 360) / n;
    else hue = ((k * 0.618033988749895) % 1) * 360;
    const [rr, gg, bb] = hsvToRgb(hue, 0.75, 0.92);
    return `rgb(${rr}, ${gg}, ${bb})`;
  }

  /** 連鎖提示格（含空格）：邊界盒內與懸停格同 (r%step,c%step) 的位置。 */
  chainHintCells(step: number): { cells: Set<string>; hover: [number, number] } | null {
    if (!this.chainHintEnabled || !this.hoverCell || step <= 1) return null;
    const [hr, hc] = this.hoverCell;
    const b = this.lastBounds;
    if (!b) return null;
    if (hr < b.min_row - 1 || hr > b.max_row + 1 || hc < b.min_col - 1 || hc > b.max_col + 1) return null;
    const cells = new Set<string>();
    for (let r = b.min_row; r <= b.max_row; r++) {
      for (let c = b.min_col; c <= b.max_col; c++) {
        if (((r % step) + step) % step === ((hr % step) + step) % step &&
            ((c % step) + step) % step === ((hc % step) + step) % step) {
          cells.add(`${r}:${c}`);
        }
      }
    }
    return { cells, hover: [hr, hc] };
  }

  get cell(): number {
    return CELL;
  }
  get gap(): number {
    return GAP;
  }
  get step(): number {
    return CELL + GAP;
  }
  /** 畫布上一個格的實際大小（含 zoom） */
  get scaledCell(): number {
    return CELL * this.zoom;
  }
  get scaledGap(): number {
    return GAP * this.zoom;
  }
  /** 供 main 置中用的週期（含縮放） */
  get stepPx(): number {
    return this.step * this.zoom;
  }

  /** 世界 → 螢幕。對照 GUI.world_to_screen（world*zoom + camera）。 */
  worldToScreen(worldX: number, worldY: number): [number, number] {
    return [worldX * this.zoom + this.cameraX, worldY * this.zoom + this.cameraY];
  }

  /** 螢幕 → 世界。對照 GUI.screen_to_world。 */
  screenToWorld(screenX: number, screenY: number): [number, number] {
    return [(screenX - this.cameraX) / this.zoom, (screenY - this.cameraY) / this.zoom];
  }

  /** 滑塊世界左上角。 */
  private blockOrigin(r: number, c: number): [number, number] {
    return [c * this.step, r * this.step];
  }

  /** 根據畫布座標取得滑塊。對照 GUI.get_block_at_pos。 */
  getBlockAtPos(screenX: number, screenY: number, store: GameStore): Block | null {
    const [wx, wy] = this.screenToWorld(screenX, screenY);
    for (const block of store.game.blocks) {
      const [bx, by] = this.blockOrigin(block.row, block.col);
      if (wx >= bx && wx < bx + CELL && wy >= by && wy < by + CELL) {
        return block;
      }
    }
    return null;
  }

  /** 根據畫布座標取得格座標 (r,c)，落在縫隙上回 null。對照 GUI.get_cell_at_pos。 */
  getCellAtPos(screenX: number, screenY: number): [number, number] | null {
    const [wx, wy] = this.screenToWorld(screenX, screenY);
    const step = this.step;
    const c = Math.floor(wx / step);
    const r = Math.floor(wy / step);
    if (wx - c * step >= CELL || wy - r * step >= CELL) {
      return null;
    }
    return [r, c];
  }

  /** 根據畫布座標取得縫隙。對照 GUI.get_gap_at_pos。 */
  getGapAtPos(screenX: number, screenY: number, store: GameStore): {
    type: GapType;
    line: number;
  } | null {
    const [wx, wy] = this.screenToWorld(screenX, screenY);
    const bounds = store.game.get_boundaries();
    const { min_row, max_row, min_col, max_col } = bounds;
    const gap = GAP;
    const tolerance = gap + 10;

    for (let i = min_row; i <= max_row + 1; i++) {
      const gapY = i * this.step - gap / 2;
      if (Math.abs(wy - gapY) < tolerance) {
        const boardLeft = min_col * this.step;
        const boardRight = (max_col + 1) * this.step;
        if (boardLeft - 50 < wx && wx < boardRight + 50) {
          const line = i - 1;
          if (store.game.is_valid_h_line(line)) return { type: 'h', line };
        }
      }
    }

    for (let j = min_col; j <= max_col + 1; j++) {
      const gapX = j * this.step - gap / 2;
      if (Math.abs(wx - gapX) < tolerance) {
        const boardTop = min_row * this.step;
        const boardBottom = (max_row + 1) * this.step;
        if (boardTop - 50 < wy && wy < boardBottom + 50) {
          const line = j - 1;
          if (store.game.is_valid_v_line(line)) return { type: 'v', line };
        }
      }
    }
    return null;
  }

  /** 空白區域 = 不在滑塊也不在縫隙。對照 GUI.is_blank_area。 */
  isBlankArea(screenX: number, screenY: number, store: GameStore): boolean {
    return (
      this.getBlockAtPos(screenX, screenY, store) === null &&
      this.getGapAtPos(screenX, screenY, store) === null
    );
  }

  draw(store: GameStore): void {
    const { ctx } = this;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, W, H);

    const bounds = store.game.get_boundaries();
    this.lastBounds = bounds;
    const selectedGap = store.cmd.selectedGap;

    // 1) 無限網格背景
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let r = bounds.min_row - 1; r <= bounds.max_row + 1; r++) {
      for (let c = bounds.min_col - 1; c <= bounds.max_col + 1; c++) {
        const [x, y] = this.worldToScreen(c * this.step, r * this.step);
        ctx.strokeRect(x, y, this.scaledCell, this.scaledCell);
      }
    }

    // 2) 縫隙線（先畫，讓滑塊蓋在上面；選中紅線、其餘灰線）
    this.drawGapLines(bounds, selectedGap);

    // 2.5) 創造模式目標虛影（畫在縫隙之上、滑塊之下；已被佔用的格子不畫）
    this.drawSolutionGhosts(store);

    // 3) 滑塊（動畫中則用插值位置；著色器描邊；連鎖器提亮）
    const hint = this.chainHintCells(store.currentStep);
    for (let idx = 0; idx < store.game.blocks.length; idx++) {
      const block = store.game.blocks[idx];
      let r = block.row;
      let c = block.col;
      if (this.animation) {
        const t = easeOut(this.animation.progress);
        const sr = this.animation.start[idx][0];
        const sc = this.animation.start[idx][1];
        const er = this.animation.end[idx][0];
        const ec = this.animation.end[idx][1];
        r = sr + (er - sr) * t;
        c = sc + (ec - sc) * t;
      } else if (this.dragFollow && store.game.selected.has(block)) {
        // 拖拽跟隨（缺陷 18）：一邊拖一邊動的實時預覽。動畫期間讓位（見欄位註釋）；
        // 偏移已在 events 側夾緊到 [0, maxCells]，這裡直接當單一數據源使用。
        r += this.dragFollow.dr;
        c += this.dragFollow.dc;
      }
      // 越界鬆手的撞牆回彈：與跟隨/動畫疊加（原版也是疊在 map 位置之上再偏移屏幕座標）
      const shake = this.followShake;
      if (shake && shake.blocks.has(block)) {
        const amp = shakeAmpCells(performance.now() - shake.t0, this.zoom, this.stepPx);
        // ⚠️ 原版這裡把「行符號」加到了屏幕 x 上（_shake_offset 返回 (dr,dc) 卻按
        // (x,y) 消費），橫向拖拽會豎直抖——明顯是筆誤。按意圖實現：沿越界方向本身抖。
        r += shake.dr * amp;
        c += shake.dc * amp;
      }
      const [x, y] = this.worldToScreen(c * this.step, r * this.step);
      const key = `${Math.round(r)}:${Math.round(c)}`;
      const selected = store.game.selected.has(block);
      const hl = this.highlightCells !== null && this.highlightCells.has(key);

      let fill = selected || hl ? COLORS.block_selected : COLORS.block;
      if (hint && hint.cells.has(key)) {
        const amt = hint.hover[0] === Math.round(r) && hint.hover[1] === Math.round(c) ? 0.55 : 0.35;
        fill = lightenCss(fill, amt);
      }
      const radius = GEOMETRY.block_radius * this.zoom;
      if (this.coloringEnabled && store.currentStep > 1) {
        // 著色器：從滑塊邊緣向內畫一圈分組色（原版 pygame 邊框是向內畫的）
        const ring = Math.max(2, 6 * this.zoom);
        ctx.fillStyle = this.groupColor(Math.round(r), Math.round(c), store.currentStep);
        this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
        ctx.fill();
        const inner = Math.max(0, this.scaledCell - ring * 2);
        const innerRadius = Math.max(0, radius - ring);
        ctx.fillStyle = fill;
        this.roundRect(x + ring, y + ring, inner, inner, innerRadius);
        ctx.fill();
      } else {
        ctx.fillStyle = fill;
        this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
        ctx.fill();
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = Math.max(1, GEOMETRY.block_border_width * this.zoom);
        this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
        ctx.stroke();
      }

      // 數字形態：編號畫在滑塊正中（對照原版 renderer 的數字繪製）
      // 太小就不畫，免得數字糊成一團
      if (block.number !== null && this.scaledCell >= 16) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.font = `600 ${Math.max(9, Math.round(this.scaledCell * 0.4))}px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(block.number), x + this.scaledCell / 2, y + this.scaledCell / 2);
      }

      if (this.highlightCells && this.highlightCells.has(key)) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 2;
        this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
        ctx.stroke();
      }
    }

    // 4) 連鎖器：同組的空格也提亮（對照原版 _chain_hint_cells）
    if (hint) {
      const occupied = new Set(store.game.blocks.map((b) => `${b.row}:${b.col}`));
      for (const key of hint.cells) {
        if (occupied.has(key)) continue;
        const [r, c] = key.split(':').map(Number);
        const amt = r === hint.hover[0] && c === hint.hover[1] ? 0.55 : 0.35;
        const [x, y] = this.worldToScreen(c * this.step, r * this.step);
        ctx.fillStyle = lightenCss(COLORS.background, amt);
        this.roundRect(x, y, this.scaledCell, this.scaledCell, GEOMETRY.block_radius * this.zoom);
        ctx.fill();
      }
    }

    // 4.5) 棋盤標記（原版 board_marks_enabled；畫在滑塊之上、箭頭之下）
    this.drawBoardMarks(store);

    // 5) 箭頭按鍵（選中縫隙 + 選中組後，切片兩端各一個可點箭頭；動畫中不畫）
    this.drawGapDirectionArrows(store);

    // 6) 點擊漣漪反饋（最上層，蓋住所有內容）
    this.drawClickFeedback();

    // 7) 復原成功懸浮窗（最上層，蓋住一切）
    this.drawSolvedPopup();
  }

  // ---------- 棋盤標記（原版 board_marks_enabled）----------
  /**
   * 目標框 + 洞/缺口/凸起記號。對照原版 metrics_panel._draw_target_window 與
   * _draw_debug_holes，兩者共用同一個 _compute_target_region——這裡同樣只用一份
   * findTargetWindow 的結果餵給 detectHoles，保證框與記號嚴格對齊。
   *
   * 記號規則（原版）：
   *   目標窗口內、被方塊包圍的空位（洞）  = 圓圈
   *   目標窗口內、連通窗口外緣的空位（缺口）= 三角形
   *   目標窗口外的方塊（凸起）             = 黃色斜方形
   *   大（邊界盒長或寬 ≥ step）= 紅，小 = 藍；凸起恆黃。
   */
  private drawBoardMarks(store: GameStore): void {
    if (!this.boardMarksEnabled) return;
    const blocks = store.game.blocks;
    if (blocks.length === 0) return;
    const { ctx } = this;
    const state = stateFromBlocks(blocks.map((b) => [b.row, b.col] as [number, number]));
    const win = findTargetWindow(state, store.currentM, store.currentN);
    if (!win || win.overlap <= 0) return;
    const rep = detectHoles(state, win, store.currentStep);

    ctx.save();
    // 目標框（無填充、綠色邊框）
    const [fx, fy] = this.worldToScreen(win.c0 * this.step, win.r0 * this.step);
    const fw = win.cw * this.scaledCell + (win.cw - 1) * this.scaledGap;
    const fh = win.rh * this.scaledCell + (win.rh - 1) * this.scaledGap;
    ctx.strokeStyle = COLORS.mark_target;
    ctx.lineWidth = Math.max(2, 2 * this.zoom);
    ctx.strokeRect(fx, fy, fw, fh);

    const radius = Math.max(3, this.scaledCell * 0.35);
    ctx.lineWidth = Math.max(2, 2 * this.zoom);
    const centerOf = (r: number, c: number): [number, number] =>
      this.worldToScreen(c * this.step + CELL / 2, r * this.step + CELL / 2);

    const drawEmpties = (groups: [number, number][][], kind: 'hole' | 'dent'): void => {
      for (const cells of groups) {
        let minR = Infinity;
        let maxR = -Infinity;
        let minC = Infinity;
        let maxC = -Infinity;
        for (const [r, c] of cells) {
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
        }
        const large = maxR - minR + 1 >= store.currentStep || maxC - minC + 1 >= store.currentStep;
        ctx.strokeStyle = large ? COLORS.mark_hole_large : COLORS.mark_hole_small;
        for (const [r, c] of cells) {
          const [cx, cy] = centerOf(r, c);
          ctx.beginPath();
          if (kind === 'hole') {
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          } else {
            ctx.moveTo(cx, cy - radius);
            ctx.lineTo(cx - radius, cy + radius);
            ctx.lineTo(cx + radius, cy + radius);
            ctx.closePath();
          }
          ctx.stroke();
        }
      }
    };
    drawEmpties(rep.holes, 'hole');
    drawEmpties(rep.dents, 'dent');

    // 目標窗口外的方塊（凸起）→ 黃色斜方形
    ctx.strokeStyle = COLORS.mark_protrusion;
    for (const [r, c] of rep.protrusions) {
      const [cx, cy] = centerOf(r, c);
      const d = radius;
      ctx.beginPath();
      ctx.moveTo(cx, cy - d);
      ctx.lineTo(cx + d, cy);
      ctx.lineTo(cx, cy + d);
      ctx.lineTo(cx - d, cy);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- 復原成功懸浮窗（原版 draw_solved_popup）----------
  /** 是否正在顯示（供事件層優先攔截點擊/按鍵）。 */
  get solvedPopupActive(): boolean {
    return this.solvedPopup !== null;
  }

  /**
   * 彈出復原懸浮窗並啟動自帶的動畫迴圈（對照原版 _solved_popup_active/_t）。
   * 彈入 ≈200ms（0.70→1 立方回彈）→ 輕微呼吸 → 6 秒自動淡出 ≈250ms。
   */
  spawnSolvedPopup(result: SolvedPopupResult | null = null): void {
    this.solvedPopup = { t: 0, result };
    this.solvedPopupT0 = performance.now();
    if (typeof requestAnimationFrame === 'undefined') return; // Node 測試環境：只置位不動畫
    if (!this.solvedPopupRaf) this.solvedPopupRaf = requestAnimationFrame(this.popupFrame);
  }

  /**
   * 越界鬆手的撞牆回彈（缺陷 18，對照原版 S1-3）：把鬆手那刻的選中組沿越界方向
   * 抖約 200ms。blocks 會拷一份——單次觸控隨後清空選中，抖動不該跟著消失。
   * dr/dc 傳跟隨偏移（行,列），內部取符號。
   */
  spawnFollowShake(blocks: Set<Block>, dr: number, dc: number): void {
    const sdr = Math.sign(dr);
    const sdc = Math.sign(dc);
    if (blocks.size === 0 || (sdr === 0 && sdc === 0)) return;
    this.followShake = { blocks: new Set(blocks), dr: sdr, dc: sdc, t0: performance.now() };
    if (typeof requestAnimationFrame === 'undefined') return; // Node 測試環境：只置位不動畫
    const tick = (): void => {
      const shake = this.followShake;
      if (!shake) return;
      if (performance.now() - shake.t0 >= 200) {
        this.followShake = null;
        this.repaint?.();
        return;
      }
      this.repaint?.();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private popupFrame = (now: number): void => {
    const pop = this.solvedPopup;
    if (!pop) {
      this.solvedPopupRaf = 0;
      return;
    }
    pop.t = now - this.solvedPopupT0;
    if (pop.t > 6000 + 250) {
      // 超過 6 秒 + 淡出時長：自動關閉
      this.solvedPopup = null;
      this.solvedPopupRect = null;
      this.solvedPopupRaf = 0;
      this.repaint?.();
      return;
    }
    this.repaint?.();
    if (typeof requestAnimationFrame === 'undefined') {
      this.solvedPopupRaf = 0; // Node 測試環境：不排下一幀
      return;
    }
    this.solvedPopupRaf = requestAnimationFrame(this.popupFrame);
  };

  /** 點擊命中懸浮窗矩形（供控制器攔截，避免穿透到棋盤）。 */
  hitSolvedPopup(x: number, y: number): boolean {
    const r = this.solvedPopupRect;
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  /** 立即關閉（Esc / 點擊 / Enter 保存後）。 */
  closeSolvedPopup(): void {
    if (this.solvedPopupRaf && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.solvedPopupRaf);
    }
    this.solvedPopupRaf = 0;
    this.solvedPopup = null;
    this.solvedPopupRect = null;
    this.repaint?.();
  }

  /**
   * 繪製復原懸浮窗（對照原版 renderer.draw_solved_popup）：
   * 居中（扣掉右欄寬度）+ 彈入回彈 + 呼吸光暈 + 6 秒自動淡出；
   * 競速模式附 用时/步数/TPS 與最佳恭喜。
   */
  private drawSolvedPopup(): void {
    const pop = this.solvedPopup;
    if (!pop) return;
    const t = pop.t;
    const { ctx } = this;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const result = pop.result;
    const showResult = !!result && !result.dnf;
    const baseW = 460;
    const baseH = showResult ? 300 : 200;
    // 居於畫布正中。原版扣掉右欄 132px 是因為它的右欄畫在 screen 內；
    // 網頁版右欄是畫布外的 DOM 元素，再扣就整個偏左 66px 了。
    const cx = W / 2;
    const cy = H / 2;

    // 彈入：前 200ms 由 0.70 立方回彈到 1；之後 1±0.012 呼吸（原版以幁計，此處折算毫秒）
    const p = Math.min(1, t / 200);
    const ease = 1 - (1 - p) ** 3;
    const scale = p < 1 ? 0.70 + 0.30 * ease : 1 + 0.012 * Math.sin(t / 150);
    const alpha = 240 * Math.min(1, t / 100);
    // 6 秒自動淡出（最後 250ms）
    let fade = 1;
    if (t > 6000) {
      fade = Math.max(0, (250 - (t - 6000)) / 250);
      if (fade <= 0) return;
    }
    const a = alpha * fade;

    const w = Math.round(baseW * scale);
    const h = Math.round(baseH * scale);
    const x = Math.round(cx - w / 2);
    const y = Math.round(cy - h / 2);
    this.solvedPopupRect = { x, y, w, h };

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 外圈呼吸光暈（對話框邊框同色，alpha 0.25±0.10，跟隨懸浮窗整體透明）
    const glowA = Math.max(0, 0.25 + 0.10 * Math.sin(t / 117)) * a;
    if (glowA > 0.5) {
      ctx.save();
      ctx.globalAlpha = glowA / 255;
      ctx.strokeStyle = COLORS.popup_glow;
      ctx.lineWidth = 2;
      this.roundRect(x - 7, y - 7, w + 14, h + 14, 15);
      ctx.stroke();
      ctx.restore();
    }

    // 面板 + 文字（統一 alpha）
    ctx.globalAlpha = Math.max(0, a) / 240;
    ctx.fillStyle = COLORS.dialog_bg;
    this.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = COLORS.dialog_border;
    ctx.lineWidth = 3;
    this.roundRect(x, y, w, h, 10);
    ctx.stroke();

    // 標題 + 分隔線
    ctx.fillStyle = COLORS.dialog_title;
    ctx.font = `700 24px ${FONT_FAMILY}`;
    ctx.fillText('复原成功！', cx, y + h * (showResult ? 0.22 : 0.28));
    ctx.strokeStyle = COLORS.dialog_border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + h * (showResult ? 0.30 : 0.40));
    ctx.lineTo(x + w - 20, y + h * (showResult ? 0.30 : 0.40));
    ctx.stroke();

    // 正文
    ctx.fillStyle = COLORS.popup_body;
    ctx.font = `16px ${FONT_FAMILY}`;
    ctx.fillText('所有滑块已归位', cx, y + h * (showResult ? 0.48 : 0.62));

    // 競速模式：成績 + TPS + 最佳恭喜
    if (showResult && result) {
      ctx.fillStyle = COLORS.popup_score;
      ctx.fillText(
        `用时 ${formatTime(result.time_ms)} | ${result.moves} 步 | TPS ${result.tps.toFixed(2)}`,
        cx,
        y + h * 0.62,
      );
      const parts: string[] = [];
      if (result.pb?.single) parts.push('单次');
      if (result.pb?.ao5) parts.push('Ao5');
      if (result.pb?.ao12) parts.push('Ao12');
      if (parts.length > 0) {
        ctx.fillStyle = COLORS.popup_pb;
        ctx.fillText(`恭喜最佳 ${parts.join('/')}！`, cx, y + h * 0.75);
      }
    }

    // 操作提示
    ctx.fillStyle = COLORS.dialog_border;
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.fillText('按 Enter 保存 ｜ 按 Esc 关闭', cx, y + h * 0.92);
    ctx.restore();
  }

  private drawSolutionGhosts(store: GameStore): void {
    if (!this.solutionMask || this.solutionMask.size === 0) return;
    const occupied = new Set(store.game.blocks.map((b) => `${b.row}:${b.col}`));
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(120,180,255,0.6)';
    ctx.lineWidth = Math.max(1, 2 * this.zoom);
    ctx.setLineDash([6, 4]);
    for (const key of this.solutionMask) {
      if (occupied.has(key)) continue;
      const [r, c] = key.split(':').map(Number);
      const [x, y] = this.worldToScreen(c * this.step, r * this.step);
      this.roundRect(x, y, this.scaledCell, this.scaledCell, GEOMETRY.block_radius * this.zoom);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawGapLines(
    bounds: { min_row: number; max_row: number; min_col: number; max_col: number },
    selectedGap: { type: GapType; line: number } | null,
  ): void {
    const { ctx } = this;
    const gap = this.scaledGap;
    const pad = 20; // 對照原版：縫隙向外多畫 20px，但只在棋盤範圍附近，不跨全屏

    // 棋盤實際左右/上下邊界（螢幕座標）
    const left = this.worldToScreen(bounds.min_col * this.step, 0)[0];
    const right = this.worldToScreen(bounds.max_col * this.step + CELL, 0)[0];
    const top = this.worldToScreen(0, bounds.min_row * this.step)[1];
    const bottom = this.worldToScreen(0, bounds.max_row * this.step + CELL)[1];

    // h（橫縫）：只在棋盤左右範圍（外擴 pad）
    for (let i = bounds.min_row; i <= bounds.max_row + 1; i++) {
      const sy = this.worldToScreen(0, i * this.step - GAP / 2)[1];
      const isSelected = !!selectedGap && selectedGap.type === 'h' && selectedGap.line === i - 1;
      ctx.strokeStyle = isSelected ? COLORS.line : COLORS.gap;
      ctx.lineWidth = isSelected ? GEOMETRY.selected_line_width : Math.max(1, gap);
      ctx.beginPath();
      ctx.moveTo(left - pad, sy);
      ctx.lineTo(right + pad, sy);
      ctx.stroke();
    }

    // v（縱縫）：只在棋盤上下範圍（外擴 pad）
    for (let j = bounds.min_col; j <= bounds.max_col + 1; j++) {
      const sx = this.worldToScreen(j * this.step - GAP / 2, 0)[0];
      const isSelected = !!selectedGap && selectedGap.type === 'v' && selectedGap.line === j - 1;
      ctx.strokeStyle = isSelected ? COLORS.line : COLORS.gap;
      ctx.lineWidth = isSelected ? GEOMETRY.selected_line_width : Math.max(1, gap);
      ctx.beginPath();
      ctx.moveTo(sx, top - pad);
      ctx.lineTo(sx, bottom + pad);
      ctx.stroke();
    }
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const { ctx } = this;
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  // ---------------- S1-4 箭頭按鍵（復刻原版 gui/renderer.py） ----------------

  /** 按鍵邊長：只跟隨全域縮放，與方向無關（原版 _arrow_button_size）。 */
  private arrowButtonSize(): number {
    return Math.max(18, Math.round(46 * this.zoom));
  }

  /** 旋轉後的箭頭貼圖快取（先縮放到 size、再旋轉，旋轉結果不二次縮放）。 */
  private arrowSprite(angleRad: number): HTMLCanvasElement | null {
    const img = this.arrowImage;
    if (!img || !img.complete) return null;
    const size = this.arrowButtonSize();
    const key = `${size}_${Math.round((angleRad * 180) / Math.PI) % 360}`;
    const cache = this.arrowSpriteCache;
    if (cache.size > 96) cache.clear();
    const cached = cache.get(key);
    if (cached) return cached;
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    const c = cv.getContext('2d')!;
    c.translate(size / 2, size / 2);
    c.rotate(angleRad);
    c.drawImage(img, -size / 2, -size / 2, size, size);
    cache.set(key, cv);
    return cv;
  }

  /**
   * 計算切片兩端的箭頭按鍵幾何（每幀重算，不快取幾何）。
   * 命中矩形寫入 this.arrowButtons，供點擊檢測複用同一套幾何。
   * 方向一律用 VALID_DIRECTIONS_FOR_GAP + DIRECTION_DELTA 推導，保證與
   * animateMove 實際移動一致；禁用方向（try_move 會失敗）直接不畫。
   */
  private computeArrowButtons(store: GameStore): void {
    this.arrowButtons = [];
    if (!this.arrowEnabled) return;
    const gap = store.cmd.selectedGap;
    const sel = store.game.selected;
    if (!gap || sel.size === 0 || this.animation) return;

    const dirs = VALID_DIRECTIONS_FOR_GAP[gap.type];
    if (dirs.length !== 2) return;

    const size = this.arrowButtonSize();
    // dirs[0] 單步的螢幕位移單位向量 u（row 向下、col 向右）
    const d0 = DIRECTION_DELTA[dirs[0]];
    const ux = d0[1] * this.stepPx;
    const uy = d0[0] * this.stepPx;
    const ulen = Math.hypot(ux, uy) || 1;
    const uxN = ux / ulen;
    const uyN = uy / ulen;
    const px = -uyN; // 垂直於推行方向
    const py = uxN;

    // 選中滑塊的螢幕中心
    const centers: [number, number][] = [];
    for (const b of store.game.blocks) {
      if (!sel.has(b)) continue;
      const [sx, sy] = this.worldToScreen(b.col * this.step + CELL / 2, b.row * this.step + CELL / 2);
      centers.push([sx, sy]);
    }
    if (centers.length === 0) return;

    let hi: { x: number; y: number };
    let lo: { x: number; y: number };
    const anchor = this.lastBlockClickWorld;
    if (anchor) {
      // 鼠標點附近：兩個按鍵沿推行軸分居兩側（原版「不額外讓位」路徑）
      const [awx, awy] = this.worldToScreen(anchor[0], anchor[1]);
      const off = size * 0.8;
      hi = { x: awx + uxN * off, y: awy + uyN * off };
      lo = { x: awx - uxN * off, y: awy - uyN * off };
    } else {
      // 切片投影外沿中點 + 向外讓位（原版 use_pad 路徑）
      let tLo = Infinity, tHi = -Infinity;
      let sSum = 0;
      for (const [sx, sy] of centers) {
        const t = sx * uxN + sy * uyN;
        const s = sx * px + sy * py;
        if (t < tLo) tLo = t;
        if (t > tHi) tHi = t;
        sSum += s;
      }
      const sMid = sSum / centers.length;
      const hiPt = { x: uxN * tHi + px * sMid, y: uyN * tHi + py * sMid };
      const loPt = { x: uxN * tLo + px * sMid, y: uyN * tLo + py * sMid };
      const blockR = this.scaledCell / 2;
      const pad = Math.max(blockR + size / 2 + 4, blockR + size / 2 + blockR * 0.1);
      // 出屏收縮，保證按鍵可見
      let p = pad;
      const m = size / 2 + 4;
      const W = this.ctx.canvas.width;
      const H = this.ctx.canvas.height;
      const inside = (pt: { x: number; y: number }) =>
        m <= pt.x && pt.x <= W - m && m <= pt.y && pt.y <= H - m;
      for (let k = 0; k < 6; k++) {
        const aHi = { x: hiPt.x + uxN * p, y: hiPt.y + uyN * p };
        const aLo = { x: loPt.x - uxN * p, y: loPt.y - uyN * p };
        if (inside(aHi) && inside(aLo)) break;
        p *= 0.65;
      }
      hi = { x: hiPt.x + uxN * p, y: hiPt.y + uyN * p };
      lo = { x: loPt.x - uxN * p, y: loPt.y - uyN * p };
    }

    // dirs[0] 指向 +u（hi 端），dirs[1] 指向 -u（lo 端）
    this.pushArrowButton(dirs[0], hi, uxN, uyN, store, size);
    this.pushArrowButton(dirs[1], lo, -uxN, -uyN, store, size);
  }

  private pushArrowButton(
    dir: Direction,
    pt: { x: number; y: number },
    vx: number,
    vy: number,
    store: GameStore,
    size: number,
  ): void {
    const W = this.ctx.canvas.width;
    const H = this.ctx.canvas.height;
    const x = Math.min(Math.max(pt.x, size / 2), W - size / 2);
    const y = Math.min(Math.max(pt.y, size / 2), H - size / 2);
    // 與點擊同判定路徑：該方向真走得動才畫（原版「禁用態不畫」）
    if (store.game.try_move(dir, store.currentStep) === null) return;
    const angle = Math.atan2(vy, vx);
    this.arrowButtons.push({ dir, x, y, size, angle });
  }

  /** 繪製選中縫隙兩端的箭頭按鍵（在滑塊之後呼叫）。 */
  private drawGapDirectionArrows(store: GameStore): void {
    this.computeArrowButtons(store);
    if (this.arrowButtons.length === 0) return;
    const { ctx } = this;
    for (const b of this.arrowButtons) {
      const spr = this.arrowSprite(b.angle);
      if (!spr) continue;
      ctx.drawImage(spr, b.x - b.size / 2, b.y - b.size / 2);
    }
  }

  /** 點擊座標是否命中某個箭頭按鍵，回傳該端方向，否則 null（原版 _arrow_button_hit）。 */
  hitArrowButton(x: number, y: number): Direction | null {
    for (const b of this.arrowButtons) {
      if (Math.abs(x - b.x) <= b.size / 2 && Math.abs(y - b.y) <= b.size / 2) return b.dir;
    }
    return null;
  }

  // ---------------- 點擊漣漪反饋（復刻原版 spawn/draw_click_feedback） ----------------

  /** 記錄一次點擊的漣漪（在事件分發最前面呼叫，與命中何種控制無關）。 */
  spawnClickFeedback(x: number, y: number): void {
    this.clickFeedback.push({ x, y, t0: performance.now() });
    if (this.clickFeedback.length > BoardRenderer.CLICK_FEEDBACK_MAX) {
      this.clickFeedback.splice(0, this.clickFeedback.length - BoardRenderer.CLICK_FEEDBACK_MAX);
    }
    this.repaint?.();
  }

  /** 繪製左鍵點擊漣漪：外擴圓環 + 中心亮點，隨時間淡出。在整幀最上層呼叫。 */
  private drawClickFeedback(): void {
    const fx = this.clickFeedback;
    if (!fx.length) return;
    const now = performance.now();
    const ms = BoardRenderer.CLICK_FEEDBACK_MS;
    const rMax = BoardRenderer.CLICK_FEEDBACK_RADIUS;
    const { ctx } = this;
    const alive: { x: number; y: number; t0: number }[] = [];
    for (const item of fx) {
      const p = (now - item.t0) / ms;
      if (p >= 1) continue;
      alive.push(item);
      const alpha = Math.round(170 * (1 - p));
      if (alpha <= 0) continue;
      const radius = 6 + (rMax - 6) * (1 - (1 - p) ** 2); // 緩出：先快後慢
      ctx.save();
      ctx.globalAlpha = alpha / 255;
      ctx.strokeStyle = 'rgb(150,220,255)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(item.x, item.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      const dotR = Math.max(1, Math.round(4 * (1 - p)));
      ctx.fillStyle = 'rgb(225,245,255)';
      ctx.beginPath();
      ctx.arc(item.x, item.y, dotR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    this.clickFeedback = alive;
    if (alive.length > 0) this.repaint?.();
  }
}
