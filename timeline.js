// Timeline layout: position range articles based on single-month anchors
// with content-based spacing adjustment

function layoutTimeline() {
  const columns = document.querySelector('.timeline-columns');
  if (!columns) return;

  const leftCol = columns.querySelector('.col:first-child');
  const rightCol = columns.querySelector('.col:last-child');
  if (!leftCol || !rightCol) return;

  const rightArticles = Array.from(rightCol.querySelectorAll('article'));
  const leftArticles = Array.from(leftCol.querySelectorAll('article'));

  const GAP = 0; // no additional JS spacing - rely on CSS margins

  // Reset any previous inline styles
  rightArticles.forEach(a => a.style.marginBottom = '');
  leftArticles.forEach(a => {
    a.style.position = '';
    a.style.top = '';
  });
  leftCol.style.position = '';
  leftCol.style.minHeight = '';

  // Parse date string like "2025 December" into { year, month, value }
  function parseDate(str) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const parts = str.trim().split(' ');
    const year = parseInt(parts[0]);
    const month = months.indexOf(parts[1]);
    return { year, month, value: year * 12 + month };
  }

  // Parse range like "2025 November–December" or "2024 April–June"
  function parseRange(str) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

    const parts = str.replace('–', '-').split('-');
    if (parts.length !== 2) return null;

    const startPart = parts[0].trim();
    const endPart = parts[1].trim();

    const startPieces = startPart.split(' ');
    const year = parseInt(startPieces[0]);
    const startMonth = months.indexOf(startPieces[1]);
    const endMonth = months.indexOf(endPart);
    const endYear = endMonth < startMonth ? year + 1 : year;

    return {
      start: { year, month: startMonth, value: year * 12 + startMonth },
      end: { year: endYear, month: endMonth, value: endYear * 12 + endMonth }
    };
  }

  // Build anchor data from right column
  function buildAnchors() {
    const anchors = [];
    const colRect = rightCol.getBoundingClientRect();

    rightArticles.forEach((article, index) => {
      const time = article.querySelector('time');
      if (!time) return;
      const date = parseDate(time.textContent);
      const rect = article.getBoundingClientRect();
      anchors.push({
        value: date.value,
        y: rect.top - colRect.top,
        bottom: rect.bottom - colRect.top,
        index: index,
        article: article
      });
    });

    // Sort by date value descending (newest first)
    anchors.sort((a, b) => b.value - a.value);
    return anchors;
  }

  // Prepare left article data with heights
  const leftData = leftArticles.map(article => {
    const time = article.querySelector('time');
    const range = time ? parseRange(time.textContent) : null;
    return {
      article,
      range,
      midValue: range ? (range.start.value + range.end.value) / 2 : 0,
      height: article.offsetHeight
    };
  }).filter(d => d.range !== null);

  // Sort left articles by date (newest first)
  leftData.sort((a, b) => b.midValue - a.midValue);

  // Get initial anchors
  let anchors = buildAnchors();

  // For each gap between anchors, calculate how much space the content needs
  // and add margin to expand gaps that are too small
  for (let i = 0; i < anchors.length - 1; i++) {
    const upperAnchor = anchors[i];     // newer, higher on page (lower Y)
    const lowerAnchor = anchors[i + 1]; // older, lower on page (higher Y)

    // Find all left articles whose midValue falls in this gap
    const articlesInGap = leftData.filter(d =>
      d.midValue <= upperAnchor.value && d.midValue >= lowerAnchor.value
    );

    if (articlesInGap.length === 0) continue;

    // Calculate total height needed for these articles (just heights, CSS handles margins)
    const totalHeightNeeded = articlesInGap.reduce((sum, d) => sum + d.height, 0);

    // Current available space in this gap
    // Use the bottom of upper anchor's article to top of lower anchor's article
    const currentSpace = lowerAnchor.y - upperAnchor.bottom;

    // If we need more space, add margin to the upper anchor's article
    if (totalHeightNeeded > currentSpace) {
      const extraNeeded = totalHeightNeeded - currentSpace;
      const article = rightArticles[upperAnchor.index];
      const currentMargin = parseFloat(article.style.marginBottom) || 0;
      article.style.marginBottom = (currentMargin + extraNeeded) + 'px';
    }
  }

  // Rebuild anchors after margin adjustments
  anchors = buildAnchors();

  // Interpolate Y position for any date value
  function getYForValue(value) {
    if (anchors.length === 0) return 0;
    if (anchors.length === 1) return anchors[0].y;

    // Newer than all anchors - extrapolate
    if (value > anchors[0].value) {
      const rate = (anchors[0].y - anchors[1].y) / (anchors[0].value - anchors[1].value);
      return anchors[0].y + rate * (value - anchors[0].value);
    }

    // Older than all anchors - extrapolate
    if (value < anchors[anchors.length - 1].value) {
      const n = anchors.length;
      const rate = (anchors[n - 2].y - anchors[n - 1].y) / (anchors[n - 2].value - anchors[n - 1].value);
      return anchors[n - 1].y + rate * (value - anchors[n - 1].value);
    }

    // Interpolate between anchors
    for (let i = 0; i < anchors.length - 1; i++) {
      if (value <= anchors[i].value && value >= anchors[i + 1].value) {
        const t = (value - anchors[i + 1].value) / (anchors[i].value - anchors[i + 1].value);
        return anchors[i + 1].y + t * (anchors[i].y - anchors[i + 1].y);
      }
    }

    return 0;
  }

  // Position left column articles
  leftCol.style.position = 'relative';

  // Set absolute positioning and measure true heights
  leftData.forEach(data => {
    data.article.style.position = 'absolute';
    data.article.style.left = '0';
    data.article.style.right = '0';
    data.article.style.top = '0';
  });

  // Re-measure heights after positioning
  leftData.forEach(data => {
    data.height = data.article.offsetHeight;
  });

  // Final positioning with collision detection
  let prevBottom = 0;

  leftData.forEach(data => {
    const idealY = getYForValue(data.midValue);
    const actualY = Math.max(idealY, prevBottom);

    data.article.style.top = actualY + 'px';
    prevBottom = actualY + data.height + GAP;
  });

  // Set left column height
  leftCol.style.minHeight = Math.max(prevBottom, rightCol.offsetHeight) + 'px';
}

// Run on load and resize
document.addEventListener('DOMContentLoaded', layoutTimeline);
window.addEventListener('resize', layoutTimeline);
