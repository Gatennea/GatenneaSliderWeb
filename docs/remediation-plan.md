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

## 执行顺序（用户已认可）
教程 bug 止血(0) → 相机专项(1+8) → 棋盘反馈(3+4) → 菜单栏(6) → 虚拟键盘(7，兼解 13) →
控制解耦(5) → 手机专项(10–16) → 繁简统一(2) → 更新预告(9)。
