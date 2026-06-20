// UIHelper.js - In-scene instruction panel (canvas texture), dùng chung cho VR/AR/PC
// Style đồng bộ với #instructions card trong index.html
import * as THREE from 'three';

export class UIHelper {
  constructor() {
    this._canvas = document.createElement('canvas');
    this._canvas.width = 1024;
    this._canvas.height = 512;
    this._ctx = this._canvas.getContext('2d');
    this._texture = new THREE.CanvasTexture(this._canvas);
    this._texture.colorSpace = THREE.SRGBColorSpace;
    this._mesh = null;
  }

  // content: { title: string, lines: string[] } — dùng **text** để highlight kiểu .key
  createPanel(content, position, scene, options = {}) {
    const width = options.width ?? 1.0;
    const height = options.height ?? 0.5;

    this._draw(content);

    const mat = new THREE.MeshBasicMaterial({
      map: this._texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: options.depthTest ?? true,
    });
    const geo = new THREE.PlaneGeometry(width, height);
    this._mesh = new THREE.Mesh(geo, mat);
    this._mesh.position.copy(position);
    if (options.rotationY !== undefined) this._mesh.rotation.y = options.rotationY;
    this._mesh.renderOrder = options.renderOrder ?? 0;

    scene.add(this._mesh);
    return this._mesh;
  }

  updateText(content) {
    this._draw(content);
    this._texture.needsUpdate = true;
  }

  setVisible(visible) {
    if (this._mesh) this._mesh.visible = visible;
  }

  dispose(scene) {
    if (!this._mesh) return;
    scene.remove(this._mesh);
    this._mesh.geometry.dispose();
    this._mesh.material.dispose();
    this._texture.dispose();
    this._mesh = null;
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Vẽ 1 dòng có thể chứa **highlight**, trả về tổng width đã vẽ
  _drawRichLine(ctx, line, x, y, fontSize, baseColor) {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    let cx = x;
    const padX = 8, padY = 3, gap = 4;

    parts.forEach((part) => {
      const isKey = part.startsWith('**') && part.endsWith('**');
      const text = isKey ? part.slice(2, -2) : part;
      ctx.font = isKey ? `600 ${fontSize}px Outfit, sans-serif` : `400 ${fontSize}px Outfit, sans-serif`;
      const metrics = ctx.measureText(text);
      const w = metrics.width;

      if (isKey) {
        ctx.fillStyle = 'rgba(99,102,241,0.22)';
        ctx.strokeStyle = 'rgba(99,102,241,0.5)';
        ctx.lineWidth = 1.5;
        this._roundRect(ctx, cx, y - fontSize * 0.78, w + padX * 2, fontSize * 1.15, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#c4b5fd';
        ctx.fillText(text, cx + padX, y);
        cx += w + padX * 2 + gap;
      } else {
        ctx.fillStyle = baseColor;
        ctx.fillText(text, cx, y);
        cx += w;
      }
    });
  }

  // word-wrap text thường (không chứa **) theo maxWidth
  _wrapPlain(ctx, text, fontSize, maxWidth) {
    ctx.font = `400 ${fontSize}px Outfit, sans-serif`;
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    words.forEach((word) => {
      const test = cur ? cur + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push(cur);
        cur = word;
      } else {
        cur = test;
      }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  _draw(content) {
    const ctx = this._ctx;
    const w = this._canvas.width, h = this._canvas.height;
    const title = content.title ?? 'How to Play';
    const rawLines = content.lines ?? [];

    ctx.clearRect(0, 0, w, h);

    // Card background giống #instructions
    const pad = 36;
    ctx.fillStyle = 'rgba(15,15,30,0.85)';
    this._roundRect(ctx, pad / 2, pad / 2, w - pad, h - pad, 28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(99,102,241,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Title
    const titleSize = 34;
    ctx.font = `700 ${titleSize}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a78bfa';
    ctx.fillText(title.toUpperCase(), w / 2, pad + titleSize);

    // Body — wrap từng dòng theo maxWidth, giữ nguyên ** highlight **
    const bodySize = 26;
    const lineHeight = 38;
    const maxWidth = w - pad * 2.2;
    ctx.textAlign = 'left';

    // Tách dòng dài thành nhiều dòng ngắn (đo thô bỏ qua marker **)
    const wrapped = [];
    rawLines.forEach((line) => {
      const plain = line.replace(/\*\*/g, '');
      ctx.font = `400 ${bodySize}px Outfit, sans-serif`;
      if (ctx.measureText(plain).width <= maxWidth) {
        wrapped.push(line);
      } else {
        // wrap đơn giản theo plain text rồi vẽ nguyên dòng gốc trên dòng đầu
        this._wrapPlain(ctx, plain, bodySize, maxWidth).forEach((l) => wrapped.push(l));
      }
    });

    const startY = pad + titleSize + 50;
    wrapped.forEach((line, i) => {
      this._drawRichLine(ctx, line, pad + 6, startY + i * lineHeight, bodySize, '#94a3b8');
    });
  }
}