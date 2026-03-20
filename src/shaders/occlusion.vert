// occlusion.vert
// Vertex shader cho occlusion material
// Truyền position clip-space xuống fragment để sample depth texture

varying vec4 vClipPos;

void main() {
  vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vClipPos = clipPos;
  gl_Position = clipPos;
}
