// hologram.frag
// Hologram effect cho GamePanel / UI
// Scan line + flicker + edge glow

precision mediump float;

uniform float uTime;
uniform sampler2D uMap;       // canvas texture từ GamePanel
uniform float uOpacity;

varying vec2 vUv;

void main() {
  vec4 texColor = texture2D(uMap, vUv);

  // Scan line — dải ngang chạy theo thời gian
  float scanLine = sin(vUv.y * 80.0 + uTime * 3.0) * 0.04;

  // Edge glow — sáng hơn ở viền
  float edgeX = min(vUv.x, 1.0 - vUv.x);
  float edgeY = min(vUv.y, 1.0 - vUv.y);
  float edge  = 1.0 - smoothstep(0.0, 0.05, min(edgeX, edgeY));
  vec3 glowColor = vec3(0.0, 0.8, 1.0) * edge * 0.6;

  // Flicker nhẹ
  float flicker = 0.92 + 0.08 * sin(uTime * 17.3);

  vec3 color = (texColor.rgb + scanLine + glowColor) * flicker;
  float alpha = texColor.a * uOpacity * flicker;

  gl_FragColor = vec4(color, alpha);
}
