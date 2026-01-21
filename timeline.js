// Timeline layout: position range articles based on single-month anchors
// with sequential stacking within gaps

function layoutTimeline() {
  const columns = document.querySelector('.timeline-columns');
  if (!columns) return;

  // Skip JS layout on mobile - CSS handles it
  if (window.innerWidth <= 768) {
    // Reset any inline styles
    columns.querySelectorAll('article').forEach(a => {
      a.style.position = '';
      a.style.top = '';
      a.style.marginBottom = '';
    });
    const leftCol = columns.querySelector('.col:first-child');
    if (leftCol) {
      leftCol.style.position = '';
      leftCol.style.minHeight = '';
    }
    return;
  }

  const leftCol = columns.querySelector('.col:first-child');
  const rightCol = columns.querySelector('.col:last-child');
  if (!leftCol || !rightCol) return;

  const rightArticles = Array.from(rightCol.querySelectorAll('article'));
  const leftArticles = Array.from(leftCol.querySelectorAll('article'));

  const MARGIN = 16; // matches CSS 1rem margin-bottom

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

  // Group range articles by which gap they fall into
  // and calculate space needed for each gap
  const gaps = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const upperAnchor = anchors[i];     // newer, higher on page
    const lowerAnchor = anchors[i + 1]; // older, lower on page

    const articlesInGap = leftData.filter(d =>
      d.midValue <= upperAnchor.value && d.midValue >= lowerAnchor.value
    );

    gaps.push({
      upperAnchor,
      lowerAnchor,
      articles: articlesInGap,
      totalHeight: articlesInGap.reduce((sum, d) => sum + d.height + MARGIN, 0)
    });
  }

  // Also handle articles newer than newest anchor or older than oldest anchor
  const newestAnchor = anchors[0];
  const oldestAnchor = anchors[anchors.length - 1];

  const articlesBeforeFirst = leftData.filter(d => d.midValue > newestAnchor.value);
  const articlesAfterLast = leftData.filter(d => d.midValue < oldestAnchor.value);

  // Add margin to right column articles to make room for range articles
  gaps.forEach(gap => {
    if (gap.articles.length === 0) return;

    const currentSpace = gap.lowerAnchor.y - gap.upperAnchor.bottom;

    if (gap.totalHeight > currentSpace) {
      const extraNeeded = gap.totalHeight - currentSpace;
      const article = rightArticles[gap.upperAnchor.index];
      const currentMargin = parseFloat(article.style.marginBottom) || 0;
      article.style.marginBottom = (currentMargin + extraNeeded) + 'px';
    }
  });

  // Rebuild anchors after margin adjustments
  anchors = buildAnchors();

  // Rebuild gaps with new positions
  for (let i = 0; i < gaps.length; i++) {
    gaps[i].upperAnchor = anchors[i];
    gaps[i].lowerAnchor = anchors[i + 1];
  }

  // Position left column articles
  leftCol.style.position = 'relative';

  // Set absolute positioning first
  leftData.forEach(data => {
    data.article.style.position = 'absolute';
    data.article.style.left = '0';
    data.article.style.right = '0';
  });

  // Re-measure heights after positioning
  leftData.forEach(data => {
    data.height = data.article.offsetHeight;
  });

  // Position articles sequentially within each gap
  // Articles before the first anchor
  let currentY = 0;
  articlesBeforeFirst.forEach(data => {
    data.article.style.top = currentY + 'px';
    currentY += data.height + MARGIN;
  });

  // Articles within gaps - stack sequentially starting at upper anchor bottom
  gaps.forEach(gap => {
    if (gap.articles.length === 0) return;

    currentY = gap.upperAnchor.bottom;

    gap.articles.forEach(data => {
      data.article.style.top = currentY + 'px';
      currentY += data.height + MARGIN;
    });
  });

  // Articles after the last anchor
  if (articlesAfterLast.length > 0) {
    currentY = anchors[anchors.length - 1].bottom;
    articlesAfterLast.forEach(data => {
      data.article.style.top = currentY + 'px';
      currentY += data.height + MARGIN;
    });
  }

  // Set left column height
  const lastLeftArticle = leftData[leftData.length - 1];
  const leftBottom = lastLeftArticle ?
    parseFloat(lastLeftArticle.article.style.top) + lastLeftArticle.height : 0;
  leftCol.style.minHeight = Math.max(leftBottom, rightCol.offsetHeight) + 'px';
}

// Wait for images in timeline to load before layout
function waitForTimelineImages(callback) {
  const columns = document.querySelector('.timeline-columns');
  if (!columns) {
    callback();
    return;
  }

  const images = columns.querySelectorAll('img');
  if (images.length === 0) {
    callback();
    return;
  }

  let loadedCount = 0;
  const totalImages = images.length;

  function checkComplete() {
    loadedCount++;
    if (loadedCount >= totalImages) {
      callback();
    }
  }

  images.forEach(img => {
    if (img.complete) {
      checkComplete();
    } else {
      img.addEventListener('load', checkComplete);
      img.addEventListener('error', checkComplete); // Handle failed loads too
    }
  });
}

// Run on load and resize
document.addEventListener('DOMContentLoaded', () => {
  waitForTimelineImages(layoutTimeline);
});
window.addEventListener('resize', layoutTimeline);
