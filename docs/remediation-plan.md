# 网页版体验修复计划（remediation plan）

> 用户人肉测试发现的缺陷清单与解决路线。带 `*` 的项参考原版 Python `GatenneaSlider`
> （本地路径 `E:/program_project/other/wkbddtest/GatenneaSlider`）。
> 本计划仅作记录，执行顺序见末尾。

## 分支策略（用户已定：以 main 为目标）
- 当前在 `feat/records-detail`，所有 feature/docs 分支均未合入 `main`（main 落后全部功能分支 1~3 提交）。
- 执行：从 `main` 拉暂存分支 `wip/consolidate`，逐个并入功能分支
  （`feat/bundle-guard` / `feat/safe-shuffle` / `feat/solver-gather` / `docs/feature-inventory`
  / `docs/guide-sync` / `feat/tutorial-ch6` / `feat/records-detail`），解决冲突、构建验证后，
  fast-forward `main` 到 `wip/consolidate`。保证 `main` 在验收前不被直接污染，最终落在 `main`。

## 执行顺序与每项方案

### 0. 教程过关不解锁（止血，新 bug）
- 现象：过第 1 关后卡住，下一关还原了却不解锁后续。
- 根因：`src/feature/tutorial.ts` 的 `challengeStep` 只在第 1 关教学关 `advanceTeaching()` 置真；
  非教学关 `startSublevel()` 设为 `false` 后再没置真 → `complete()` 永不触发 → localStorage 不写 → 后续永久锁死。
- 修复：`startSublevel` 改为 `this.challengeStep = !sub.teaching;`。

### 1. 禁止整体滑动（已纠正：拦整盘刚体平移，非锁页面滚动）
- 因 `is_solved` 只比形状不比绝对坐标，整盘平移是零进度无意义操作。观感多来自相机平移（拖空白处→整盘在屏上滑）。
- 方案：与第 8 项共用相机交互，限制/收敛相机平移（仅在缩放后或明确空操作时平移，避免"看起来动了实际零进度"）。

### 2. 避免繁简字体混用
- 统一站点字体（HTML/CSS 指定一套，消除繁简混排）。

### 3. 棋盘标记（原称"调试标记"，已纠正：只要标记，不要调试面板）
- 原版：`board_marks_enabled` → `renderer.py:259/409/665` 调 `_draw_target_window`（目标框，`find_best_window`）
  + `_draw_debug_holes`（洞/缺口/凸起记号，`detect_holes`）。独立于 F2 调试面板，体验版不移植面板。
- 方案：加一个开关 + Canvas 画目标框与洞/凸起标记（矩形形态即可，异形可后续）。

### 4. 复原后提示
- 原版：`renderer.py:draw_solved_popup` + `GUI.py:_maybe_show_solved_popup`。居中弹窗、弹入回弹动画 + 呼吸光晕 + 6s 自动淡出；
  标题"复原成功！"+"所有滑块已归位"；竞速模式附用时/步数/TPS/最佳。触发：`became_solved && !via_redo && !suppress && !教程锁定`。
- 方案：移植悬浮窗（竞速成绩部分按网页版是否有竞速模式取舍）。

### 5. 控制方式解耦（已纠正：原版是五个开关）
- 原版"控制"页（`renderer.py:2309`）五种操作方式独立开关，可任意组合，**全关时只剩平移/缩放**：
  单次触控 `control_single_touch` / 两次触控 `control_two_touch` / 鼠标键盘 `control_mouse_kb` /
  虚拟键盘 `show_virtual_keyboard` / 箭头按键 `arrows_enabled`。
- 方案：对齐 `web/docs/touch-gesture.md` 三模式，并把键盘/鼠标/触摸事件分发抽成独立模块，五个开关各自独立可切换。

### 6. 菜单栏 UI 复刻
- 原版：`renderer.py:draw_menu_bar`。顶栏高 32、bg (50,50,50)、hover (70,70,70)、文字 (220,220,220)、SimHei 16。
  菜单项：文件/编辑/谜题/宏定义/设置/搜索/帮助/教程/官网，谜题带二级子菜单。
- 方案：复刻顶栏 + 下拉结构与配色（网页版可裁剪无关项，但样式与层级对齐）。

### 7. 虚拟键盘 UI 复刻（顺带解 13 撤销重做常驻）
- 原版：`gui/virtual_keyboard.py`。可拖动浮层、标题栏(26px)+关闭×；方向键按形态布局
  （方形 2 行 ↑ / ←↓→，三角 3 行六向，米字 3 行八向）；下方一行：粘滞开关 + 撤销/重做；再一行"跳到某步"输入框+按钮；bg (40,40,48,235)。
- 方案：复刻浮层；撤销/重做做成常驻易唤起，解决手机端"必须调出虚拟键盘才能用"。

