/**
 * 新手教程控制器（對照原版 gui/tutorial.py 的 TutorialMixin 數據驅動設計）
 *
 * 移植要點：
 * - 關卡數據由 scripts/gen-tutorial-data.mjs 從原版 beginner_archive + tutorial_texts.json 生成，
 *   內聯進 tutorialData.ts，file:// 下無需 fetch。
 * - 第 1 關為互動教學（選縫→選塊→推→撤銷→重做→挑戰還原）；其餘關「少量引導 + 自己還原過關」，
 *   解法可一鍵回放（依序把存檔快照重播，沒解法的占位關顯示「敬請期待」）。
 * - 過關評分沿用原版公式：存檔步數 / 玩家步數 * 100（封頂 100）。
 * - 關卡解鎖遞進、完成度持久化到 localStorage。
 *
 * 與 main.ts 解耦：只透過 TutorialHost 拿遊戲物件與幾個 UI 鉤子，不反向依賴 main。
 */

import type { GameStore } from '../store/GameStore.js';
import type { BoardRenderer } from '../render/BoardRenderer.js';
import type { BoardController } from '../interaction/BoardController.js';
import { TUTORIAL_LEVELS, TUTORIAL_ORDER, TUTORIAL_ARCHIVES, TUTORIAL_TEXTS } from '../tutorial/tutorialData.js';
import { COLORS, GEOMETRY } from '../render/theme.js';

// 生成的資料是「字面值鍵」型別，直接用 string 索引會報錯；統一以 any 視之最省事
const ARCHIVES: Record<string, any> = TUTORIAL_ARCHIVES as any;
const TEXTS: any = TUTORIAL_TEXTS;
const LEVELS: LevelMeta[] = TUTORIAL_LEVELS as unknown as LevelMeta[];

const BRAND = '#4696c8';
const PROGRESS_KEY = 'gatennea-web:tutorial-progress';

interface SublevelMeta {
  id: string;
  title: string;
  guidance: string | null;
  steps: Record<string, string> | null;
  archiveId: string;
  teaching: boolean;
}

interface LevelMeta {
  id: string;
  title: string;
  complete_notify: string;
  solve_tail: string;
  sublevels: SublevelMeta[];
}

type WaitKind = 'gap' | 'block' | 'move' | 'undo' | 'redo' | 'solved' | 'final';

interface TeachingStep {
  text: string;
  wait: WaitKind;
}

export interface TutorialHost {
  store: GameStore;
  renderer: BoardRenderer;
  controller: BoardController;
  app: HTMLElement;
  schedulePaint: () => void;
  showToast: (s: string) => void;
  centerCamera: () => void;
  /** 把攝像機對準一組自定義邊界（row/col 基數），用於解法回放時穩定取景。 */
  frameBounds: (minRow: number, minCol: number, maxRow: number, maxCol: number) => void;
  /** 進入練習模式（教程不計時）；main 負責在必要時切換並歸位計時器。 */
  ensurePractice: () => void;
}

function snapshotBlocks(snap: any): [number, number][] {
  const out: [number, number][] = [];
  const m = snap?.matrix;
  const b = snap?.bounds;
  if (!Array.isArray(m) || !b) return out;
  for (let r = 0; r < m.length; r++) {
    const row = m[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 1) out.push([b.min_row + r, b.min_col + c]);
    }
  }
  return out;
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * 把 from/to 兩個「以 [row,col] 列表描述的局面」做滑塊對齊，
 * 使 start[k] 與 end[k] 指向同一個物理滑塊（位置級插值才不會把整排一起平移）。
 * Gatennea 每次移動至多一個滑塊越過缺口，故先用「位置相同」配對靜止塊，
 * 剩餘的用最近距離貪心配對（即移動中的滑塊）。
 *
 * 關鍵：start/end 必須以「from 的索引順序」回填（start[i]=from[i]），
 * 這樣渲染器才能用 animation.start[idx]/end[idx] 對應到 game.blocks[idx]。
 */
