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

// ============================================
// Noise Scroll Background
// ============================================
class NoiseBackground {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');

    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -2;
      pointer-events: none;
    `;
    document.body.prepend(this.canvas);

    // Color palettes for corner clicks
    this.palettes = {
      normal: ['#6B5344', '#8B7355', '#9E8B7D', '#56a2c4'],
      saturn: ['#ff0000', '#cc0000', '#0000ff', '#0000cc'],   // Red + Blue
      jupiter: ['#ffff00', '#cccc00', '#00ff00', '#00cc00'],  // Yellow + Green
      sun: ['#ff6600', '#ff3300', '#00ffff', '#00cccc'],      // Orange + Cyan
      moon: ['#ff00ff', '#cc00cc', '#ffff00', '#cccc00']      // Magenta + Yellow
    };

    // Settings
    this.jitterAmount = 0.47;
    this.scrollSensitivity = 5.0;
    this.settleSpeed = 0.38;
    this.blueTop = 10;
    this.blueBottom = 32;
    this.residueAmount = 0.10;

    // State
    this.baseImageData = null;
    this.currentImageData = null;
    this.scrollVelocity = 0;
    this.lastScrollY = 0;
    this.isJittering = false;
    this.flashVelocity = 0;

    // Color animation state
    this.currentColors = this.palettes.normal.map(this.hexToRgb);
    this.targetColors = this.palettes.normal.map(this.hexToRgb);

    this.init();
  }

  hexToRgb(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  lerpColor(a, b, t) {
    return {
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t)
    };
  }

  blendPalettes(paletteA, paletteB, t) {
    return paletteA.map((colorA, i) => this.lerpColor(colorA, paletteB[i], t));
  }

  getBlueAmount() {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollProgress = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
    return this.blueTop + (this.blueBottom - this.blueTop) * scrollProgress;
  }

  generateBaseNoise() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    this.baseImageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
    const data = this.baseImageData.data;
    const blueThreshold = 1 - (this.getBlueAmount() / 100);

    for (let i = 0; i < data.length; i += 4) {
      const rand = Math.random();
      let color;
      if (rand < 0.35) {
        color = this.currentColors[0];
      } else if (rand < 0.65) {
        color = this.currentColors[1];
      } else if (rand < blueThreshold) {
        color = this.currentColors[2];
      } else {
        color = this.currentColors[3];
      }
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }

    this.currentImageData = new ImageData(
      new Uint8ClampedArray(this.baseImageData.data),
      this.canvas.width,
      this.canvas.height
    );
    this.ctx.putImageData(this.currentImageData, 0, 0);
  }

  applyJitter(intensity) {
    const data = this.currentImageData.data;
    const baseData = this.baseImageData.data;
    const blueThreshold = 1 - (this.getBlueAmount() / 100);

    for (let i = 0; i < data.length; i += 4) {
      if (Math.random() < intensity) {
        const rand = Math.random();
        let color;
        if (rand < 0.35) {
          color = this.currentColors[0];
        } else if (rand < 0.65) {
          color = this.currentColors[1];
        } else if (rand < blueThreshold) {
          color = this.currentColors[2];
        } else {
          color = this.currentColors[3];
        }
        data[i] = color.r;
        data[i + 1] = color.g;
        data[i + 2] = color.b;
      } else if (Math.random() < this.settleSpeed * 0.5) {
        data[i] = baseData[i];
        data[i + 1] = baseData[i + 1];
        data[i + 2] = baseData[i + 2];
      }
    }
    this.ctx.putImageData(this.currentImageData, 0, 0);
  }

  animate() {
    const currentScrollY = window.scrollY;
    const deltaScroll = Math.abs(currentScrollY - this.lastScrollY);
    this.lastScrollY = currentScrollY;

    const velocityDecay = 1 - this.settleSpeed;
    this.scrollVelocity = this.scrollVelocity * velocityDecay + deltaScroll * this.scrollSensitivity * 0.1;

    // Flash velocity decays faster
    this.flashVelocity = this.flashVelocity * 0.85;

    const totalVelocity = this.scrollVelocity + this.flashVelocity;
    const jitterIntensity = Math.min(totalVelocity * this.jitterAmount, 0.5);

    if (jitterIntensity > 0.001 || totalVelocity > 0.1) {
      this.applyJitter(jitterIntensity);
      this.isJittering = true;
    } else if (this.isJittering) {
      this.applyJitter(0);
      if (totalVelocity < 0.01) {
        this.isJittering = false;
      }
    }

    requestAnimationFrame(() => this.animate());
  }

  triggerFlash(cornerName) {
    const palette = this.palettes[cornerName] || this.palettes.normal;
    const paletteRgb = palette.map(h => this.hexToRgb(h));
    const normalRgb = this.palettes.normal.map(h => this.hexToRgb(h));

    // Set colors to flash palette immediately
    this.currentColors = paletteRgb.map(c => ({...c}));
    this.targetColors = paletteRgb.map(c => ({...c}));

    // Add vignette flash class
    document.body.classList.add('flash');

    // Trigger jitter burst
    this.flashVelocity = 8;

    // Animate back to residue blend after delay
    setTimeout(() => {
      // Set colors to residue blend
      const residueColors = this.blendPalettes(normalRgb, paletteRgb, this.residueAmount);
      this.currentColors = residueColors.map(c => ({...c}));
      this.targetColors = residueColors.map(c => ({...c}));

      // Regenerate base noise with residue colors
      this.generateBaseNoise();

      document.body.classList.remove('flash');
      // Jitter burst to show the transition
      this.flashVelocity = 4;
    }, 500);
  }

  init() {
    this.generateBaseNoise();
    this.animate();

    // Jitter on load
    this.flashVelocity = 6;

    window.addEventListener('resize', () => this.generateBaseNoise());

    let lastScrollForBlue = 0;
    window.addEventListener('scroll', () => {
      if (Math.abs(window.scrollY - lastScrollForBlue) > 50) {
        lastScrollForBlue = window.scrollY;
        this.generateBaseNoise();
      }
    });

    // Corner click listeners
    document.querySelectorAll('.corner-symbol').forEach(el => {
      // Map corner position to palette name
      const cornerMap = {
        'corner-top-left': 'saturn',
        'corner-top-right': 'jupiter',
        'corner-bottom-left': 'sun',
        'corner-bottom-right': 'moon'
      };
      const cornerClass = [...el.classList].find(c => c.startsWith('corner-') && c !== 'corner-symbol');
      const paletteName = cornerMap[cornerClass];
      if (paletteName) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => this.triggerFlash(paletteName));
      }
    });
  }
}

// Initialize noise background
document.addEventListener('DOMContentLoaded', () => {
  new NoiseBackground();
});

// ============================================
// Rainbow Noise Overlay
// ============================================
class RainbowNoise {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.animate();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const wrapper = this.canvas.parentElement;
    this.canvas.width = wrapper.offsetWidth;
    this.canvas.height = wrapper.offsetHeight;
  }

  generateNoise() {
    const imageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
    const data = imageData.data;

    // Rainbow colors (desaturated ~20% toward gray)
    const colors = [
      [217, 51, 51],   // red
      [217, 140, 51],  // orange
      [217, 217, 51],  // yellow
      [51, 217, 51],   // green
      [51, 51, 217],   // blue
      [147, 51, 217]   // violet
    ];

    for (let i = 0; i < data.length; i += 4) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = Math.random() * 120; // Semi-transparent
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  animate() {
    this.generateNoise();
    requestAnimationFrame(() => this.animate());
  }
}

// Initialize rainbow noise
document.addEventListener('DOMContentLoaded', () => {
  const rainbowNoiseCanvas = document.querySelector('.hero-rainbow-noise');
  if (rainbowNoiseCanvas) {
    new RainbowNoise(rainbowNoiseCanvas);
  }
});

// Random tape selection for all tape elements
document.addEventListener('DOMContentLoaded', () => {
  const tapes = document.querySelectorAll('.tape');
  const tapeImages = ['tape1.png', 'tape2.png', 'tape3.png', 'tape4.png'];

  tapes.forEach(tape => {
    const randomTape = tapeImages[Math.floor(Math.random() * tapeImages.length)];
    tape.src = `images/${randomTape}`;
  });

  // Random tilt for product images (0.1-0.3 degrees either way)
  const productImages = document.querySelectorAll('.product-image img:not(.tape)');
  productImages.forEach(img => {
    const tilt = (Math.random() * 0.2 + 0.1) * (Math.random() < 0.5 ? 1 : -1);
    img.style.transform = `rotate(${tilt}deg)`;
  });
});
