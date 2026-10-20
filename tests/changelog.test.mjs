/**
 * 版本公告（更新預告）：什麼時候該彈。
 *
 * 這份清單是手寫的，最典型的失誤是「改了版本號卻忘了寫條目」——那會讓玩家
 * 看到一個空框，或者條目寫了版本號沒跟著改，於是一次也沒彈。故把判定抽成純函數。
 */
import { APP_VERSION, CHANGELOG, entryFor, shouldShowChangelog } from '../dist/feature/changelog.js';

export const cases = [
  {
    name: '版本號與條目對得上：當前版本有條目，且排在最前面',
    run() {
      if (CHANGELOG.length === 0) throw new Error('至少要有一版條目');
      const top = entryFor(APP_VERSION);
      if (!top) throw new Error(`APP_VERSION=${APP_VERSION} 在 CHANGELOG 裡找不到條目（發版時忘了加）`);
      if (CHANGELOG[0].version !== APP_VERSION) {
        throw new Error('最新的那一版要排在最前面');
      }
      if (!top.date || top.items.length === 0) throw new Error('條目要有日期與至少一條要點');
      // 版本號不重複：否則 entryFor 只會命中第一個
      const versions = CHANGELOG.map((e) => e.version);
      if (new Set(versions).size !== versions.length) throw new Error('版本號重複了');
    },
  },
  {
    name: '沒看過 → 彈；看過同一版 → 不彈',
    run() {
      if (!shouldShowChangelog(null)) throw new Error('第一次來應該彈');
      if (shouldShowChangelog(APP_VERSION)) throw new Error('看過這一版就不該再彈');
      if (!shouldShowChangelog('2000-01-01')) throw new Error('看到的是舊版本，應該彈');
    },
  },
  {
    name: '沒寫條目的版本號不彈（避免改了版本號卻忘了寫內容）',
    run() {
      if (shouldShowChangelog('2099-12-31', '2099-12-31')) {
        throw new Error('同一版號無論有沒有條目都不該彈');
      }
      if (shouldShowChangelog(null, '2099-12-31')) {
        throw new Error('該版本沒有條目時不該彈空框');
      }
    },
  },
  {
    name: '取得到指定版本；取不到回 null',
    run() {
      if (entryFor(APP_VERSION) === null) throw new Error('當前版本應該取得到');
      if (entryFor('不存在的版本') !== null) throw new Error('不存在應回 null');
    },
  },
];