function alignSnapshots(
  from: [number, number][],
  to: [number, number][],
): { start: [number, number][]; end: [number, number][] } {
  const start: [number, number][] = new Array(from.length);
  const end: [number, number][] = new Array(from.length);
  const usedTo = new Array(to.length).fill(false);
  const unmatched: number[] = [];
  for (let i = 0; i < from.length; i++) {
    const f = from[i];
    let m = -1;
    for (let j = 0; j < to.length; j++) {
      if (!usedTo[j] && to[j][0] === f[0] && to[j][1] === f[1]) {
        m = j;
        break;
      }
    }
    if (m >= 0) {
      usedTo[m] = true;
      start[i] = [f[0], f[1]];
      end[i] = [to[m][0], to[m][1]];
    } else {
      unmatched.push(i);
    }
  }
  for (const i of unmatched) {
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < to.length; j++) {
      if (usedTo[j]) continue;
      const d = Math.abs(to[j][0] - from[i][0]) + Math.abs(to[j][1] - from[i][1]);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best >= 0) {
      usedTo[best] = true;
      start[i] = [from[i][0], from[i][1]];
      end[i] = [to[best][0], to[best][1]];
    }
  }
  return { start, end };
}

export class TutorialController {
  private host: TutorialHost;

  private active = false; // 章節系統是否運行中
  private teaching = false; // 是否為第 1 關互動教學
  private replaying = false; // 是否正在回放解法
  private completed = false; // 當前關是否已過關（避免重複觸發）
  private challengeStep = false; // 教學進入「挑戰」後才檢查 solved
  private currentSub: string | null = null;
  private returnSave: any = null;

  private teachingSteps: TeachingStep[] = [];
  private teachingIdx = -1;

  private levelSelect: HTMLElement | null = null;
  private bar: HTMLElement;
  private barText: HTMLElement;
  private barBtns: HTMLElement;

  constructor(host: TutorialHost) {
    this.host = host;
    this.bar = document.createElement('div');
    this.bar.style.position = 'fixed';
    this.bar.style.left = '50%';
    this.bar.style.bottom = `${GEOMETRY.status_bar_height + 12}px`;
    this.bar.style.transform = 'translateX(-50%)';
    this.bar.style.display = 'none';
    this.bar.style.alignItems = 'center';
    this.bar.style.gap = '10px';
    this.bar.style.maxWidth = 'min(560px, calc(100vw - 24px))';
    this.bar.style.background = COLORS.dialog_bg;
    this.bar.style.border = `1px solid ${COLORS.dialog_border}`;
    this.bar.style.borderRadius = '8px';
    this.bar.style.padding = '10px 14px';
    this.bar.style.color = COLORS.dialog_text;
    // 對照原版：正文/按鈕用 dialog_font(SimHei 18)
    this.bar.style.fontSize = '18px';
    this.bar.style.lineHeight = '1.5';
    this.bar.style.zIndex = '800';
    this.bar.style.boxShadow = '0 2px 10px rgba(0,0,0,0.45)';
    this.barText = document.createElement('span');
    this.barText.style.flex = '1';
    this.barText.style.whiteSpace = 'pre-line';
    // 對照原版教程面板封頂 300px：超出滾動，不無限增高遮棋盤
    this.barText.style.maxHeight = '30vh';
    this.barText.style.overflowY = 'auto';
    this.barBtns = document.createElement('span');
    this.barBtns.style.display = 'flex';
    this.barBtns.style.gap = '8px';
    this.barBtns.style.flex = '0 0 auto';
    this.bar.append(this.barText, this.barBtns);
    host.app.appendChild(this.bar);
  }

