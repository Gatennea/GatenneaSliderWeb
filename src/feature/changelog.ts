/**
 * 版本公告（更新預告）。
 *
 * 為什麼要有這份清單：玩家打開網頁不會知道「這次又改了什麼」，功能加了也等於沒加。
 * 做法是——每次發版把這一版的要點寫進 `CHANGELOG` 最前面並把 `APP_VERSION` 改成
 * 同一個值，玩家下一次打開時彈一次公告（看過就記進 localStorage，不再打擾）。
 *
 * 完整歷史仍寫在 `update_info.html`（官網的更新日誌頁），公告裡只放**要點**並給
 * 一個「查看完整更新日誌」的入口，不要把整份歷史搬進 app.js 裡佔體積。
 */

/**
 * 當前版本號。發版時：① 改這裡；② 在 `CHANGELOG` 最前面加一筆同版本號的條目。
 * 只有版本號與上次記錄的不同、且該版本有條目時才會彈公告。
 */
export const APP_VERSION = '2026-10-20';

export interface ChangelogEntry {
  version: string;
  /** 顯示用的日期（人讀，如 '10月20日'） */
  date: string;
  /** 這一版的要點，條列、說人話、每條一句 */
  items: string[];
}

/** 最新的排在最前面 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2026-10-20',
    date: '10月20日',
    items: [
      '复原成功会弹提示（竞速还附用时、步数与最佳成绩）',
      '棋盘标记：可开关的目标框与洞/凸起记号（右侧「标记」）',
      '菜单栏补齐「搜索」：Ctrl+K 叫出命令面板，找不到功能时先来这里',
      '谜题菜单改二级子菜单，档位说人话（如「6×6 等级2」）',
      '虚拟键盘对齐原版；底部常驻撤销/重做，手机上不用先调出键盘',
      '五种操作方式可分别开关（设置 → 控制模式）',
      '手机：竖屏不再把棋盘挤扁、底部栏不再被挡住、误触更少',
    ],
  },
];

/** 取某一版的公告；沒有就回 null（該版本不必彈） */
export function entryFor(version: string): ChangelogEntry | null {
  return CHANGELOG.find((e) => e.version === version) ?? null;
}

/**
 * 要不要彈公告：版本與上次看過的不同、且該版有條目才彈。
 *
 * 第一次來（lastSeen 為 null）也算「沒看過」——但只在**有條目**時才彈，
 * 免得每次改版本號卻忘了寫條目，玩家就被一個空框打擾。
 */
export function shouldShowChangelog(lastSeen: string | null, version = APP_VERSION): boolean {
  if (lastSeen === version) return false;
  return entryFor(version) !== null;
}
