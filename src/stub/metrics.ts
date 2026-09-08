/**
 * 調試面板 / 目標框 / 洞-凸起標記預留介面（體驗版不做）
 *
 * 原版：gui/metrics_panel.py 與 solver/ml/hole_detector.py
 * 語義：框內空格=圓圈(洞)/三角(缺口)，框外方塊=菱形(凸起)，
 *       目標框與標記必須共用 find_best_window 的 region。
 */
export function metricsNotImplemented(): never {
  throw new Error('體驗版不含調試面板功能');
}