  // ---------- 進度持久化 ----------
  private loadProgress(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    } catch {
      return {};
    }
  }
  private saveProgress(p: Record<string, number>): void {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    } catch {
      /* 隱私模式寫不進：不影響遊戲 */
    }
  }
  isUnlocked(subId: string): boolean {
    const i = TUTORIAL_ORDER.indexOf(subId);
    if (i <= 0) return true;
    const prev = TUTORIAL_ORDER[i - 1];
    return this.loadProgress()[prev] !== undefined;
  }
  isCompleted(subId: string): boolean {
    return this.loadProgress()[subId] !== undefined;
  }
  /** 供 main 判斷是否要跳過自動存檔。 */
  chapterActive(): boolean {
    return this.active;
  }
  /** 當前是否正在回放解法（main 的 onChanged 應因此跳過自動存檔與過關偵測）。 */
  isReplaying(): boolean {
    return this.replaying;
  }

  // ---------- 選關面板 ----------
  openLevelSelect(): void {
    this.closeLevelSelect();
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.55)';
    overlay.style.zIndex = '2000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.addEventListener('click', () => this.closeLevelSelect());
    const box = document.createElement('div');
    box.style.background = COLORS.dialog_bg;
    box.style.border = `1px solid ${COLORS.dialog_border}`;
    box.style.borderRadius = '10px';
    box.style.padding = '18px';
    box.style.width = 'min(560px, 92vw)';
    box.style.maxHeight = '86vh';
    box.style.overflowY = 'auto';
    box.style.color = COLORS.dialog_text;
    // 對照原版：面板正文 dialog_font(18)
    box.style.fontSize = '18px';
    box.style.boxShadow = '0 6px 24px rgba(0,0,0,0.5)';
    box.addEventListener('click', (e) => e.stopPropagation());

    const title = document.createElement('div');
    title.textContent = TEXTS.level_select?.title ?? '选择关卡';
    title.style.fontWeight = 'bold';
    // 對照原版：面板標題 dialog_title_font(SimHei 22, bold)
    title.style.fontSize = '22px';
    title.style.marginBottom = '4px';
    box.appendChild(title);
    const sub = document.createElement('div');
    sub.textContent = '完成一关才会解锁下一关；点击已解锁的关卡开始。';
    sub.style.opacity = '0.7';
    sub.style.marginBottom = '12px';
    box.appendChild(sub);

    for (const lv of LEVELS) {
      const lvHead = document.createElement('div');
      lvHead.textContent = lv.title;
      lvHead.style.fontWeight = 'bold';
      lvHead.style.margin = '12px 0 6px';
      lvHead.style.color = BRAND;
      box.appendChild(lvHead);
      // 對照原版選關列表：全寬單列按鈕（dialog_font 18 的字在窄網格列裡會溢出）
      const grid = document.createElement('div');
      grid.style.display = 'flex';
      grid.style.flexDirection = 'column';
      grid.style.gap = '8px';
      for (const sub2 of lv.sublevels) {
        grid.appendChild(this.makeLevelButton(sub2));
      }
      box.appendChild(grid);
    }

    const exit = mkBtn('回到练习模式', false, () => this.closeLevelSelect());
    exit.style.marginTop = '16px';
    box.appendChild(exit);

    overlay.appendChild(box);
    this.host.app.appendChild(overlay);
    this.levelSelect = overlay;
  }
  private closeLevelSelect(): void {
    if (this.levelSelect) {
      this.levelSelect.remove();
      this.levelSelect = null;
    }
  }

  private makeLevelButton(sub: SublevelMeta): HTMLElement {
    const btn = document.createElement('button');
    btn.style.textAlign = 'left';
    btn.style.background = COLORS.input_bg;
    btn.style.color = COLORS.dialog_text;
    btn.style.border = `1px solid ${COLORS.border}`;
    btn.style.borderRadius = '6px';
    btn.style.padding = '10px 12px';
    btn.style.cursor = 'pointer';
    // 對照原版：小關按鈕文字 dialog_font(18)
    btn.style.fontSize = '18px';

    const hasArchive = !!ARCHIVES[sub.archiveId];
    const completed = this.isCompleted(sub.id);
    const unlocked = this.isUnlocked(sub.id);

    const mark = completed ? `  ✓${this.loadProgress()[sub.id] ?? ''}` : unlocked ? '' : '  🔒';
    btn.textContent = sub.title + mark;
    if (!hasArchive) {
      btn.title = '敬请期待（本关为占位，尚未制作）';
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    } else if (!unlocked) {
      btn.title = '完成上一关后解锁';
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    } else {
      btn.addEventListener('click', () => {
        this.closeLevelSelect();
        this.startSublevel(sub.id);
      });
    }
    return btn;
  }

  // ---------- 開始某關 ----------
  startSublevel(subId: string): void {
    const sub = this.findSublevel(subId);
    const archive = ARCHIVES[sub?.archiveId ?? ''];
    if (!sub || !archive) {
      this.host.showToast('这一关还在制作中，敬请期待~');
      return;
    }
    this.returnSave = this.host.store.serialize();
    this.host.ensurePractice();
    this.active = true;
    this.currentSub = subId;
    this.replaying = false;
    this.completed = false;
    this.challengeStep = !sub.teaching;
    this.teaching = false;

    const pz = archive.puzzle;
    const blocks = snapshotBlocks(archive.history.snapshots[0]);
    this.host.store.solutionMask = null;
    this.host.store.applyPuzzle(pz.m, pz.n, pz.step, blocks);
    this.host.renderer.solutionMask = null;
    this.host.centerCamera();

    if (sub.teaching) {
      this.startTeaching();
    } else {
      this.showBar(sub.guidance ?? '', [
        this.replayEnabled(archive) ? mkBtn('查看解法', true, () => this.viewSolution()) : null,
        mkBtn('退出', false, () => this.exit()),
      ]);
    }
    this.host.schedulePaint();
  }

  private startTeaching(): void {
    this.teaching = true;
    // 第 1 關：先用一塊「完整還原的 3×3」教基礎操作（撤銷/重做才有東西可動），
    // 進入「挑戰」時再載入官方亂局讓玩家自己還原。
    this.host.store.solutionMask = null;
    this.host.store.newPuzzle(3, 3, 1);
    this.host.renderer.solutionMask = null;
    this.host.centerCamera();
    const steps = TEXTS.levels?.['1']?.steps;
    this.teachingSteps = steps
      ? [
          { text: steps['1'], wait: 'gap' },
          { text: steps['2'], wait: 'block' },
          { text: steps['3'], wait: 'move' },
          { text: steps['4'], wait: 'undo' },
          { text: steps['5'], wait: 'redo' },
          { text: steps['6'], wait: 'solved' },
          { text: steps['7'], wait: 'final' },
        ]
      : [{ text: '把这块拼图还原成完整矩形即可过关！', wait: 'solved' }];
    this.teachingIdx = 0;
    this.showBar(this.teachingSteps[0].text, [mkBtn('跳过引导', false, () => this.exit())]);
  }

  private findSublevel(subId: string): SublevelMeta | null {
    for (const lv of LEVELS) {
      const s = lv.sublevels.find((x) => x.id === subId);
      if (s) return s;
    }
    return null;
  }

  private replayEnabled(archive: any): boolean {
    return Array.isArray(archive?.history?.snapshots) && archive.history.snapshots.length > 1;
  }

  // ---------- 每次重繪呼叫（main 的 schedulePaint 中觸發）----------
  tick(): void {
    if (!this.active || this.replaying || this.completed) return;
    if (this.teaching) {
      this.tickTeaching();
      return;
    }
    if (this.challengeStep && this.host.store.solved) this.complete();
  }

  /** 移動提交後（main 的 onChanged 中觸發）。 */
  onMoved(): void {
    if (!this.active || this.replaying || this.completed) return;
    if (this.teaching) {
      if (this.challengeStep) {
        if (this.host.store.solved) this.complete();
        return;
      }
      const w = this.teachingSteps[this.teachingIdx]?.wait;
      if (w === 'move') this.advanceTeaching();
      return;
    }
    if (this.challengeStep && this.host.store.solved) this.complete();
  }

  onUndo(): void {
    if (this.teaching && this.teachingSteps[this.teachingIdx]?.wait === 'undo') this.advanceTeaching();
  }
  onRedo(): void {
    if (this.teaching && this.teachingSteps[this.teachingIdx]?.wait === 'redo') this.advanceTeaching();
  }

  private tickTeaching(): void {
    if (this.teachingIdx < 0) return;
    const step = this.teachingSteps[this.teachingIdx];
    if (!step) return;
    if (step.wait === 'gap') {
      const g = this.host.store.cmd.selectedGap;
      if (g) this.advanceTeaching();
    } else if (step.wait === 'block') {
      if (this.host.store.game.selected.size > 0) this.advanceTeaching();
    }
    // move/undo/redo/solved 由 onMoved/onUndo/onRedo 收尾
  }

  private advanceTeaching(): void {
    this.teachingIdx += 1;
    const step = this.teachingSteps[this.teachingIdx];
    if (!step) {
      this.complete();
      return;
    }
    if (step.wait === 'solved' && !this.challengeStep) {
      // 進入挑戰：載入官方亂局，玩家自己還原
      const archive = ARCHIVES['1'];
      if (archive) {
        const pz = archive.puzzle;
        this.host.store.solutionMask = null;
        this.host.store.applyPuzzle(pz.m, pz.n, pz.step, snapshotBlocks(archive.history.snapshots[0]));
        this.host.renderer.solutionMask = null;
        this.host.centerCamera();
      }
      this.challengeStep = true;
      this.showBar(step.text, [mkBtn('查看解法', true, () => this.viewSolution()), mkBtn('退出', false, () => this.exit())]);
      this.host.schedulePaint();
      return;
    }
    this.barText.textContent = step.text;
    this.host.schedulePaint();
  }

  // ---------- 過關 ----------
  private computeScore(subId: string): number {
    const archive = ARCHIVES[this.findSublevel(subId)?.archiveId ?? ''];
    const solSteps = archive?.step_count ?? 0;
    const playerSteps = this.host.store.cmd.stepCount;
    if (solSteps <= 0) return 100; // 沒有參考解（如第1關）統一給滿分
    if (playerSteps <= 0) return 100;
    let s = Math.round((solSteps / playerSteps) * 100);
    if (s > 100) s = 100;
    if (s < 0) s = 0;
    return s;
  }

  private complete(): void {
    if (this.completed) return;
    this.completed = true;
    const subId = this.currentSub;
    if (subId) {
      const score = this.computeScore(subId);
      const p = this.loadProgress();
      p[subId] = Math.max(p[subId] ?? 0, score);
      this.saveProgress(p);
    }
    this.teaching = false;
    const sub = this.findSublevel(subId ?? '');
    const notify = sub ? sub.title + ' 完成！' : '过关！';
    this.host.showToast(notify);

    // 過關後：顯示成績與下一步
    const nextId = this.nextSublevel(subId);
    const btns: (HTMLElement | null)[] = [];
    if (nextId) {
      btns.push(mkBtn('下一关', true, () => this.startSublevel(nextId)));
    }
    btns.push(mkBtn('返回练习', false, () => this.exit()));
    const scoreLine = subId ? `\n得分 ${this.computeScore(subId)}` : '';
    this.showBar(notify + scoreLine + '\n（可继续下一关，或返回练习模式）', btns);
    this.host.schedulePaint();
  }

  private nextSublevel(subId: string | null): string | null {
    if (!subId) return null;
    const i = TUTORIAL_ORDER.indexOf(subId);
    if (i < 0 || i + 1 >= TUTORIAL_ORDER.length) return null;
    return TUTORIAL_ORDER[i + 1];
  }

  // ---------- 查看解法（回放存檔歷史）----------
  async viewSolution(): Promise<void> {
    const subId = this.currentSub;
    const archive = ARCHIVES[this.findSublevel(subId ?? '')?.archiveId ?? ''];
    if (!archive || !this.replayEnabled(archive)) {
      this.host.showToast('暂无解法可回放');
      return;
    }
    this.replaying = true;
    this.host.showToast('正在回放解法…');
    const pz = archive.puzzle;
    const snaps = archive.history.snapshots.map((s: any) => snapshotBlocks(s));
    // 回到起點
    this.host.store.solutionMask = null;
    this.host.store.applyPuzzle(pz.m, pz.n, pz.step, snaps[0]);
    this.host.renderer.solutionMask = null;
    this.host.schedulePaint();
    // 取法：取所有快照的聯集邊界，回放全程固定取景（缺口滑出矩陣時版面不會亂跳）。
    let mnR = Infinity,
      mxR = -Infinity,
      mnC = Infinity,
      mxC = -Infinity;
    for (const s of snaps) {
      for (const [r, c] of s) {
        if (r < mnR) mnR = r;
        if (r > mxR) mxR = r;
        if (c < mnC) mnC = c;
        if (c > mxC) mxC = c;
      }
    }
    this.host.frameBounds(mnR, mnC, mxR, mxC);
    await delay(350);

    // 依序把每個快照重播（位置級插值過渡，與歷史動畫一致，與步長無關）。
    // 原版「其餘關」的解法查看就是重播存檔歷史，而非重模擬移動指令，
    // 這樣能避開 move_info.step 與 puzzle.step 偶爾不一致的脫鉤問題。
    for (let i = 1; i < snaps.length; i++) {
      await this.animateStatic(snaps[i - 1], snaps[i]);
      this.host.store.applyPuzzle(pz.m, pz.n, pz.step, snaps[i]);
      this.host.store.cmd.stepCount = i;
      this.host.schedulePaint();
      await delay(140);
    }
    await delay(550);
    // 回到起點讓玩家自己試（重新對準起點局面）
    this.host.store.solutionMask = null;
    this.host.store.applyPuzzle(pz.m, pz.n, pz.step, snaps[0]);
    this.host.renderer.solutionMask = null;
    this.host.centerCamera();
    this.replaying = false;
    this.completed = false;
    this.host.schedulePaint();
    this.host.showToast('已回到起点，试着自己还原吧');
  }

  /**
   * 位置級插值過渡：依據 from/to 把對應的滑塊平滑移動到新位置（與步長無關）。
   * 用 alignSnapshots 做滑塊對齊，避免「整排一起平移」的錯覺。
   */
  private animateStatic(from: [number, number][], to: [number, number][]): Promise<void> {
    return new Promise((resolve) => {
      const r = this.host.renderer;
      const { start, end } = alignSnapshots(from, to);
      r.animation = { start, end, progress: 0, durationMs: this.host.controller.moveDurationMs };
      const t0 = performance.now();
      const frame = (now: number): void => {
        const a = r.animation;
        if (!a) return resolve();
        const p = Math.min(1, (now - t0) / a.durationMs);
        a.progress = p;
        this.host.schedulePaint();
        if (p < 1) requestAnimationFrame(frame);
        else {
          r.animation = null;
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }

  // ---------- 退出 ----------
  exit(): void {
    this.active = false;
    this.teaching = false;
    this.replaying = false;
    this.completed = false;
    this.challengeStep = false;
    this.currentSub = null;
    if (this.returnSave) {
      this.host.store.deserialize(this.returnSave);
      this.returnSave = null;
    }
    this.hideBar();
    this.host.ensurePractice();
    this.host.centerCamera();
    this.host.schedulePaint();
  }

  // ---------- 引導條 ----------
  private showBar(text: string, btns: (HTMLElement | null)[]): void {
    this.barText.textContent = text;
    this.barBtns.innerHTML = '';
    for (const b of btns) if (b) this.barBtns.appendChild(b);
    this.bar.style.display = 'flex';
  }
  private hideBar(): void {
    this.bar.style.display = 'none';
  }
}

function mkBtn(label: string, primary: boolean, onClick: () => void): HTMLElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.background = primary ? BRAND : COLORS.input_bg;
  b.style.color = '#fff';
  b.style.border = primary ? 'none' : `1px solid ${COLORS.border}`;
  b.style.borderRadius = '4px';
  b.style.padding = '8px 14px';
  b.style.cursor = 'pointer';
  // 對照原版：對話框按鈕（含「回到練習模式」）dialog_font(18)
  b.style.fontSize = '18px';
  b.style.whiteSpace = 'nowrap';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}
