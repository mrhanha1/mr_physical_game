// core/ColorMixer.js - Pure RYB color mixing logic, no Three.js
// Hệ 12 màu RYB, bước 30°.
// Cấp 1 (Primary RYB): 0=Red, 4=Yellow, 8=Blue
// Cấp 2 (Secondary):   2=Orange, 6=Green, 10=Violet
// Cấp 3 (Tertiary):    1=Red-Orange, 3=Yellow-Orange, 5=Yellow-Green,
//                      7=Blue-Green, 9=Blue-Violet, 11=Red-Violet

const MIX_TABLE = [
  // Primary + Primary → Secondary
  [0, 4, 2],   // Red    + Yellow → Orange
  [4, 8, 6],   // Yellow + Blue   → Green
  [0, 8, 10],  // Red    + Blue   → Violet

  // Primary + Secondary → Tertiary (chỉ các cặp liền kề)
  [0, 2, 1],   // Red    + Orange → Red-Orange
  [2, 4, 3],   // Orange + Yellow → Yellow-Orange
  [4, 6, 5],   // Yellow + Green  → Yellow-Green
  [6, 8, 7],   // Green  + Blue   → Blue-Green
  [8, 10, 9],  // Blue   + Violet → Blue-Violet
  [0, 10, 11], // Red    + Violet → Red-Violet

  // Tertiary + Tertiary liền kề → Secondary nằm giữa
  [1, 3, 2],   // Red-Orange + Yellow-Orange → Orange
  [3, 5, 4],   // Yellow-Orange + Yellow-Green → Yellow  (primary)
  // ^ Yellow là P1, nằm đúng giữa index 3 và 5
  [5, 7, 6],   // Yellow-Green + Blue-Green → Green
  [7, 9, 8],   // Blue-Green + Blue-Violet → Blue       (primary)
  [9, 11, 10], // Blue-Violet + Red-Violet → Violet
  [11, 1, 0],  // Red-Violet + Red-Orange → Red         (primary, wrap)
];

export class ColorMixer {
  static mix(indexA, indexB) {
    for (const [a, b, result] of MIX_TABLE) {
      if ((indexA === a && indexB === b) || (indexA === b && indexB === a)) {
        return result;
      }
    }
    return -1;
  }
}
