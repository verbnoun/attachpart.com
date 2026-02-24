/**
 * Media Gallery
 * Unified component for all video and image display.
 *
 * Two modes:
 * 1. Gallery mode (.pg-gallery) - Interactive photo/video grid with hover/click states
 * 2. Hero mode (.taped-image video) - Lazy-loaded videos with viewport-based playback
 *
 * Features:
 * - Single audio source policy (only one video can have audio at a time)
 * - Lazy loading for all videos
 * - Viewport-based auto-play/pause
 * - Audio fade in/out with toggle controls
 */

(function() {
  'use strict';

  // ===========================================
  // Configuration
  // ===========================================

  const CONFIG = {
    // Gallery settings
    photoSize: 180,
    photoHeight: 129, // 7:5 aspect ratio
    gridGap: 10,
    initialRotation: 1.5,
    hoverScale: 2.55,
    clickedScale: 5,
    hoverTilt: 8,
    tiltSpeed: 0,
    hoverRotationReset: 1,
    transitionSpeed: 100,
    putDownDrift: 31,
    putDownRotation: 7.5,
    maxDriftFromOrigin: 32,
    dragThreshold: 5,
    // Hero video settings
    heroThreshold: 0.25,
    heroRootMargin: '100px',

    // Lazy loading settings
    lazyLoadMargin: '200px',      // Load gallery assets this far before viewport
    videoUnloadMargin: '200%',    // Unload videos this far from viewport

    // Audio settings
    fadeInDuration: 500,
    fadeOutDuration: 300
  };

  // Get config overrides from script tag
  const scriptTag = document.currentScript;
  if (scriptTag) {
    if (scriptTag.dataset.threshold) CONFIG.heroThreshold = parseFloat(scriptTag.dataset.threshold);
    if (scriptTag.dataset.rootMargin) CONFIG.heroRootMargin = scriptTag.dataset.rootMargin;
  }

  // ===========================================
  // SVG Icons
  // ===========================================

  const ICONS = {
    muted: '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
    unmuted: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>'
  };

  // ===========================================
  // Audio Controller (Singleton)
  // ===========================================

  const audioController = {
    activeVideo: null,

    fadeInAudio(video, duration = CONFIG.fadeInDuration) {
      video.volume = 0;
      video.muted = false;

      const startTime = Date.now();
      const tick = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        video.volume = progress;
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },

    fadeOutAudio(video, duration = CONFIG.fadeOutDuration, callback) {
      const startVolume = video.volume;
      if (startVolume === 0) {
        video.muted = true;
        if (callback) callback();
        return;
      }

      const startTime = Date.now();
      const tick = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        video.volume = startVolume * (1 - progress);

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          video.muted = true;
          video.volume = 1;
          if (callback) callback();
        }
      };
      requestAnimationFrame(tick);
    },

    updateToggleIcon(toggle, muted) {
      toggle.innerHTML = muted ? ICONS.muted : ICONS.unmuted;
    },

    setAudioActive(video) {
      // Mute previous active video
      if (this.activeVideo && this.activeVideo !== video) {
        const prevVideo = this.activeVideo;
        this.fadeOutAudio(prevVideo, 200, () => {
          this.updateUI(prevVideo, true);
        });
      }

      this.activeVideo = video;
      this.fadeInAudio(video);
      this.updateUI(video, false);
    },

    setAudioInactive(video) {
      this.fadeOutAudio(video);

      if (this.activeVideo === video) {
        this.activeVideo = null;
      }

      this.updateUI(video, true);
    },

    toggleAudio(video) {
      if (video.muted) {
        this.setAudioActive(video);
      } else {
        this.setAudioInactive(video);
      }
    },

    updateUI(video, muted) {
      // Find container - could be .pg-photo (gallery) or .taped-image (hero)
      const container = video.closest('.pg-photo') || video.closest('.taped-image');
      if (!container) return;

      const toggle = container.querySelector('.video-audio-toggle');
      const glow = container.querySelector('.video-audio-glow');

      if (toggle) this.updateToggleIcon(toggle, muted);
      if (glow) glow.classList.toggle('active', !muted);
    }
  };

  // Export for external access if needed
  window.videoAudioController = audioController;

  // ===========================================
  // Shared Video Utilities
  // ===========================================

  const loadedVideos = new Set();  // Track all loaded videos
  const pendingFetches = new Map();  // Track in-progress fetches (video -> AbortController)

  function createLoadingBar(photo) {
    let bar = photo.querySelector('.pg-loading-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'pg-loading-bar';
      bar.innerHTML = '<div class="pg-loading-bar-fill"></div><span class="pg-loading-bar-text">0 KB</span>';
      photo.appendChild(bar);
    }
    return bar;
  }

  function updateLoadingBar(bar, loaded, total) {
    const fill = bar.querySelector('.pg-loading-bar-fill');
    const text = bar.querySelector('.pg-loading-bar-text');
    const loadedKB = Math.round(loaded / 1024);
    const totalKB = total ? Math.round(total / 1024) : '?';
    const percent = total ? Math.round((loaded / total) * 100) : 0;

    if (fill) fill.style.width = percent + '%';
    if (text) text.textContent = `${loadedKB} / ${totalKB} KB (${percent}%)`;
  }

  function removeLoadingBar(photo) {
    const bar = photo.querySelector('.pg-loading-bar');
    if (bar) bar.remove();
  }

  function loadVideo(video) {
    // Always ensure we have a source to load
    const src = video.dataset.lazySrc || video.dataset.videoSrc;
    if (!src) {
      console.warn('[loadVideo] No source available for video');
      return;
    }

    // Store source permanently (never lose it)
    video.dataset.videoSrc = src;

    // AGGRESSIVE: Unload ALL other videos first
    unloadAllVideosExcept(video);

    // If already loaded with blob URL, just play
    if (video.src && video.src.startsWith('blob:')) {
      console.log('[loadVideo] Already loaded, playing:', src);
      video.play().catch(() => {});
      return;
    }

    // Cancel any pending fetch for this video
    if (pendingFetches.has(video)) {
      console.log('[loadVideo] Cancelling pending fetch for:', src);
      pendingFetches.get(video).abort();
      pendingFetches.delete(video);
    }

    const photo = video.closest('.pg-photo');

    // Create progress bar
    const loadingBar = photo ? createLoadingBar(photo) : null;
    console.log('[loadVideo] Starting fetch for:', src);

    // Create abort controller for this fetch
    const abortController = new AbortController();
    pendingFetches.set(video, abortController);

    // Use fetch to track progress, then load into video
    fetch(src, { signal: abortController.signal })
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let loaded = 0;

        const reader = response.body.getReader();
        const chunks = [];

        function read() {
          return reader.read().then(({ done, value }) => {
            if (done) {
              return new Blob(chunks, { type: 'video/mp4' });
            }
            chunks.push(value);
            loaded += value.length;
            if (loadingBar) updateLoadingBar(loadingBar, loaded, total);
            return read();
          });
        }

        return read();
      })
      .then(blob => {
        // Remove from pending fetches
        pendingFetches.delete(video);

        const blobUrl = URL.createObjectURL(blob);
        console.log('[loadVideo] Fetch complete, created blob URL:', blobUrl.slice(0, 50));
        video.src = blobUrl;

        video.addEventListener('canplay', function onCanPlay() {
          console.log('[loadVideo] Video canplay:', src);
          if (photo) {
            removeLoadingBar(photo);
            applyAspectRatio(photo, video.videoWidth, video.videoHeight);
          }
        }, { once: true });

        video.load();
        video.play().catch(() => {});

        loadedVideos.add(video);
        delete video.dataset.lazySrc;
      })
      .catch(err => {
        // Remove from pending fetches
        pendingFetches.delete(video);

        // Ignore abort errors (expected when moving between videos quickly)
        if (err.name === 'AbortError') {
          console.log('[loadVideo] Fetch aborted for:', src);
          if (photo) removeLoadingBar(photo);
          return;
        }

        console.error('[loadVideo] Fetch error:', err, src);
        if (photo) {
          removeLoadingBar(photo);
          // Show error in bar briefly
          const errorBar = createLoadingBar(photo);
          const text = errorBar.querySelector('.pg-loading-bar-text');
          if (text) text.textContent = 'Error: ' + err.message;
        }
        // Allow retry
        if (video.dataset.videoSrc) {
          video.dataset.lazySrc = video.dataset.videoSrc;
        }
      });
  }

  function unloadVideo(video) {
    // Don't unload if audio is active (user is listening)
    if (!video.muted) {
      console.log('[unloadVideo] Skipping - audio active');
      return;
    }

    const src = video.dataset.videoSrc || 'unknown';
    console.log('[unloadVideo] Unloading:', src);

    // Cancel any pending fetch
    if (pendingFetches.has(video)) {
      console.log('[unloadVideo] Aborting pending fetch');
      pendingFetches.get(video).abort();
      pendingFetches.delete(video);
    }

    video.pause();

    // Revoke blob URL if exists
    if (video.src && video.src.startsWith('blob:')) {
      console.log('[unloadVideo] Revoking blob URL');
      URL.revokeObjectURL(video.src);
    }

    // Remove source elements to free buffer
    const sources = video.querySelectorAll('source');
    sources.forEach(s => s.remove());
    video.removeAttribute('src');
    video.load(); // Clear internal buffer

    loadedVideos.delete(video);

    // Always restore lazySrc for re-loading
    if (video.dataset.videoSrc) {
      video.dataset.lazySrc = video.dataset.videoSrc;
    }

    // Show preview again
    const photo = video.closest('.pg-photo');
    if (photo) {
      removeLoadingBar(photo);
      const preview = photo.querySelector('.pg-preview');
      if (preview) preview.style.display = 'block';
      video.style.display = 'none';
    }
  }

  function unloadAllVideosExcept(keepVideo) {
    // CRITICAL: Copy to array first to avoid modifying Set while iterating
    const videosToUnload = [...loadedVideos].filter(v => v !== keepVideo);
    videosToUnload.forEach(unloadVideo);
  }

  function pauseVideo(video) {
    if (video && !video.paused) {
      video.pause();
    }
  }

  function playVideo(video) {
    if (video && video.paused) {
      video.play().catch(() => {});
    }
  }

  // Videos with no audio track — skip audio controls
  const NO_AUDIO = [
    'bartleby-cad-render/video.mp4',
    'oled-prototype-breadboard/video.mp4'
  ];

  function addAudioControls(container, video) {
    if (container.querySelector('.video-audio-toggle')) return;
    const src = video.getAttribute('src') || video.getAttribute('data-lazy-src') || '';
    if (NO_AUDIO.some(path => src.includes(path))) return;

    // Create wrapper for 3D isolation
    const wrapper = document.createElement('div');
    wrapper.className = 'video-audio-toggle-wrapper';

    const toggle = document.createElement('button');
    toggle.className = 'video-audio-toggle';
    toggle.innerHTML = ICONS.muted;
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      audioController.toggleAudio(video);
    });

    wrapper.appendChild(toggle);

    // Stop mouse events on wrapper to prevent state changes
    ['mousedown', 'mouseup', 'mousemove', 'mouseenter'].forEach(eventType => {
      wrapper.addEventListener(eventType, (e) => e.stopPropagation());
    });

    // Create rainbow glow element
    const glow = document.createElement('div');
    glow.className = 'video-audio-glow';

    container.appendChild(glow);
    container.appendChild(wrapper);
  }

  // ===========================================
  // Gallery Mode
  // ===========================================

  const MOBILE_QUERY = '(max-width: 768px)';
  const Z_INDEX_HOVER = 10000;
  const Z_INDEX_CLICKED = 10001;

  // Drag state
  let dragState = {
    active: false,
    photo: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    hasDragged: false,
    isFirstClick: false
  };

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function updateShine(photo, tiltX, tiltY) {
    const catchX = -tiltX / 20;
    const catchY = tiltY / 20;
    const catchAmount = (catchX + catchY) / 2;
    const intensity = clamp(catchAmount + 0.2, 0, 1);
    photo.style.setProperty('--shine-intensity', intensity);
  }

  function updateShineFromRotation(photo, rotation) {
    photo.style.setProperty('--shine-intensity', 0.15);
  }

  function showVideo(photo) {
    const video = photo.querySelector('video');
    const preview = photo.querySelector('.pg-preview');
    if (video) video.style.display = 'block';
    if (preview) preview.style.display = 'none';
  }

  function showPreview(photo) {
    const video = photo.querySelector('video');
    const preview = photo.querySelector('.pg-preview');
    if (video) video.style.display = 'none';
    if (preview) preview.style.display = 'block';
  }

  function loadAndPlayGalleryVideo(photo) {
    const video = photo.querySelector('video');
    if (!video) return;

    // Always go through loadVideo - it handles all cases robustly
    loadVideo(video);
  }

  function constrainToViewport(photo, x, y, scale) {
    // Get photo's base dimensions
    const photoWidth = photo.offsetWidth;
    const photoHeight = photo.offsetHeight;
    const scaledHalfWidth = (photoWidth * scale) / 2;
    const scaledHalfHeight = (photoHeight * scale) / 2;

    // Get photo's original center position (without transform)
    // offsetLeft/Top gives position relative to offsetParent
    // We need to get the absolute position on the page
    let el = photo;
    let baseLeft = 0;
    let baseTop = 0;
    while (el) {
      baseLeft += el.offsetLeft;
      baseTop += el.offsetTop;
      el = el.offsetParent;
    }
    // Account for scroll
    baseLeft -= window.scrollX;
    baseTop -= window.scrollY;

    // Photo center in viewport coordinates (before any translate)
    const centerX = baseLeft + photoWidth / 2;
    const centerY = baseTop + photoHeight / 2;

    // After translate(x, y), the center will be at (centerX + x, centerY + y)
    // The scaled photo edges will be at:
    //   left edge: centerX + x - scaledHalfWidth
    //   right edge: centerX + x + scaledHalfWidth
    //   top edge: centerY + y - scaledHalfHeight
    //   bottom edge: centerY + y + scaledHalfHeight

    // Constrain so edges stay within viewport [0, window.innerWidth] and [0, window.innerHeight]
    // left edge >= 0:  centerX + x - scaledHalfWidth >= 0  =>  x >= scaledHalfWidth - centerX
    // right edge <= W: centerX + x + scaledHalfWidth <= W  =>  x <= W - centerX - scaledHalfWidth
    // top edge >= 0:   centerY + y - scaledHalfHeight >= 0 =>  y >= scaledHalfHeight - centerY
    // bottom edge <= H: centerY + y + scaledHalfHeight <= H => y <= H - centerY - scaledHalfHeight

    const minX = scaledHalfWidth - centerX;
    const maxX = window.innerWidth - centerX - scaledHalfWidth;
    const minY = scaledHalfHeight - centerY;
    const maxY = window.innerHeight - centerY - scaledHalfHeight;

    return {
      x: clamp(x, minX, maxX),
      y: clamp(y, minY, maxY)
    };
  }

  function enterHoverState(photo) {
    if (window.matchMedia(MOBILE_QUERY).matches) return;
    if (photo.dataset.state !== 'normal') return;

    const currentX = parseFloat(photo.dataset.currentX) || 0;
    const currentY = parseFloat(photo.dataset.currentY) || 0;
    const currentRotation = parseFloat(photo.dataset.currentRotation) || 0;

    const constrained = constrainToViewport(photo, currentX, currentY, CONFIG.hoverScale);
    const targetRotation = currentRotation * (1 - CONFIG.hoverRotationReset);

    photo.dataset.hoverRotation = targetRotation;
    photo.dataset.hoverX = constrained.x;
    photo.dataset.hoverY = constrained.y;
    photo.dataset.state = 'hover';
    photo.classList.add('hovering');
    photo.style.setProperty('--tilt-speed', CONFIG.tiltSpeed + 'ms');
    photo.style.zIndex = Z_INDEX_HOVER;

    photo.style.transform = `translate(${constrained.x}px, ${constrained.y}px) rotate(${targetRotation}deg) scale(${CONFIG.hoverScale}) rotateX(0deg) rotateY(0deg)`;

    showVideo(photo);
    loadAndPlayGalleryVideo(photo);
  }

  function enterClickedState(photo) {
    if (photo.dataset.state !== 'hover') return;

    const currentX = parseFloat(photo.dataset.currentX) || 0;
    const currentY = parseFloat(photo.dataset.currentY) || 0;
    const constrained = constrainToViewport(photo, currentX, currentY, CONFIG.clickedScale);

    photo.dataset.state = 'clicked';
    photo.dataset.currentX = constrained.x;
    photo.dataset.currentY = constrained.y;
    photo.classList.add('clicked');
    photo.classList.remove('tilt-right', 'tilt-left', 'tilt-up', 'tilt-down');
    photo.style.zIndex = Z_INDEX_CLICKED;

    photo.style.transform = `translate(${constrained.x}px, ${constrained.y}px) rotate(0deg) scale(${CONFIG.clickedScale}) rotateX(0deg) rotateY(0deg)`;
    photo.style.setProperty('--shine-intensity', 0.1);
  }

  function enterNormalState(photo) {
    if (photo.dataset.state === 'normal') return;

    const video = photo.querySelector('video');
    const audioActive = video && !video.muted;
    if (!audioActive && video) {
      // Aggressively unload video when leaving hover
      unloadVideo(video);
    }

    photo.classList.remove('hovering', 'clicked', 'tilt-right', 'tilt-left', 'tilt-up', 'tilt-down');
    photo.dataset.state = 'normal';
    photo.style.zIndex = '';

    const currentX = parseFloat(photo.dataset.currentX) || 0;
    const currentY = parseFloat(photo.dataset.currentY) || 0;
    const originX = parseFloat(photo.dataset.originX) || 0;
    const originY = parseFloat(photo.dataset.originY) || 0;

    let newX = currentX + randomInRange(-CONFIG.putDownDrift, CONFIG.putDownDrift);
    let newY = currentY + randomInRange(-CONFIG.putDownDrift, CONFIG.putDownDrift);
    const newRotation = randomInRange(-CONFIG.putDownRotation, CONFIG.putDownRotation);

    newX = clamp(newX, originX - CONFIG.maxDriftFromOrigin, originX + CONFIG.maxDriftFromOrigin);
    newY = clamp(newY, originY - CONFIG.maxDriftFromOrigin, originY + CONFIG.maxDriftFromOrigin);

    photo.dataset.currentX = newX;
    photo.dataset.currentY = newY;
    photo.dataset.currentRotation = newRotation;

    photo.style.transform = `translate(${newX}px, ${newY}px) rotate(${newRotation}deg) scale(1) rotateX(0deg) rotateY(0deg)`;
    updateShineFromRotation(photo, newRotation);
  }

  function onPhotoMouseMove(photo, e) {
    if (photo.dataset.state !== 'hover') return;

    // Skip tilt for videos — 3D transforms distort audio toggle hit area
    if (photo.querySelector('video')) return;

    const rect = photo.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const relX = (e.clientX - centerX) / (rect.width / 2);
    const relY = (e.clientY - centerY) / (rect.height / 2);

    const tiltX = relY * CONFIG.hoverTilt;
    const tiltY = -relX * CONFIG.hoverTilt;

    const hoverX = parseFloat(photo.dataset.hoverX);
    const hoverY = parseFloat(photo.dataset.hoverY);
    const hoverRotation = parseFloat(photo.dataset.hoverRotation);

    photo.style.transform = `translate(${hoverX}px, ${hoverY}px) rotate(${hoverRotation}deg) scale(${CONFIG.hoverScale}) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;

    photo.classList.toggle('tilt-right', tiltY < -2);
    photo.classList.toggle('tilt-left', tiltY > 2);
    photo.classList.toggle('tilt-up', tiltX < -2);
    photo.classList.toggle('tilt-down', tiltX > 2);

    updateShine(photo, tiltX, tiltY);
  }

  function onPhotoMouseDown(photo, e) {
    if (photo.dataset.state !== 'clicked') return;

    e.preventDefault();

    const currentX = parseFloat(photo.dataset.currentX) || 0;
    const currentY = parseFloat(photo.dataset.currentY) || 0;

    dragState = {
      active: true,
      photo: photo,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: currentX,
      offsetY: currentY,
      hasDragged: false
    };

    photo.style.transition = 'none';
  }

  function onDocumentMouseMove(e) {
    if (!dragState.active) return;

    const photo = dragState.photo;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;

    if (!dragState.hasDragged) {
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > CONFIG.dragThreshold) {
        dragState.hasDragged = true;
      } else {
        return;
      }
    }

    const rawX = dragState.offsetX + dx;
    const rawY = dragState.offsetY + dy;
    const constrained = constrainToViewport(photo, rawX, rawY, CONFIG.clickedScale);

    photo.dataset.dragX = constrained.x;
    photo.dataset.dragY = constrained.y;

    photo.style.transform = `translate(${constrained.x}px, ${constrained.y}px) rotate(0deg) scale(${CONFIG.clickedScale}) rotateX(0deg) rotateY(0deg)`;
  }

  function onDocumentMouseUp(e) {
    if (!dragState.active) return;

    const photo = dragState.photo;
    const wasDrag = dragState.hasDragged;
    const wasFirstClick = dragState.isFirstClick;

    photo.style.transition = `transform ${CONFIG.transitionSpeed}ms ease, box-shadow ${CONFIG.transitionSpeed}ms ease`;

    if (wasDrag) {
      photo.dataset.currentX = photo.dataset.dragX || photo.dataset.currentX;
      photo.dataset.currentY = photo.dataset.dragY || photo.dataset.currentY;
    }

    dragState = {
      active: false,
      photo: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
      hasDragged: false,
      isFirstClick: false
    };

    // Only dismiss if it's a second click (not first click to zoom) and no drag happened
    if (!wasDrag && photo.dataset.state === 'clicked' && !wasFirstClick) {
      enterNormalState(photo);
      photo.dataset.justDismissed = 'true';
    }
  }

  function onPhotoMouseLeave(photo) {
    if (dragState.active && dragState.photo === photo) return;
    enterNormalState(photo);
  }

  function parseItemData(itemData) {
    if (typeof itemData === 'string') {
      return { type: 'image', src: itemData };
    }
    if (Array.isArray(itemData)) {
      return { type: 'image', src: itemData[0] };
    }

    const item = {
      type: itemData.type || 'image',
      src: itemData.src,
      thumb: itemData.thumb,
      preview: itemData.preview,
      center: itemData.center
    };

    // Auto-derive thumb and preview for videos if not specified
    if (item.type === 'video' && item.src) {
      const lastSlash = item.src.lastIndexOf('/');
      const dir = item.src.substring(0, lastSlash + 1);
      const filename = item.src.substring(lastSlash + 1);
      const basename = filename.replace(/\.mp4$/i, '');

      // For "video.mp4", use "thumb.jpg" and "preview.gif"
      // For other names like "02.mp4", use "02-thumb.jpg" and "02-preview.gif"
      if (basename === 'video') {
        if (!item.thumb) item.thumb = dir + 'thumb.jpg';
        if (!item.preview) item.preview = dir + 'preview.gif';
      } else {
        if (!item.thumb) item.thumb = dir + basename + '-thumb.jpg';
        if (!item.preview) item.preview = dir + basename + '-preview.gif';
      }
    }

    return item;
  }

  function createPhotoElement(itemData, index) {
    const item = parseItemData(itemData);
    const isVideo = item.type === 'video';

    const photo = document.createElement('div');
    photo.className = 'pg-photo';
    if (isVideo) photo.classList.add('pg-video');

    // Flexbox layout - position is relative to natural flow
    const rotation = randomInRange(-CONFIG.initialRotation, CONFIG.initialRotation);
    photo.dataset.originX = 0;
    photo.dataset.originY = 0;
    photo.dataset.currentX = 0;
    photo.dataset.currentY = 0;
    photo.dataset.currentRotation = rotation;
    photo.dataset.index = index;
    photo.dataset.state = 'normal';

    photo.style.transform = `rotate(${rotation}deg)`;
    photo.style.transition = `transform ${CONFIG.transitionSpeed}ms ease, box-shadow ${CONFIG.transitionSpeed}ms ease`;

    const inner = document.createElement('div');
    inner.className = 'pg-photo-inner';

    if (isVideo) {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.poster = item.thumb || '';
      video.dataset.lazySrc = item.src;
      video.draggable = false;
      if (item.center) {
        video.style.objectPosition = `${item.center[0]}% ${item.center[1]}%`;
      }

      // GIF preview - shown in normal state, hidden on hover/click
      if (item.preview) {
        video.style.display = 'none';

        const preview = document.createElement('img');
        preview.className = 'pg-preview';
        preview.dataset.src = item.preview;  // Lazy load
        preview.alt = '';
        preview.draggable = false;
        if (item.center) {
          preview.style.objectPosition = `${item.center[0]}% ${item.center[1]}%`;
        }
        inner.appendChild(preview);
      }

      inner.appendChild(video);

      // Store video ref for adding controls after inner
      photo._video = video;
    } else {
      const img = document.createElement('img');
      img.dataset.src = item.src;  // Lazy load
      img.alt = '';
      img.draggable = false;
      if (item.center) {
        img.style.objectPosition = `${item.center[0]}% ${item.center[1]}%`;
      }
      inner.appendChild(img);
    }

    photo.appendChild(inner);

    // Filename label — visible when enlarged
    // Show parent folder + filename for identification (e.g. "bartleby-cad-render/video.mp4")
    const parts = item.src.split('/').filter(Boolean);
    const labelText = parts.length >= 2 ? parts.slice(-2).join('/') : parts.pop();
    if (labelText) {
      const label = document.createElement('span');
      label.className = 'pg-filename';
      label.textContent = labelText;
      // Block drag/dismiss from firing when interacting with the label
      label.addEventListener('mousedown', (e) => e.stopPropagation());
      label.addEventListener('mouseup', (e) => e.stopPropagation());
      label.addEventListener('click', (e) => e.stopPropagation());
      photo.appendChild(label);
    }

    // Add audio controls for video
    if (photo._video) {
      addAudioControls(photo, photo._video);
      delete photo._video;
    }

    // Create edges
    ['bottom', 'right', 'left', 'top'].forEach(side => {
      const edge = document.createElement('div');
      edge.className = `pg-edge pg-edge-${side}`;
      photo.appendChild(edge);
    });

    updateShineFromRotation(photo, rotation);

    // Event listeners
    photo.addEventListener('mouseenter', () => {
      if (photo.dataset.justDismissed) return;
      enterHoverState(photo);
    });
    photo.addEventListener('mouseleave', () => {
      delete photo.dataset.justDismissed;
      onPhotoMouseLeave(photo);
    });
    photo.addEventListener('mousedown', (e) => {
      if (photo.dataset.state === 'normal' && photo.dataset.justDismissed) {
        delete photo.dataset.justDismissed;
        enterHoverState(photo);
      } else if (photo.dataset.state === 'hover') {
        enterClickedState(photo);
        // Start drag but mark as first click (don't dismiss on mouseup unless dragged)
        onPhotoMouseDown(photo, e);
        dragState.isFirstClick = true;
      } else if (photo.dataset.state === 'clicked') {
        onPhotoMouseDown(photo, e);
        dragState.isFirstClick = false;
      }
    });
    photo.addEventListener('mousemove', (e) => onPhotoMouseMove(photo, e));

    return photo;
  }

  // Viewport observer for gallery audio
  const galleryAudioObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;
      const photo = video.closest('.pg-photo');
      const toggle = photo?.querySelector('.video-audio-toggle-wrapper');

      if (entry.intersectionRatio < 0.5) {
        if (toggle) toggle.classList.add('offscreen');
        if (!video.muted) {
          audioController.setAudioInactive(video);
        }
      } else {
        if (toggle) toggle.classList.remove('offscreen');
      }
    });
  }, { threshold: [0, 0.5] });

  // Gallery lazy load observer - loads images/GIFs when gallery approaches viewport
  const galleryLazyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loadGalleryAssets(entry.target);
        galleryLazyObserver.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: CONFIG.lazyLoadMargin
  });

  function applyAspectRatio(photo, width, height) {
    // Get base size from CSS custom property (for responsive) or use CONFIG default
    const gallery = photo.closest('.pg-gallery');
    const cssSize = gallery ? getComputedStyle(gallery).getPropertyValue('--photo-size') : null;
    const baseSize = cssSize ? parseInt(cssSize) : CONFIG.photoSize;

    // Long side stays at baseSize, short side calculated from ratio
    const isPortrait = height > width;
    const ratio = width / height;

    if (isPortrait) {
      photo.classList.add('pg-portrait');
      photo.style.width = `${baseSize * ratio}px`;
      photo.style.height = `${baseSize}px`;
    } else {
      photo.classList.remove('pg-portrait');
      photo.style.width = `${baseSize}px`;
      photo.style.height = `${baseSize / ratio}px`;
    }
  }

  function loadGalleryAssets(gallery) {
    // Load all images with data-src (both regular images and video preview GIFs)
    const lazyImages = gallery.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => {
      img.src = img.dataset.src;
      delete img.dataset.src;

      // Apply actual aspect ratio after load
      img.addEventListener('load', () => {
        const photo = img.closest('.pg-photo');
        if (photo) {
          applyAspectRatio(photo, img.naturalWidth, img.naturalHeight);
        }
      }, { once: true });
    });
  }

  function initGallery(gallery) {
    const imagesData = gallery.dataset.images;
    if (!imagesData) return;

    let images;
    try {
      images = JSON.parse(imagesData);
    } catch (e) {
      console.error('Media Gallery: Invalid data-images JSON', e);
      return;
    }

    images.forEach((imageStack, index) => {
      const photo = createPhotoElement(imageStack, index);
      gallery.appendChild(photo);

      // Observe videos for audio viewport management
      const video = photo.querySelector('video');
      if (video) {
        galleryAudioObserver.observe(video);
      }
    });

    // Observe gallery for lazy loading
    galleryLazyObserver.observe(gallery);
  }

  // ===========================================
  // Hero Mode
  // ===========================================

  // Viewport observer for hero audio
  const heroAudioObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;
      const container = video.closest('.taped-image');
      const toggle = container?.querySelector('.video-audio-toggle');

      if (entry.intersectionRatio < 0.5) {
        if (toggle) toggle.classList.add('offscreen');
        if (!video.muted) {
          audioController.setAudioInactive(video);
        }
      } else {
        if (toggle) toggle.classList.remove('offscreen');
      }
    });
  }, { threshold: [0, 0.5] });

  // Viewport observer for hero video playback
  const heroPlaybackObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;

      if (entry.isIntersecting) {
        loadVideo(video);
        playVideo(video);
      } else {
        if (!video.muted) {
          audioController.setAudioInactive(video);
          setTimeout(() => pauseVideo(video), 350);
        } else {
          pauseVideo(video);
        }
      }
    });
  }, {
    threshold: CONFIG.heroThreshold,
    rootMargin: CONFIG.heroRootMargin
  });

  function initHeroVideo(video) {
    // Skip gallery videos
    if (video.closest('.pg-gallery')) return;

    const container = video.closest('.taped-image');
    if (!container) return;

    addAudioControls(container, video);
    heroAudioObserver.observe(video);
    heroPlaybackObserver.observe(video);
  }

  // ===========================================
  // Initialization
  // ===========================================

  function init() {
    // Initialize all galleries
    const galleries = document.querySelectorAll('.pg-gallery');
    galleries.forEach(initGallery);

    // Initialize all hero videos
    const heroVideos = document.querySelectorAll('video[data-lazy-src]');
    heroVideos.forEach(initHeroVideo);

    // Document-level drag handlers for galleries
    document.addEventListener('mousemove', onDocumentMouseMove);
    document.addEventListener('mouseup', onDocumentMouseUp);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
