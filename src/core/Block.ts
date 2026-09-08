/**
 * 滑塊 Block（對照 game.py::Block）
 *
 * 原版把 be_opted 存在每個 block 上；網頁版把選中狀態移出，
 * 由 SliderMatrix.selected 集合統一管理，避免物件上散布可變標誌。
 */
export class Block {
  location: [number, number];

  constructor(location: [number, number]) {
    this.location = location;
  }

  get row(): number {
    return this.location[0];
  }

  get col(): number {
    return this.location[1];
  }

  clone(): Block {
    return new Block([this.location[0], this.location[1]]);
  }
}
