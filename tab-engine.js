/**
 * Tab Engine
 * - Calculates page depths based on active page adjacency
 * - Applies transforms, z-index, and colors based on depth
 * - Handles hover animations for non-active tabs
 * - Sets uniform tab widths based on longest label
 */

(function() {
  const PAGE_ORDER = ['home', 'products', 'company', 'newsletter'];

  const CONFIG = {
    tabOffset: 127,
    depthOffsetX: 8,
    depthOffsetY: 9,
    cornerRadius: 6
  };

  const TAB_BASE = 40;

  const DEPTH_COLORS = [
    '#fff8d4', // depth 0 (front)
    '#f0e8c8', // depth 1
    '#e8dfc0', // depth 2
    '#d0c7a8', // depth 3
  ];

  function getDepthOffsets() {
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;
    const depthX = isMobile ? 2 : CONFIG.depthOffsetX;
    const depthY = isMobile ? CONFIG.depthOffsetY + 15 : CONFIG.depthOffsetY;
    return [
      { x: 0, y: 0 },
      { x: depthX, y: -depthY },
      { x: depthX * 2, y: -depthY * 2 },
      { x: depthX * 3, y: -depthY * 3 },
    ];
  }

  function getActivePage() {
    const path = window.location.pathname;
    for (const pageName of PAGE_ORDER) {
      if (path.includes(pageName)) {
        return pageName;
      }
    }
    return 'home';
  }

  function getPageIndex(pageName) {
    return PAGE_ORDER.indexOf(pageName);
  }

  function calculateDepths(activePage) {
    const activeIndex = getPageIndex(activePage);
    const pages = PAGE_ORDER.map((pageName, index) => ({
      page: pageName,
      index: index,
      distance: Math.abs(index - activeIndex)
    }));

    pages.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.index - b.index;
    });

    const depths = {};
    pages.forEach((p, depth) => {
      depths[p.page] = depth;
    });

    return depths;
  }

  function applyDepths(depths, activePage) {
    const pages = document.querySelectorAll('.te-page');
    const depthOffsets = getDepthOffsets();

    pages.forEach(pageEl => {
      const pageMatch = pageEl.className.match(/te-page-(\w+)/);
      if (!pageMatch) return;

      const pageName = pageMatch[1];
      const depth = depths[pageName];
      if (depth === undefined) return;

      pageEl.style.zIndex = 100 - depth;

      const offset = depthOffsets[depth] || depthOffsets[depthOffsets.length - 1];
      pageEl.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
      pageEl.style.borderRadius = CONFIG.cornerRadius + 'px';

      const color = DEPTH_COLORS[depth] || DEPTH_COLORS[DEPTH_COLORS.length - 1];
      pageEl.style.background = color;

      const tab = pageEl.querySelector('.te-tab');
      if (tab) {
        tab.style.setProperty('--te-tab-color', color);
        if (pageName === activePage) {
          tab.classList.add('te-active');
        } else {
          tab.classList.remove('te-active');
        }
      }
    });
  }

  function setupHoverAnimations(depths, activePage) {
    const pages = document.querySelectorAll('.te-page');
    const activeIndex = getPageIndex(activePage);

    pages.forEach(pageEl => {
      const pageMatch = pageEl.className.match(/te-page-(\w+)/);
      if (!pageMatch) return;

      const pageName = pageMatch[1];
      if (pageName === activePage) return;

      const depth = depths[pageName];
      const pageIndex = getPageIndex(pageName);
      const isLeftOfActive = pageIndex < activeIndex;

      // Set transform origin based on position relative to active page
      if (isLeftOfActive) {
        pageEl.style.transformOrigin = 'bottom left';
      } else {
        pageEl.style.transformOrigin = 'bottom right';
      }

      pageEl.addEventListener('mouseenter', () => {
        if (window.matchMedia(MOBILE_QUERY).matches) return;
        const depthOffsets = getDepthOffsets();
        const offset = depthOffsets[depth] || depthOffsets[depthOffsets.length - 1];
        const targetPx = 6;
        const angle = (targetPx / pageEl.offsetHeight) * (180 / Math.PI);
        if (isLeftOfActive) {
          pageEl.style.transform = `translate(${offset.x}px, ${offset.y - 3}px) rotate(-${angle}deg)`;
        } else {
          pageEl.style.transform = `translate(${offset.x}px, ${offset.y}px) rotate(${angle}deg)`;
        }
      });

      pageEl.addEventListener('mouseleave', () => {
        if (window.matchMedia(MOBILE_QUERY).matches) return;
        const depthOffsets = getDepthOffsets();
        const offset = depthOffsets[depth] || depthOffsets[depthOffsets.length - 1];
        pageEl.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
      });
    });
  }

  const MOBILE_QUERY = '(max-width: 768px)';

  function setTabDimensions() {
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;
    const tabs = document.querySelectorAll('.te-tab');

    // Tab dimensions (mobile is 120/160 = 0.75 scale)
    const width = isMobile ? 120 : 160;
    const height = isMobile ? 34 : 45;
    const top = isMobile ? -29 : -39;

    tabs.forEach(tab => {
      tab.style.width = width + 'px';
      tab.style.height = height + 'px';
      tab.style.top = top + 'px';
    });
  }

  function positionTabs() {
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;
    const tabOffset = isMobile ? 68 : CONFIG.tabOffset;
    const tabBase = isMobile ? 8 : TAB_BASE;
    const pages = document.querySelectorAll('.te-page');

    pages.forEach(pageEl => {
      const pageMatch = pageEl.className.match(/te-page-(\w+)/);
      if (!pageMatch) return;

      const pageName = pageMatch[1];
      const pageIndex = getPageIndex(pageName);
      const tab = pageEl.querySelector('.te-tab');

      if (tab && pageIndex !== -1) {
        const leftPos = tabBase + pageIndex * tabOffset;
        tab.style.left = leftPos + 'px';
      }
    });
  }

  function init() {
    const activePage = getActivePage();
    const depths = calculateDepths(activePage);

    applyDepths(depths, activePage);
    setupHoverAnimations(depths, activePage);
    setTabDimensions();
    positionTabs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-run tab setup when crossing breakpoint
  window.matchMedia(MOBILE_QUERY).addEventListener('change', () => {
    const activePage = getActivePage();
    const depths = calculateDepths(activePage);
    applyDepths(depths, activePage);
    setTabDimensions();
    positionTabs();
  });
})();
