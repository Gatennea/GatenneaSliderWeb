# 滑塊直接拖拽手勢：8 區角度判定實作說明

> 這份文件說明網頁版的「直接拖拽滑塊即滑動」是怎麼實作的。
> 目的是讓另一位智能體閱讀後，能據此修改原版 Python 遊戲，加入相同的手勢。

---

## 1. 目標行為

在**沒有鍵盤**的環境（手機 / 平板 / 只用滑鼠）下，使用者可以：

1. 直接從某個滑塊開始拖拽；
2. 拖拽結束時，根據拖拽的**角度**，自動判定：
   - 要選哪一條「縫隙」；
   - 要選包含起點方塊的哪一側；
   - 要往哪個方向滑動；
3. 一次拖拽 = 一次滑動，不需要先點縫隙、再點方塊。

同時保留原本操作：
- 點縫隙 → 點方塊 → 鍵盤移動；
- 點縫隙 → 點方塊 → 拖拽移動；
- 空白處拖拽 = 平移地圖。

---

## 2. 角度座標定義

- **0° = 正右**
- **90° = 正上**
- 角度用 Math.atan2 計算，但因為螢幕座標 y 向下，所以換算時要取 `-dy`：

```
angleDeg = atan2(-dy, dx) * 180 / PI
若 angleDeg < 0，加 360 使範圍落在 0~360
```

其中 `dx`、`dy` 是「拖拽結束位置 - 拖拽起始位置」。

---

## 3. 8 區對應表（核心）

每 45° 一個區：

| 扇區 | 角度範圍 | 縫隙 | 移動方向 |
| --- | --- | --- | --- |
| 0 | 0° ~ 45° | d（下沿 h） | r（右） |
| 1 | 45° ~ 90° | l（左沿 v） | u（上） |
| 2 | 90° ~ 135° | r（右沿 v） | u（上） |
| 3 | 135° ~ 180° | d（下沿 h） | l（左） |
| 4 | 180° ~ 225° | u（上沿 h） | l（左） |
| 5 | 225° ~ 270° | r（右沿 v） | d（下） |
| 6 | 270° ~ 315° | l（左沿 v） | d（下） |
| 7 | 315° ~ 360° | u（上沿 h） | r（右） |

縮寫：

| 縮寫 | 意思 |
| --- | --- |
| d | 下沿縫隙，h 橫縫 |
| u | 上沿縫隙，h 橫縫 |
| l | 左沿縫隙，v 縱縫 |
| r | 右沿縫隙，v 縱縫 |
| r | 移動方向：右 |
| u | 移動方向：上 |
| l | 移動方向：左 |
| d | 移動方向：下 |

---

## 4. 縫隙座標換算（以起點方塊 row, col 為準）

假設起點方塊座標為 `(row, col)`：

| 縫隙 | 型別 | line |
| --- | --- | --- |
| d（下沿） | h | `row` |
| u（上沿） | h | `row - 1` |
| l（左沿） | v | `col - 1` |
| r（右沿） | v | `col` |

判斷「選中哪一側」時，一律選**包含起點方塊的那一側**：

- h 縫隙：
  - 上側：座標 row ≤ line
  - 下側：座標 row > line
- v 縫隙：
  - 左側：座標 col ≤ line
  - 右側：座標 col > line

---

## 5. 演算法流程（偽碼）

```
onPointerDown(x,y):
    if 起點在滑塊上:
        記錄 dragStart=(x,y)
        標記 dragOnBlock=true
        不啟動地圖平移
    else:
        記錄為空白拖拽（平移地圖）

onPointerMove(x,y):
    記錄 dx = x - startX, dy = y - startY

onPointerUp(x,y):
    if 位移小於閾值:
        當作 click 處理（維持原有行為）
        return

    startBlock = 起點位置的滑塊
    if startBlock 不存在:
        空白拖拽 → 平移地圖
        return

    if 已經有 selectedGap:
        # 使用者先點過縫隙：沿用已選縫隙
        direction = 依 dx/dy 主軸決定（右/左/上/下）
        ensure selectedBlock = opt(startBlock)
        move(direction)
    else:
        # 直接拖拽判定
        angle = atan2(-dy, dx)
        sector = floor(angle / 45) % 8
        gapAbbr = GAP_SEQ[sector]   # [d,l,r,d,u,r,l,u]
        moveAbbr = DIR_SEQ[sector]  # [r,u,u,l,l,d,d,r]

        selectedGap = 由 gapAbbr + startBlock 換算
        selectedBlock = opt(selectedGap, startBlock)
        direction = moveAbbr 轉換為 w/a/s/d
        move(direction)
```

---

## 6. 移動方向與遊戲規則的對應

遊戲原有規則：

- h 縫隙只能左右：`a` 左 / `d` 右
- v 縫隙只能上下：`w` 上 / `s` 下

所以上表每個扇區都已經是合法組合，不會出現「h 縫隙卻要求上下」或「v 縫隙卻要求左右」的衝突。

---

## 7. 觸控 / 滑鼠共通注意事項

- 滑鼠：使用 `mousedown / mousemove / mouseup`。
- 觸控：使用 `touchstart / touchmove / touchend`，並設 `touch-action: none` 避免瀏覽器捲動/手勢干擾。
- 若同時做兩指捏合縮放：
  - 兩指按下時進入「縮放模式」，不要觸發單指拖拽滑動；
  - 一指抬起後清除縮放模式，避免誤觸發。
- 位移閾值建議至少 15~20px，避免點擊被誤判成拖拽。

---

## 8. 移植到原版 Python 的建議位置

原版 Pygame 滑鼠/觸控事件主要位於 `gui/events.py`：

- `MOUSEBUTTONDOWN` / `MOUSEBUTTONUP`：
  加入「滑塊起點拖拽」的記錄。
- `MOUSEMOTION`：
  記錄拖拽累積位移。
- 在 mouseup 時判斷：
  - 起點是否在滑塊上；
  - 位移是否超過閾值；
  - 依上述角度表選縫隙、選組、移動。

可參考網頁版對應檔案：
`web/src/interaction/BoardController.ts`

---

## 9. 目前網頁版保留的相容行為

- 點縫隙 → 點方塊 → 鍵盤 W/A/S/D。
- 點縫隙 → 點方塊 → 拖拽滑動。
- 點縫隙後直接拖拽滑塊 → 直接滑動。
- 未選縫隙時直接拖拽滑塊 → 8 區角度判定滑動。
- 空白拖拽 → 平移地圖。