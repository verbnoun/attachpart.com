/**
 * Lazy Video Loader
 *
 * Loads and plays videos only when they enter the viewport.
 * Uses Intersection Observer for efficiency.
 * Includes audio controls with global single-audio-source state.
 *
 * Usage:
 *   <video data-lazy-src="/videos/example.mp4" poster="/videos/example-thumb.jpg" ...>
 *   </video>
 *
 * Config via data attributes on script tag or window.videoLazyConfig:
 *   data-threshold="0.5"  - 0 to 1, how much of video must be visible (default: 0.25)
 *   data-root-margin="0px" - margin around viewport (default: "100px" to preload slightly early)
 */

(function() {
  'use strict';

  // Get config from script tag or window
  const scriptTag = document.currentScript;
  const config = window.videoLazyConfig || {};

  const threshold = parseFloat(
    scriptTag?.dataset.threshold || config.threshold || 0.25
  );
  const rootMargin = scriptTag?.dataset.rootMargin || config.rootMargin || '100px';

  // SVG icons for audio toggle
  const ICON_MUTED = '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
  const ICON_UNMUTED = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';

  // Global audio controller - shared across all video scripts
  // Only one video can have audio playing at a time
  if (!window.videoAudioController) {
    window.videoAudioController = {
      activeVideo: null,

      fadeInAudio(video, duration = 500) {
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

      fadeOutAudio(video, duration = 300, callback) {
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
        toggle.innerHTML = muted ? ICON_MUTED : ICON_UNMUTED;
      },

      setAudioActive(video) {
        const ctrl = window.videoAudioController;

        // Mute previous active video
        if (ctrl.activeVideo && ctrl.activeVideo !== video) {
          const prevVideo = ctrl.activeVideo;
          ctrl.fadeOutAudio(prevVideo, 200, () => {
            ctrl.updateUI(prevVideo, true);
          });
        }

        ctrl.activeVideo = video;
        ctrl.fadeInAudio(video);
        ctrl.updateUI(video, false);
      },

      setAudioInactive(video) {
        const ctrl = window.videoAudioController;
        ctrl.fadeOutAudio(video);

        if (ctrl.activeVideo === video) {
          ctrl.activeVideo = null;
        }

        ctrl.updateUI(video, true);
      },

      toggleAudio(video) {
        const ctrl = window.videoAudioController;
        if (video.muted) {
          ctrl.setAudioActive(video);
        } else {
          ctrl.setAudioInactive(video);
        }
      },

      // Update UI elements (toggle icon, glow) for a video
      updateUI(video, muted) {
        const ctrl = window.videoAudioController;

        // Find container - could be .pg-photo (gallery) or .taped-image (hero)
        const container = video.closest('.pg-photo') || video.closest('.taped-image');
        if (!container) return;

        const toggle = container.querySelector('.video-audio-toggle');
        const glow = container.querySelector('.video-audio-glow');

        if (toggle) ctrl.updateToggleIcon(toggle, muted);
        if (glow) glow.classList.toggle('active', !muted);
      }
    };
  }

  const audioCtrl = window.videoAudioController;

  // Track loaded videos to avoid reloading
  const loadedVideos = new WeakSet();

  function loadVideo(video) {
    if (loadedVideos.has(video)) return;

    const src = video.dataset.lazySrc;
    if (!src) return;

    // Create and add source element
    const source = document.createElement('source');
    source.src = src;
    source.type = 'video/mp4';
    video.appendChild(source);

    // Load and play
    video.load();
    video.play().catch(() => {
      // Autoplay may be blocked, that's ok
    });

    loadedVideos.add(video);
    delete video.dataset.lazySrc;
  }

  function pauseVideo(video) {
    if (!video.paused) {
      video.pause();
    }
  }

  function playVideo(video) {
    if (video.paused && loadedVideos.has(video)) {
      video.play().catch(() => {});
    }
  }

  /**
   * Add audio toggle button and glow to a video container
   */
  function addAudioControls(video) {
    const container = video.closest('.taped-image');
    if (!container) return;

    // Skip if already has controls
    if (container.querySelector('.video-audio-toggle')) return;

    // Create wrapper div for the video if needed (to position toggle relative to video)
    // Since the video is already inside .taped-image, we add controls there

    // Create audio toggle button
    const toggle = document.createElement('button');
    toggle.className = 'video-audio-toggle';
    toggle.innerHTML = ICON_MUTED;
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      audioCtrl.toggleAudio(video);
    });
    container.appendChild(toggle);

    // Create rainbow glow element
    const glow = document.createElement('div');
    glow.className = 'video-audio-glow';
    container.appendChild(glow);
  }

  // Viewport observer for auto-fading audio when video leaves view
  const audioViewportObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;
      const container = video.closest('.taped-image');
      const toggle = container?.querySelector('.video-audio-toggle');

      if (entry.intersectionRatio < 0.5) {
        // Hide toggle when 50%+ off screen
        if (toggle) toggle.classList.add('offscreen');
        // Fade out audio if playing
        if (!video.muted) {
          audioCtrl.setAudioInactive(video);
        }
      } else {
        // Show toggle when 50%+ visible
        if (toggle) toggle.classList.remove('offscreen');
      }
    });
  }, { threshold: [0, 0.5] });

  function init() {
    const videos = document.querySelectorAll('video[data-lazy-src]');
    if (!videos.length) return;

    // Add audio controls to hero videos (those inside .taped-image but not in .pg-gallery)
    videos.forEach(video => {
      // Skip gallery videos - they're handled by photo-gallery.js
      if (video.closest('.pg-gallery')) return;

      addAudioControls(video);
      audioViewportObserver.observe(video);
    });

    // Check for Intersection Observer support
    if (!('IntersectionObserver' in window)) {
      // Fallback: load all videos immediately
      videos.forEach(loadVideo);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;

        if (entry.isIntersecting) {
          loadVideo(video);
          playVideo(video);
        } else {
          // Fade out audio first if playing, then pause
          if (!video.muted) {
            audioCtrl.setAudioInactive(video);
            // Pause after fade completes
            setTimeout(() => pauseVideo(video), 350);
          } else {
            pauseVideo(video);
          }
        }
      });
    }, {
      threshold: threshold,
      rootMargin: rootMargin
    });

    videos.forEach(video => observer.observe(video));
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
