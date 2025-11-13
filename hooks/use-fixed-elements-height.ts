"use client";

import { useEffect, useState } from "react";

/**
 * Hook to calculate the total height of fixed elements at the top
 * (mobile/desktop header + banner if visible + page header if exists)
 * and update CSS variable automatically
 */
export function useFixedElementsHeight() {
  const [totalHeight, setTotalHeight] = useState(0);

  useEffect(() => {
    const calculateHeight = () => {
      let height = 0;
      const isMobile = window.innerWidth < 1024; // lg breakpoint

      if (isMobile) {
        // On mobile: MobileHeader (top) -> PageHeader -> MobileBanner (bottom)
        const mobileHeader = document.getElementById('mobile-header');
        let mobileHeaderHeight = 0;
        if (mobileHeader) {
          const computedStyle = window.getComputedStyle(mobileHeader);
          if (computedStyle.display !== 'none') {
            mobileHeaderHeight = mobileHeader.offsetHeight;
            height += mobileHeaderHeight;
          }
        }
        
        // Update mobile header height for PageHeader positioning
        document.documentElement.style.setProperty('--mobile-header-height', `${mobileHeaderHeight}px`);
        
        // Get PageHeader height (appears after MobileHeader)
        const pageHeader = document.getElementById('page-header');
        let pageHeaderHeight = 0;
        if (pageHeader) {
          const computedStyle = window.getComputedStyle(pageHeader);
          if (computedStyle.display !== 'none') {
            pageHeaderHeight = pageHeader.offsetHeight;
            if (pageHeaderHeight > 0) {
              height += pageHeaderHeight;
            }
          }
        }
        
        // Update page header height for MobileBanner positioning
        document.documentElement.style.setProperty('--page-header-height', `${pageHeaderHeight}px`);
        
        // Add mobile banner height (appears after PageHeader)
        const mobileBanner = document.getElementById('mobile-banner');
        if (mobileBanner) {
          const computedStyle = window.getComputedStyle(mobileBanner);
          if (computedStyle.display !== 'none') {
            height += mobileBanner.offsetHeight;
          }
        }
      } else {
        // On desktop: PageHeader (top) -> DesktopHeader with banner (bottom)
        // Get PageHeader height first
        const pageHeader = document.getElementById('page-header');
        let pageHeaderHeight = 0;
        if (pageHeader) {
          const computedStyle = window.getComputedStyle(pageHeader);
          if (computedStyle.display !== 'none') {
            pageHeaderHeight = pageHeader.offsetHeight;
            if (pageHeaderHeight > 0) {
              height += pageHeaderHeight;
            }
          }
        }
        
        // Update page header height for DesktopHeader positioning
        document.documentElement.style.setProperty('--page-header-height', `${pageHeaderHeight}px`);
        
        // DesktopHeader (includes banner) - appears after PageHeader
        const desktopHeader = document.getElementById('desktop-header');
        if (desktopHeader) {
          const computedStyle = window.getComputedStyle(desktopHeader);
          if (computedStyle.display !== 'none') {
            height += desktopHeader.offsetHeight;
          }
        }
      }

      setTotalHeight(height);
      
      // Update CSS variable for use in padding-top
      document.documentElement.style.setProperty('--fixed-elements-height', `${height}px`);
      
      // Also update desktop header height (mobile header height is already updated above)
      if (!isMobile) {
        const desktopHeader = document.getElementById('desktop-header');
        if (desktopHeader) {
          const desktopHeaderHeight = desktopHeader.offsetHeight;
          document.documentElement.style.setProperty('--desktop-header-height', `${desktopHeaderHeight}px`);
        }
      }
      
      // Debug log (can be removed later)
      console.log('[useFixedElementsHeight] Calculated height:', height, {
        isMobile,
        mobileHeaderHeight: document.getElementById('mobile-header')?.offsetHeight || 0,
        desktopHeaderHeight: document.getElementById('desktop-header')?.offsetHeight || 0,
        pageHeaderHeight: document.getElementById('page-header')?.offsetHeight || 0,
      });
    };

    // Initial calculation with multiple delays to ensure DOM is ready
    const initialTimeouts = [
      setTimeout(calculateHeight, 0),
      setTimeout(calculateHeight, 100),
      setTimeout(calculateHeight, 300),
      setTimeout(calculateHeight, 500),
      setTimeout(calculateHeight, 1000),
    ];
    
    // Also set up periodic recalculation to catch late-appearing elements
    const intervalId = setInterval(calculateHeight, 2000);

    // Use ResizeObserver to watch for changes in headers and banner
    const observers: ResizeObserver[] = [];

    // Observe mobile header
    const mobileHeader = document.getElementById('mobile-header');
    if (mobileHeader) {
      const observer = new ResizeObserver(() => {
        setTimeout(calculateHeight, 10);
      });
      observer.observe(mobileHeader);
      observers.push(observer);
    }
    
    // Observe mobile banner
    const mobileBanner = document.getElementById('mobile-banner');
    if (mobileBanner) {
      const observer = new ResizeObserver(() => {
        setTimeout(calculateHeight, 10);
      });
      observer.observe(mobileBanner);
      observers.push(observer);
    }

    // Observe desktop header (includes banner)
    const desktopHeader = document.getElementById('desktop-header');
    if (desktopHeader) {
      const observer = new ResizeObserver(() => {
        setTimeout(calculateHeight, 10);
      });
      observer.observe(desktopHeader);
      observers.push(observer);
    }

    // Track which elements we're observing to avoid duplicates
    const observedElements = new Set<HTMLElement>();
    
    // Function to observe banner (will be called initially and when banner appears)
    const observeBanner = () => {
      const banner = document.getElementById('upgrade-banner');
      if (banner && !observedElements.has(banner)) {
        const observer = new ResizeObserver(() => {
          setTimeout(calculateHeight, 10);
        });
        observer.observe(banner);
        observers.push(observer);
        observedElements.add(banner);
      }
    };
    
    // Observe banner directly (works for both mobile and desktop)
    observeBanner();
    
    // Also try to observe banner after delays in case it's added later
    setTimeout(observeBanner, 100);
    setTimeout(observeBanner, 500);
    setTimeout(observeBanner, 1000);

    // Observe page header if it exists
    const pageHeader = document.getElementById('page-header');
    if (pageHeader) {
      const observer = new ResizeObserver(() => {
        setTimeout(calculateHeight, 10);
      });
      observer.observe(pageHeader);
      observers.push(observer);
    }

    // Listen to window resize
    window.addEventListener('resize', calculateHeight);
    
    // Listen for custom event when banner appears/disappears
    const handleBannerChange = () => {
      setTimeout(calculateHeight, 50);
    };
    window.addEventListener('banner-visibility-changed', handleBannerChange);

    // Use MutationObserver to watch for elements being added/removed
    const mutationObserver = new MutationObserver((mutations) => {
      // Check if banner was added/removed or visibility changed
      let shouldRecalculate = false;
      
      mutations.forEach((mutation) => {
        // Check for added/removed nodes
        if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
          shouldRecalculate = true;
        }
        
        // Check for attribute changes (like display, visibility)
        if (mutation.type === 'attributes') {
          const target = mutation.target as HTMLElement;
          if (target.id === 'upgrade-banner' || target.id === 'page-header' || 
              target.id === 'mobile-header' || target.id === 'mobile-banner' || 
              target.id === 'desktop-header') {
            shouldRecalculate = true;
          }
        }
      });
      
      if (shouldRecalculate) {
        // Recalculate after a short delay to ensure DOM is updated
        setTimeout(calculateHeight, 50);
        
        // Also set up observers for newly added elements
        setTimeout(() => {
          observeBanner();
        }, 100);
      }
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'id'],
    });

    return () => {
      initialTimeouts.forEach(timeout => clearTimeout(timeout));
      clearInterval(intervalId);
      observers.forEach(observer => observer.disconnect());
      mutationObserver.disconnect();
      window.removeEventListener('resize', calculateHeight);
      window.removeEventListener('banner-visibility-changed', handleBannerChange);
    };
  }, []);

  return totalHeight;
}

