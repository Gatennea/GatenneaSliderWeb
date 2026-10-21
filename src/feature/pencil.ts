/**
 * 就地鉛筆（owner 編輯入口的小按鍵）。
 * 僅 owner 登錄後由各 UI 渲染；點擊不會觸發所在行的默認行為
 * （stopPropagation 擋掉，否則點鉛筆會順便打開關/菜單項）。
 */

/** 建一個 ✎ 小按鍵；onEdit 收到點擊時彈編輯框。 */
export function mkPencil(onEdit: () => void): HTMLSpanElement {
  const p = document.createElement('span');
  p.textContent = '✎';
  p.title = '编辑（仅所有者可见）';
  p.style.cursor = 'pointer';
  p.style.fontSize = '13px';
  p.style.lineHeight = '1';
  p.style.padding = '2px 5px';
  p.style.borderRadius = '3px';
  p.style.flex = '0 0 auto';
  p.style.userSelect = 'none';
  p.addEventListener('mouseenter', () => { p.style.background = 'rgba(70,150,200,0.35)'; });
  p.addEventListener('mouseleave', () => { p.style.background = ''; });
  p.addEventListener('click', (e) => { e.stopPropagation(); onEdit(); });
  return p;
}
