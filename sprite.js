// Sprite Animation Player
class SpritePlayer {
  constructor(container) {
    this.container = container;
    this.frameCount = parseInt(container.dataset.frameCount);
    this.framePath = container.dataset.framePath;
    this.frameExt = container.dataset.frameExt;
    this.currentFrame = 0;
    this.frames = [];
    this.isPlaying = true;
    this.speed = 33; // ms per frame (30fps)
    this.intervalId = null;

    this.init();
  }

  init() {
    // Preload all frames
    for (let i = 0; i < this.frameCount; i++) {
      const img = document.createElement('img');
      const frameNum = i.toString().padStart(2, '0');
      img.src = `${this.framePath}${frameNum}${this.frameExt}`;
      img.alt = `Frame ${i}`;
      if (i === 0) img.classList.add('active');
      this.container.appendChild(img);
      this.frames.push(img);
    }

    // Start animation
    this.play();

    // Hover: speed up (disabled for testing)
    // this.container.addEventListener('mouseenter', () => this.setSpeed(16));
    // this.container.addEventListener('mouseleave', () => this.setSpeed(33));
  }

  play() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.nextFrame(), this.speed);
  }

  pause() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setSpeed(ms) {
    this.speed = ms;
    this.pause();
    this.play();
  }

  nextFrame() {
    const prevFrame = this.currentFrame;
    this.currentFrame = (this.currentFrame + 1) % this.frameCount;
    // Add new frame BEFORE removing old to prevent flicker
    this.frames[this.currentFrame].classList.add('active');
    this.frames[prevFrame].classList.remove('active');
  }

  goToFrame(index) {
    const prevFrame = this.currentFrame;
    this.currentFrame = index % this.frameCount;
    this.frames[this.currentFrame].classList.add('active');
    this.frames[prevFrame].classList.remove('active');
  }

  // Seek to frame with animation (rapid advance)
  seekToFrame(target, seekSpeed = 30) {
    this.pause();
    const advance = () => {
      if (this.currentFrame === target) {
        this.play();
        return;
      }
      this.nextFrame();
      setTimeout(advance, seekSpeed);
    };
    advance();
  }
}

// Initialize all sprite players on page load
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.sprite-player').forEach(el => {
    new SpritePlayer(el);
  });
});
