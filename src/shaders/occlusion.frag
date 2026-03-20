// occlusion.frag
// So sánh depth thật (từ Quest 3 camera) với depth ảo
// Nếu vật thật ở gần hơn → discard pixel → vật thật che vật ảo

precision mediump float;

uniform sampler2D uDepthTexture;  // depth map từ DepthSensor (normalized 0-1)
uniform mat4 uDepthUvTransform;   // normDepthBufferFromNormView
uniform float uRawValueToMeters;  // scale factor từ XRDepthInformation
uniform float uAlpha;             // opacity tổng thể của object

varying vec4 vClipPos;

void main() {
  // NDC → UV [0,1]
  vec2 ndc = vClipPos.xy / vClipPos.w;
  vec2 uv  = ndc * 0.5 + 0.5;

  // Áp transform từ depth sensor space
  vec2 depthUV = (uDepthUvTransform * vec4(uv, 0.0, 1.0)).xy;

  // Clamp để tránh sample ngoài border
  depthUV = clamp(depthUV, 0.0, 1.0);

  float depthReal = texture2D(uDepthTexture, depthUV).r * 8.0; // denormalize (max 8m)

  // Depth ảo của fragment (linear, tính từ clip-space w)
  float depthVirtual = vClipPos.w;  // w ≈ eye-space z trong perspective

  // Nếu vật thật gần hơn vật ảo → bị che → discard
  // Dùng threshold nhỏ để tránh z-fighting
  if (depthReal < depthVirtual - 0.05) {
    discard;
  }

  // Fragment visible — render màu object bình thường
  gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0); // transparent pass — Three.js material color đè lên
}
