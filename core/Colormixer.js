// core/ColorMixer.js - Pure color mixing logic, no Three.js
// Hệ 12 màu, bước 30°. Mix theo lý thuyết màu sắc RYB/vòng tròn màu.

// Bảng mix cứng: [indexA, indexB] → indexResult
// Thứ tự không quan trọng (A+B = B+A)
const MIX_TABLE = [
  [0, 4, 2],   // Red   + Green   → Yellow
  [4, 8, 6],   // Green + Blue    → Cyan
  [0, 8, 10],  // Red   + Blue    → Magenta
  [0, 2, 1],   // Red   + Yellow  → Orange
  [2, 4, 3],   // Yellow+ Green   → Chartreuse
  [4, 6, 5],   // Green + Cyan    → Spring Green
  [6, 8, 7],   // Cyan  + Blue    → Azure
  [8, 10, 9],  // Blue  + Magenta → Violet
  [0, 10, 11], // Red   + Magenta → Rose
  [2, 6, 4],   // Yellow+ Cyan    → Green  (secondary rule)
  [2, 10, 0],  // Yellow+ Magenta → Red    (secondary rule)
  [6, 10, 8],  // Cyan  + Magenta → Blue   (secondary rule)
];

export class ColorMixer {
  /**
   * Mix hai màu theo colorIndex.
   * @param {number} indexA
   * @param {number} indexB
   * @returns {number} colorIndex kết quả, hoặc -1 nếu không hợp lệ
   */
  static mix(indexA, indexB) {
    for (const [a, b, result] of MIX_TABLE) {
      if ((indexA === a && indexB === b) || (indexA === b && indexB === a)) {
        return result;
      }
    }
    return -1;
  }
}