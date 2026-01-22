/**
 * Lazy Video Loader
 *
 * Loads and plays videos only when they enter the viewport.
 * Uses Intersection Observer for efficiency.
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

  function init() {
    const videos = document.querySelectorAll('video[data-lazy-src]');
    if (!videos.length) return;

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
          pauseVideo(video);
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
