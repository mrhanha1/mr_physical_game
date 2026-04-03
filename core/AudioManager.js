// AudioManager.js - Positional Audio System
import * as THREE from 'three';

export class AudioManager {
  constructor(camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    this.loader = new THREE.AudioLoader();
    this.sounds = {};
    this.loaded = false;

    this._load();
  }

  _load() {
    const files = {
      correct: './assets/correct.mp3',
      fail: './assets/fail.mp3',
      ambient: './assets/ambient.mp3',
    };

    let loadCount = 0;
    const total = Object.keys(files).length;

    for (const [key, path] of Object.entries(files)) {
      this.loader.load(
        path,
        (buffer) => {
          this.sounds[key] = buffer;
          loadCount++;
          if (loadCount === total) {
            this.loaded = true;
            this._startAmbient();
          }
        },
        undefined,
        (err) => {
          console.warn(`AudioManager: failed to load ${path}`, err);
          // Still mark as "loaded" so game isn't blocked
          loadCount++;
          if (loadCount === total) {
            this.loaded = true;
            this._startAmbient();
          }
        }
      );
    }
  }

  _startAmbient() {
    if (!this.sounds.ambient) return;

    // Attach ambient to a dummy object at scene center
    const ambientObj = new THREE.Object3D();
    ambientObj.position.set(0, 0, 0);

    const ambient = new THREE.PositionalAudio(this.listener);
    ambient.setBuffer(this.sounds.ambient);
    ambient.setRefDistance(5);
    ambient.setLoop(true);
    ambient.setVolume(0.12);
    ambientObj.add(ambient);
    ambient.play();

    this.ambientSource = ambientObj;
  }

  getAmbientObject() {
    return this.ambientSource || null;
  }

  // Play correct sound at a world position
  playCorrect(position) {
    this._playPositional('correct', position, 0.9);
  }

  // Play fail sound at a world position (usually controller position)
  playFail(position) {
    this._playPositional('fail', position, 0.8);
  }

  _playPositional(key, position, volume = 1.0) {
    if (!this.sounds[key]) return;

    const obj = new THREE.Object3D();
    obj.position.copy(position);

    const audio = new THREE.PositionalAudio(this.listener);
    audio.setBuffer(this.sounds[key]);
    audio.setRefDistance(2);
    audio.setVolume(volume);
    obj.add(audio);

    // Temporary scene attach — caller must add to scene
    audio.play();

    // Auto-clean after playback
    const duration = this.sounds[key].duration * 1000 + 200;
    setTimeout(() => {
      audio.stop();
      if (audio.parent) audio.parent.remove(audio);
    }, duration);

    return obj; // Caller adds to scene for spatial positioning
  }
}
