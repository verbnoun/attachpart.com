/**
 * Photo Gallery
 * Three states:
 * - Normal: resting position
 * - Hover: enlarge with 3D tilt toward mouse
 * - Clicked: enlarge MORE (near viewport size), no tilt, draggable
 *
 * Transitions:
 * - mouseenter → hover
 * - click (while hover) → clicked
 * - click (while clicked, no drag) OR mouseleave → normal (with drift)
 * - drag (while clicked) → move photo within viewport bounds
 */

(function() {
  const PG_CONFIG = {
    photoSize: 180,
    photoHeight: 129, // 7:5 aspect ratio (180 * 5/7)
    gridGap: 10,
    initialRotation: 1.5,
    hoverScale: 2.55,
    clickedScale: 5, // Near viewport size
    hoverTilt: 8,
    tiltSpeed: 0,
    hoverRotationReset: 1, // 100% = full reset
    transitionSpeed: 100,
    putDownDrift: 31,
    putDownRotation: 7.5,
    maxDriftFromOrigin: 32,
    dragThreshold: 5 // pixels moved before it counts as drag
  };

  // Drag state
  let dragState = {
    active: false,
    photo: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    hasDragged: false
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

  // States: 'normal', 'hover', 'clicked'

  /**
   * Constrain position to keep scaled photo within viewport
   */
  function constrainToViewport(photo, x, y, scale) {
    const scaledWidth = PG_CONFIG.photoSize * scale;
    const scaledHeight = PG_CONFIG.photoHeight * scale;
    const halfWidth = scaledWidth / 2;
    const halfHeight = scaledHeight / 2;

    const gallery = photo.closest('.pg-gallery');
    const galleryRect = gallery.getBoundingClientRect();

    // Photo center in viewport = galleryRect.left + x + (photoSize/2)
    // Constrain so scaled photo stays in viewport
    const minX = -galleryRect.left - (PG_CONFIG.photoSize / 2) + halfWidth;
    const maxX = window.innerWidth - galleryRect.left - (PG_CONFIG.photoSize / 2) - halfWidth;
    const minY = -galleryRect.top - (PG_CONFIG.photoHeight / 2) + halfHeight;
    const maxY = window.innerHeight - galleryRect.top - (PG_CONFIG.photoHeight / 2) - halfHeight;

    return {
      x: clamp(x, minX, maxX),
      y: clamp(y, minY, maxY)
    };
  }

  /**
   * Transition to hover state (from normal)
   */
  function enterHoverState(photo) {
    if (window.matchMedia(MOBILE_QUERY).matches) return;
    if (photo.dataset.state !== 'normal') return;

    const currentX = parseFloat(photo.dataset.currentX) || 0;
    const currentY = parseFloat(photo.dataset.currentY) || 0;
    const currentRotation = parseFloat(photo.dataset.currentRotation) || 0;

    // Constrain to viewport at hover scale
    const constrained = constrainToViewport(photo, currentX, currentY, PG_CONFIG.hoverScale);

    const targetRotation = currentRotation * (1 - PG_CONFIG.hoverRotationReset);
    photo.dataset.hoverRotation = targetRotation;
    photo.dataset.hoverX = constrained.x;
    photo.dataset.hoverY = constrained.y;
    photo.dataset.state = 'hover';
    photo.classList.add('hovering');
    photo.style.setProperty('--tilt-speed', PG_CONFIG.tiltSpeed + 'ms');
    photo.style.zIndex = baseZIndex++;

    photo.style.transform = `translate(${constrained.x}px, ${constrained.y}px) rotate(${targetRotation}deg) scale(${PG_CONFIG.hoverScale}) rotateX(0deg) rotateY(0deg)`;
  }

  /**
   * Transition to clicked state (from hover)
   */
  function enterClickedState(photo) {
    if (photo.dataset.state !== 'hover') return;

    const currentX = parseFloat(photo.dataset.currentX) || 0;
    const currentY = parseFloat(photo.dataset.currentY) || 0;

    // Constrain to viewport at clicked scale
    const constrained = constrainToViewport(photo, currentX, currentY, PG_CONFIG.clickedScale);

    photo.dataset.state = 'clicked';
    photo.dataset.currentX = constrained.x;
    photo.dataset.currentY = constrained.y;
    photo.classList.add('clicked');
    photo.classList.remove('tilt-right', 'tilt-left', 'tilt-up', 'tilt-down');

    photo.style.transform = `translate(${constrained.x}px, ${constrained.y}px) rotate(0deg) scale(${PG_CONFIG.clickedScale}) rotateX(0deg) rotateY(0deg)`;
    photo.style.setProperty('--shine-intensity', 0.1);
  }

  /**
   * Return to normal state (from hover or clicked)
   */
  function enterNormalState(photo) {
    if (photo.dataset.state === 'normal') return;

    photo.classList.remove('hovering', 'clicked', 'tilt-right', 'tilt-left', 'tilt-up', 'tilt-down');
    photo.dataset.state = 'normal';

    const currentX = parseFloat(photo.dataset.currentX) || 0;
    const currentY = parseFloat(photo.dataset.currentY) || 0;
    const originX = parseFloat(photo.dataset.originX) || 0;
    const originY = parseFloat(photo.dataset.originY) || 0;

    // Drift to new position
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

  /**
   * Handle mouse move for 3D tilt effect (only in hover state)
   */
  function onPhotoMouseMove(photo, e) {
    // Only tilt in hover state
    if (photo.dataset.state !== 'hover') return;

    const rect = photo.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate mouse position relative to center (-1 to 1)
    const relX = (e.clientX - centerX) / (rect.width / 2);
    const relY = (e.clientY - centerY) / (rect.height / 2);

    // Tilt TOWARD mouse - edge nearest mouse lifts up
    const tiltStrength = PG_CONFIG.hoverTilt;
    const tiltX = relY * tiltStrength;
    const tiltY = -relX * tiltStrength;

    // Use the constrained hover position
    const hoverX = parseFloat(photo.dataset.hoverX);
    const hoverY = parseFloat(photo.dataset.hoverY);
    const hoverRotation = parseFloat(photo.dataset.hoverRotation);

    photo.style.transform = `translate(${hoverX}px, ${hoverY}px) rotate(${hoverRotation}deg) scale(${PG_CONFIG.hoverScale}) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;

    // Update which edges are visible based on tilt direction
    photo.classList.toggle('tilt-right', tiltY < -2);
    photo.classList.toggle('tilt-left', tiltY > 2);
    photo.classList.toggle('tilt-up', tiltX < -2);
    photo.classList.toggle('tilt-down', tiltX > 2);

    updateShine(photo, tiltX, tiltY);
  }

  /**
   * Start potential drag (mousedown in clicked state)
   */
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

    // Disable transition during drag for immediate response
    photo.style.transition = 'none';
  }

  /**
   * Handle drag move (document-level mousemove)
   */
  function onDocumentMouseMove(e) {
    if (!dragState.active) return;

    const photo = dragState.photo;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;

    // Check if we've moved enough to count as a drag
    if (!dragState.hasDragged) {
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > PG_CONFIG.dragThreshold) {
        dragState.hasDragged = true;
      } else {
        return;
      }
    }

    // Calculate new position and constrain to viewport
    const rawX = dragState.offsetX + dx;
    const rawY = dragState.offsetY + dy;
    const constrained = constrainToViewport(photo, rawX, rawY, PG_CONFIG.clickedScale);

    photo.dataset.dragX = constrained.x;
    photo.dataset.dragY = constrained.y;

    photo.style.transform = `translate(${constrained.x}px, ${constrained.y}px) rotate(0deg) scale(${PG_CONFIG.clickedScale}) rotateX(0deg) rotateY(0deg)`;
  }

  /**
   * End drag (document-level mouseup)
   */
  function onDocumentMouseUp(e) {
    if (!dragState.active) return;

    const photo = dragState.photo;
    const wasDrag = dragState.hasDragged;

    // Re-enable transition
    photo.style.transition = `transform ${PG_CONFIG.transitionSpeed}ms ease, box-shadow ${PG_CONFIG.transitionSpeed}ms ease`;

    // Update currentX/Y if we dragged
    if (wasDrag) {
      photo.dataset.currentX = photo.dataset.dragX || photo.dataset.currentX;
      photo.dataset.currentY = photo.dataset.dragY || photo.dataset.currentY;
    }

    // Reset drag state
    dragState = {
      active: false,
      photo: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
      hasDragged: false
    };

    // If it wasn't a drag, treat as click to dismiss
    if (!wasDrag && photo.dataset.state === 'clicked') {
      enterNormalState(photo);
    }
  }

  /**
   * Handle mouse leave - return to normal (only if not dragging)
   */
  function onPhotoMouseLeave(photo) {
    if (dragState.active && dragState.photo === photo) {
      // Don't dismiss while dragging - they might drag back
      return;
    }
    enterNormalState(photo);
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
    photo.dataset.state = 'normal';

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
    photo.addEventListener('mouseenter', () => enterHoverState(photo));
    photo.addEventListener('mouseleave', () => onPhotoMouseLeave(photo));
    photo.addEventListener('mousedown', (e) => {
      if (photo.dataset.state === 'hover') {
        // Click to enter clicked state
        enterClickedState(photo);
      } else if (photo.dataset.state === 'clicked') {
        // Start potential drag
        onPhotoMouseDown(photo, e);
      }
    });
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

    // Document-level drag handlers
    document.addEventListener('mousemove', onDocumentMouseMove);
    document.addEventListener('mouseup', onDocumentMouseUp);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
