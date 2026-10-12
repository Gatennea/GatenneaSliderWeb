/**
 * 滑塊 Block（對照 game.py::Block）
 *
 * 原版把 be_opted 存在每個 block 上；網頁版把選中狀態移出，
 * 由 SliderMatrix.selected 集合統一管理，避免物件上散布可變標誌。
 */
export class Block {
  location: [number, number];

  /**
   * 數字形態的編號（1..m*n），跟著滑塊走；非數字形態為 null。
   * 對照 game.py::Block.number —— 過關條件與方形完全相同（拼成實心矩形），
   * 編號只是給玩家看的視覺線索，不參與勝負判定。
   */
  number: number | null = null;

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
    const b = new Block([this.location[0], this.location[1]]);
    b.number = this.number;
    return b;
  }
}
