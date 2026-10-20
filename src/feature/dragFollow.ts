/**
 * 拖拽跟随（缺陷 18：一边拖一边动 + 越界判定）。
 * 对照原版 gui/drag.py 的 DragMixin + gui/events.py 的 MOUSEMOTION 分发。
 *
 * 这里只放纯逻辑（引擎探测 / 偏移投影 / 提交量化 / 拖拽接续比例 / 回弹包络），
 * DOM、光标与动画帧由 BoardController 驱动——否则「夹紧是否生效」「量化是否会
 * 少走一格」这类边界只有人肉拖才会发现，写不进测试。
 *
 * 机制（对照原版，方形模式）：
 * 1. 进入跟随：位移超阈值 → 定缝（单次触控 8 区 / 两次触控沿已选缝主轴）→
 *    缝须在棋形内部（边界缝拒绝）→ 选中连通组 → 探可达上限（只探一次，期间棋盘不变）。
 * 2. 每帧：屏幕位移 → 格位移 → 投影到锁定方向的前进轴 → 夹到 [0, maxCells]；
 *    越界（forward > max + 0.05）时光标变禁止图标。
 * 3. 松手：偏移量化到 step 整数倍，从大步长递减找第一个可接受的；
 *    拖拽接续——动画起点接到松手那刻的跟随位置，否则整组会跳回原位再滑一次。
 * 4. 越界松手：撞墙回弹（约 200ms，|sin|×线性衰减包络）。
 */
import { DIRECTION_DELTA, type Direction } from '../core/rules.js';
import type { SliderMatrix } from '../core/SliderMatrix.js';

/** 回弹时长（ms）。原版按帧记（12 帧 ≈ 200ms）。 */
export const SHAKE_MS = 200;

/**
 * 探测沿 direction 可连续推进的最大格数，向下取整到 step 的整数倍。
 * 对照原版 drag.py::_probe_max_cells——跟随期间棋盘状态不变，只需探测一次。
 *
 * ⚠️ 全员选中（只可能是绕过校验的边界缝）按 0 格处理：引擎对此放行是刻意保留的
 * 原版语义（护栏在命令层/UI 层），不拦的话探测会一路试到安全上限，而整盘刚体
 * 平移不改变形状（判胜只看形状）。对应原版 try_move_ex 的 all_selected。
 */
export function probeMaxCells(
  game: SliderMatrix,
  direction: Direction,
  step: number,
  limit = 64,
): number {
  if (game.selected.size > 0 && game.selected.size === game.blocks.length) return 0;
  const stepSize = Math.max(1, step);
  let reach = 0;
  while (reach < limit) {
    if (!game.try_move(direction, reach + 1)) break;
    reach += 1;
  }
  return Math.floor(reach / stepSize) * stepSize;
}

export interface FollowFrame {
  /** 行方向偏移（格，可为小数） */
  dr: number;
  /** 列方向偏移（格，可为小数） */
  dc: number;
  /** 触点越过可达上限（容差 0.05 格覆盖像素取整误差） */
  invalid: boolean;
}

/**
 * 每帧偏移：屏幕位移投影到锁定方向的前进轴，夹到 [0, maxCells]。
 * 对照 events.py 方形分支：raw 取主轴分量；'d'/'s' 是屏幕正方向、'a'/'w' 是负方向
 * （方向在进入时已锁定，必须乘方向符号，否则上/左拖拽会被夹紧吃掉）。
 * 反向拖回起点后停在原位，绝不产生反向位移。
 *
 * @param pitchPx 每格像素数 = 「格 + 间隙」的间距 × zoom（不是 scaledCell，
 *   少了间隙会把位移低估约一成：拖一格间距却读出 >1 格）
 */
export function followFrame(
  direction: Direction,
  pxDx: number,
  pxDy: number,
  pitchPx: number,
  maxCells: number,
): FollowFrame {
  const raw = direction === 'd' || direction === 'a' ? pxDx / pitchPx : pxDy / pitchPx;
  const forward = direction === 'd' || direction === 's' ? raw : -raw;
  const clamped = Math.max(0, Math.min(forward, maxCells));
  const [di, dj] = DIRECTION_DELTA[direction];
  return { dr: di * clamped, dc: dj * clamped, invalid: forward > maxCells + 0.05 };
}

/**
 * 提交量化：int(cells / step + 0.5) * step。
 * 取整用 floor(x+0.5) 而非 round——规避 round() 的银行家舍入（0.5 格时行为不同）。
 */
export function quantizeCells(cells: number, step: number): number {
  const stepSize = Math.max(1, step);
  return Math.floor(cells / stepSize + 0.5) * stepSize;
}

/**
 * 拖拽接续比例（对照原版 animation.py::_apply_drag_origin）：
 * 按跟随位移在总位移上的占比 s∈[0,1] 把动画起点前移，动画只滑剩下的那一段。
 * s 夹紧——跟随量超过落点时（如跟了 1.4 格却只走 1 格）起点停在落点，
 * 动画退化为一帧落位，也不会往回滑。
 */
export function continuationRatio(
  originDr: number,
  originDc: number,
  totalDr: number,
  totalDc: number,
): number {
  if (Math.abs(originDr) < 1e-9 && Math.abs(originDc) < 1e-9) return 0;
  const den = totalDr * totalDr + totalDc * totalDc;
  if (den < 1e-12) return 0;
  return Math.max(0, Math.min(1, (originDr * totalDr + originDc * totalDc) / den));
}

/**
 * 回弹振幅（格）：6px×zoom×|sin|×线性衰减包络，换算成格。
 * 对照原版 drag.py::_shake_offset（先正向冲一下再弹回）。
 */
export function shakeAmpCells(elapsedMs: number, zoom: number, pitchPx: number): number {
  const phase = 1 - elapsedMs / SHAKE_MS;
  if (phase <= 0) return 0;
  return (6 * zoom * phase * Math.abs(Math.sin(phase * Math.PI))) / pitchPx;
}