### 8. 触点位于滑块防止拖动相机
- 原版：`events.py` 按下时命中滑块→记 `_mouse_drag_state` 拖块；`is_blank_area`→`is_dragging` 走相机平移（camera_x/y）。
- 方案：复用"滑块上=拖块、空白处=拖相机"判定；与第 1 项同一套相机交互一起改。

### 9. 添加更新预告
- 加更新预告/日志入口，关联 `update_info.html`。

### 10. 建议玩家横屏
- 检测竖屏弹横屏提示。

### 11. 竖屏比例有问题
- 修竖屏下画面比例（变形/留白/裁切）。

### 12. 太容易误触
- 减少触摸误触（增大命中容差/防抖/区分滑动与点击）。

### 13. 撤销重做常驻可见
- 不能非得调出虚拟键盘才能用，要常驻一眼可点（与第 7 项联动）。

### 14. 看不到底部栏
- 手机端底部栏被遮挡/滑出视口，改为常驻可见。

### 15. 顶部切换按键被遮挡
- 顶部按钮被刘海/状态栏/浏览器 UI 压住，加安全区/下移。

### 16. 存档机制优化
- 手机端存档读写/自动存档/跨会话恢复优化。

### 17. 更新预告（同 9，合并）

### 18. 缺少拖拽跟随动画（一边拖一边动）+ 越界判定 *（2026-10-20 新增，待定顺序）
- 现象：按住滑块拖动时画面零反馈，松手才播动画；且拖动过程中不提示"这一方向最多能推多远"。
- 网页版现状：`BoardController.onPointerMove` 只处理相机平移（`drag.pan`），
  手势与滑动全部压在 `onPointerUp`：`directGestureFromDrag()`（8 区映射）→ `selectGap` →
  `selectBlock` → `animateMove()`。即"拖的过程只是空拖，松手才结算"。
- 原版实现（`gui/drag.py` 的 `DragMixin` + `gui/events.py` 的 MOUSEMOTION 分发）：
  1. **进入跟随**：按住左键移动累计位移超阈值（14px）→ `_init_drag_follow(block, dx, dy)`。
     定缝：单次触控按 8 区角度（`GAP_SEQ`/`DIR_SEQ`），两次触控沿已选缝的主方向轴；
     缝必须过 `is_valid_h_line/v_line`（棋形内部，边界缝拒绝）→ 否则提示
     "缝隙在棋形外沿：整体移动所有滑块没有意义"；随后 `game.opt()` 选连通组。
  2. **探可达上限**（本项要的"越界判定"）：`_probe_max_cells(direction)` —— 从 1 开始递增调
     `try_move_ex(direction, n)`，遇到 `reason != ''`（**重叠或断开**）即止，结果向下取整到
     `current_step` 的整数倍。跟随期间棋盘状态不变，故只在进入跟随时探一次。
  3. **每帧更新偏移**：屏幕位移 → 格位移 → 投影到锁定方向的"前进"轴 → 夹到 `[0, max_cells]`
     （反向拖回停在原位）；`drag_follow_invalid = forward > max_cells + 0.05`（容差 0.05 格覆盖
     像素取整误差，恰好贴边不误报）。invalid 时鼠标光标变 `SYSTEM_CURSOR_NO`（禁止图标）。
  4. **松手提交** `_commit_drag_move()`：偏移取整（`int(x+0.5)`，规避 round 银行家舍入）并量化到
     step 整数倍，从最大步长递减找第一个可接受的（兜底）。**拖拽接续**：
     `_drag_anim_origin = (dr, dc)` 交给 `animation.py::_apply_drag_origin()` —— 动画起点接到
     松手那刻的跟随位置，否则整组会跳回原位再滑一次。
  5. **越界松手回弹**：未移动且 `drag_follow_invalid` → `_shake_blocks` + `_shake_offset()`
     （约 200ms，|sin|×线性衰减包络，振幅 6px×zoom，仅增强模式）。
  6. 单次触控发起的跟随结束自动取消选中；两次触控保留缝隙选中以便继续操作。
- 方案（待排期）：`onPointerMove` 增加 `dragFollow` 状态（缝/方向/起点/maxCells/offset/invalid），
  渲染层把选中组画在 `start + offset`。
- **引擎侧已经够用，不必先改引擎**（实测核对，别误判）：网页版 `SliderMatrix.try_move(direction, n)`
  本就是「逐格验证、任一步不合法返回 null」，n 可以大于 current_step，所以 `_probe_max_cells`
  用现有 `try_move` 递增试 n 即可；原版多了 `try_move_ex` 的 reason（collision/disconnected/
  all_selected…），探上限只看「能不能走」，null/非 null 已足够，失败原因只有要做文案提示时才需要补。
  ⚠️ 唯一要补的引擎侧细节：`try_move` 对「全员选中」不拒绝（这是之前刻意保留的原版行为，
  护栏在命令层/UI 层），探测时若整盘被选中会一路试到安全上限 → 探测前先判
  `selected.size === blocks.length` 直接按 0 格处理（对应原版的 `all_selected`）。
