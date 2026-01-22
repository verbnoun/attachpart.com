/**
 * Photo Gallery
 * - 3D tilt toward mouse on hover
 * - Glossy light-catch effect (fixed top-left light source)
 * - Photo thickness/edges visible on tilting side only
 * - Drift on put-down (photos get messy with interaction)
 * - Max drift constraint (photos stay near origin)
 */

(function() {
  const PG_CONFIG = {
    photoSize: 180,
    photoHeight: 129, // 7:5 aspect ratio (180 * 5/7)
    gridGap: 10,
    initialRotation: 1.5,
    hoverScale: 2.55,
    hoverTilt: 8,
    tiltSpeed: 0,
    hoverRotationReset: 1, // 100% = full reset
    transitionSpeed: 100,
    putDownDrift: 31,
    putDownRotation: 7.5,
    maxDriftFromOrigin: 32
  };

  const MOBILE_QUERY = '(max-width: 768px)';

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  /**
   * Generate positions for photos based on layout
   */
  function generatePositions(count, layout) {
    const positions = [];
    const size = PG_CONFIG.photoSize;
    const height = PG_CONFIG.photoHeight;
    const gap = PG_CONFIG.gridGap;

    if (layout === 'grid') {
      // 2x2 grid layout
      const cols = 2;
      const spacingX = size + gap;
      const spacingY = height + gap;

      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        positions.push({
          x: col * spacingX,
          y: row * spacingY,
          rotation: randomInRange(-PG_CONFIG.initialRotation, PG_CONFIG.initialRotation),
          zIndex: i + 1
        });
      }
    } else {
      // Horizontal layout (default)
      const spacing = size + gap;
      for (let i = 0; i < count; i++) {
        positions.push({
          x: i * spacing,
          y: 0,
          rotation: randomInRange(-PG_CONFIG.initialRotation, PG_CONFIG.initialRotation),
          zIndex: i + 1
        });
      }
    }

    return positions;
  }

  /**
   * Update shine based on tilt angle relative to fixed light source
   * Light comes from top-left (above and to the left of viewer)
   */
  function updateShine(photo, tiltX, tiltY) {
    // With tilt directions:
    // - tiltX negative = top edge toward viewer (catches light from above)
    // - tiltY positive = left edge toward viewer (catches light from left)

    const catchX = -tiltX / 20;
    const catchY = tiltY / 20;

    const catchAmount = (catchX + catchY) / 2;
    const intensity = clamp(catchAmount + 0.2, 0, 1);

    photo.style.setProperty('--shine-intensity', intensity);
  }

  /**
   * Update shine from 2D rotation (for resting photos)
   */
  function updateShineFromRotation(photo, rotation) {
    photo.style.setProperty('--shine-intensity', 0.15);
  }

  let baseZIndex = 100;

  /**
   * Handle hover state changes
   */
  function onPhotoHover(photo, isHovering) {
    if (window.matchMedia(MOBILE_QUERY).matches) return;

    const currentX = parseFloat(photo.dataset.currentX) || 0;
    const currentY = parseFloat(photo.dataset.currentY) || 0;
    const currentRotation = parseFloat(photo.dataset.currentRotation) || 0;

    if (isHovering) {
      const targetRotation = currentRotation * (1 - PG_CONFIG.hoverRotationReset);
      photo.dataset.hoverRotation = targetRotation;
      photo.dataset.isHovered = 'true';
      photo.classList.add('hovering');
      photo.style.setProperty('--tilt-speed', PG_CONFIG.tiltSpeed + 'ms');
      photo.style.zIndex = baseZIndex++;

      photo.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${targetRotation}deg) scale(${PG_CONFIG.hoverScale}) rotateX(0deg) rotateY(0deg)`;
    } else {
      photo.classList.remove('hovering', 'tilt-right', 'tilt-left', 'tilt-up', 'tilt-down');
      photo.dataset.isHovered = 'false';

      // Drift to new position
      const originX = parseFloat(photo.dataset.originX) || 0;
      const originY = parseFloat(photo.dataset.originY) || 0;

      let newX = currentX + randomInRange(-PG_CONFIG.putDownDrift, PG_CONFIG.putDownDrift);
      let newY = currentY + randomInRange(-PG_CONFIG.putDownDrift, PG_CONFIG.putDownDrift);
      const newRotation = randomInRange(-PG_CONFIG.putDownRotation, PG_CONFIG.putDownRotation);

      // Clamp to max drift from origin
      newX = clamp(newX, originX - PG_CONFIG.maxDriftFromOrigin, originX + PG_CONFIG.maxDriftFromOrigin);
      newY = clamp(newY, originY - PG_CONFIG.maxDriftFromOrigin, originY + PG_CONFIG.maxDriftFromOrigin);

      photo.dataset.currentX = newX;
      photo.dataset.currentY = newY;
      photo.dataset.currentRotation = newRotation;

      photo.style.transform = `translate(${newX}px, ${newY}px) rotate(${newRotation}deg) scale(1) rotateX(0deg) rotateY(0deg)`;

      updateShineFromRotation(photo, newRotation);
    }
  }

  /**
   * Handle mouse move for 3D tilt effect
   */
  function onPhotoMouseMove(photo, e) {
    if (photo.dataset.isHovered !== 'true') return;

    const rect = photo.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate mouse position relative to center (-1 to 1)
    const relX = (e.clientX - centerX) / (rect.width / 2);
    const relY = (e.clientY - centerY) / (rect.height / 2);

    // Tilt TOWARD mouse - edge nearest mouse lifts up
    const tiltStrength = PG_CONFIG.hoverTilt;
    const tiltX = relY * tiltStrength;   // mouse bottom = bottom edge toward viewer
    const tiltY = -relX * tiltStrength;  // mouse right = right edge toward viewer

    const currentX = parseFloat(photo.dataset.currentX);
    const currentY = parseFloat(photo.dataset.currentY);
    const hoverRotation = parseFloat(photo.dataset.hoverRotation);

    photo.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${hoverRotation}deg) scale(${PG_CONFIG.hoverScale}) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;

    // Update which edges are visible based on tilt direction
    // tiltY negative = right side toward viewer, tiltY positive = left side toward viewer
    // tiltX negative = top toward viewer, tiltX positive = bottom toward viewer
    photo.classList.toggle('tilt-right', tiltY < -2);
    photo.classList.toggle('tilt-left', tiltY > 2);
    photo.classList.toggle('tilt-up', tiltX < -2);
    photo.classList.toggle('tilt-down', tiltX > 2);

    updateShine(photo, tiltX, tiltY);
  }

  /**
   * Create a single photo element
   */
  function createPhotoElement(imageSrc, index, position) {
    const photo = document.createElement('div');
    photo.className = 'pg-photo';

    // Get image URL (support both array and string formats)
    const src = Array.isArray(imageSrc) ? imageSrc[0] : imageSrc;

    // Store position state
    photo.dataset.originX = position.x;
    photo.dataset.originY = position.y;
    photo.dataset.currentX = position.x;
    photo.dataset.currentY = position.y;
    photo.dataset.currentRotation = position.rotation;
    photo.dataset.index = index;
    photo.dataset.isHovered = 'false';

    // Set initial transform
    photo.style.transform = `translate(${position.x}px, ${position.y}px) rotate(${position.rotation}deg)`;
    photo.style.zIndex = position.zIndex;
    photo.style.transition = `transform ${PG_CONFIG.transitionSpeed}ms ease, box-shadow ${PG_CONFIG.transitionSpeed}ms ease`;

    // Create inner container
    const inner = document.createElement('div');
    inner.className = 'pg-photo-inner';

    // Create image (7:5 aspect ratio)
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.draggable = false;

    inner.appendChild(img);
    photo.appendChild(inner);

    // Create edges
    ['bottom', 'right', 'left', 'top'].forEach(side => {
      const edge = document.createElement('div');
      edge.className = `pg-edge pg-edge-${side}`;
      photo.appendChild(edge);
    });

    // Set initial shine
    updateShineFromRotation(photo, position.rotation);

    // Event listeners
    photo.addEventListener('mouseenter', () => onPhotoHover(photo, true));
    photo.addEventListener('mouseleave', () => onPhotoHover(photo, false));
    photo.addEventListener('mousemove', (e) => onPhotoMouseMove(photo, e));

    return photo;
  }

  /**
   * Initialize a gallery element
   */
  function initGallery(gallery) {
    const imagesData = gallery.dataset.images;
    if (!imagesData) return;

    let images;
    try {
      images = JSON.parse(imagesData);
    } catch (e) {
      console.error('Photo Gallery: Invalid data-images JSON', e);
      return;
    }

    const layout = gallery.dataset.layout || 'horizontal';
    const positions = generatePositions(images.length, layout);

    // Calculate container dimensions
    const size = PG_CONFIG.photoSize;
    const height = PG_CONFIG.photoHeight;
    const gap = PG_CONFIG.gridGap;

    if (layout === 'grid') {
      const cols = 2;
      const rows = Math.ceil(images.length / cols);
      gallery.style.setProperty('--gallery-width', `${cols * size + (cols - 1) * gap}px`);
      gallery.style.setProperty('--gallery-height', `${rows * height + (rows - 1) * gap}px`);
    } else {
      gallery.style.setProperty('--gallery-width', `${images.length * size + (images.length - 1) * gap}px`);
      gallery.style.setProperty('--gallery-height', `${height}px`);
    }

    // Reset base z-index for this gallery
    baseZIndex = images.length + 1;

    // Create photos
    images.forEach((imageStack, index) => {
      const photo = createPhotoElement(imageStack, index, positions[index]);
      gallery.appendChild(photo);
    });
  }

  /**
   * Initialize all galleries on page
   */
  function init() {
    const galleries = document.querySelectorAll('.pg-gallery');
    galleries.forEach(initGallery);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