- 与第 1 项（禁止整体滑动）同源：跟随期间的缝校验/上限探测同样要拒绝边界缝，不得整盘刚体平移。

## 执行顺序（用户已认可）
教程 bug 止血(0) → 相机专项(1+8) → 棋盘反馈(3+4) → 菜单栏(6) → 虚拟键盘(7，兼解 13) →
控制解耦(5) → 手机专项(10–16) → 繁简统一(2) → 更新预告(9)；第 18 项（拖拽跟随）待用户定顺序，
因其与"控制解耦(5)"共用手势分发，倾向排在 5 之后或与其合并做。

## 执行结果（2026-10-21 收口）

除第 18 项外全部完成。每条一行：缺陷项 → 提交 → 一句话结果。

| 缺陷项 | 提交 | 结果 |
| --- | --- | --- |
| 0 教程不解锁 | `af8c66b` | `challengeStep = !sub.teaching`，非教学关也能过关 |
| 1 禁止整体滑动 | `12a9b49` | 三层拦截：手势缝隙过 `selectGap`（根因）+ 命令层 + UI 层闪红提示；引擎层按原版语义不动 |
| 2 繁简字体混用 | `00d8276` | 文案统一简体（脚本只转字符串字面量）+ 字体栈补 TC 繁体字体（SC 缺字不再掉到系统默认） |
| 3 棋盘标记 | `db3c6ba` | `boardMarksEnabled` 开关：绿目标框 + 洞（圆圈）/缺口（三角）/凸起（黄菱形），大=红小=蓝 |
| 4 复原后提示 | `db3c6ba` | 460×200 弹窗：弹入回弹 + 呼吸 + 6s 淡出；竞速附用时/步数/TPS 与 PB（单次/Ao5/Ao12） |
| 5 控制方式解耦 | `e47eab3` | 五个开关都真生效：`selectable = 两次触控 or 鼠标键盘`；全关时只剩平移/缩放并明说 |
| 6 菜单栏 UI | `28b733c` | 补「搜索」（命令面板 Ctrl+K）、谜题二级子菜单（分组/当前档位✓）、顶栏悬停与展开态高亮 |
| 7 虚拟键盘 UI | `247e2f7` | 尺寸对齐原版；粘滞连播改开关语义（旧版停不下来）；拖动改 pointer + clamp（触屏原先拖不动） |
| 8 触点防拖相机 | `12a9b49` | 按在滑块上禁止平移相机 |
| 9 更新预告 | `00d8276` | `changelog.ts`：新版本首次弹「本次更新」公告；演示模式与新手首次不弹 |
| 10 建议横屏 | `d5b6985` | 触屏+竖屏+窄时顶部提示，「知道了」记住 |
| 11 竖屏比例 | `d5b6985` | <640px 时右栏 132px 挪到底部横条，棋盘拿回全部宽度 |
| 12 太容易误触 | `d5b6985` | canvas 独占触摸（touch-action:none）；触屏拖动阈值 18→28px、位移 4→10px |
| 13 撤销重做常驻 | `247e2f7` | 底部常驻「↶ 撤销 / ↷ 重做」，不能操作时置灰，教程回放中锁住 |
| 14 看不到底部栏 | `d5b6985` | `100dvh` + safe-area 内边距（game.html 加 viewport-fit=cover） |
| 15 顶部被遮挡 | `d5b6985` | 同上；下拉定位改跟菜单栏实际底边（写死 32px 会偏） |
| 16 存档时机 | `d5b6985` | visibilitychange 与 pagehide 也存（手机切后台常无 beforeunload） |
| 17 更新日志页 | `00d8276` | update_info.html 补本轮全部条目 |
| 18 拖拽跟随 | `3568324` | **仅记录待排期**：原版机制已查明（14px 阈值/探上限/每帧夹紧/松手接续/撞墙回弹），方案见上 |

验证口径：每站 `npm test`（现 114 例）+ `npm run smoke`（DOM stub 真跑 app.js，
抓 TDZ/事件接线）；构建 `npm run build`。构建产物巨量 diff 的成因见 `docs/build.md`。

遗留（用户明确暂缓，不是遗漏）：
- 求解器宏接口移植（`solver/ml/gap_solver.py` + `fill_macro.py`）：入口已按用户要求改回
  「完整版」标记，代码内记录了关键判断（`src/solver/index.ts` 顶部注释）。
- `index.html` 落地页仍宣称求解器/教程/创造模式「仅完整版」——与现状不符，待用户定是否改。
- 账号/排行榜/后端：`src/io/ApiClient.ts` 故意未接线（见项目记忆「明确搁置」）。
