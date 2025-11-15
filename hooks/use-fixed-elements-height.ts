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

      // Only update if height actually changed to avoid unnecessary re-renders
      setTotalHeight(prevHeight => {
        if (prevHeight === height) {
          return prevHeight; // No change, return same value to prevent re-render
        }
        return height;
      });
      
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
    };

    // Debounce function to prevent excessive recalculations
    let debounceTimer: NodeJS.Timeout | null = null;
    const debouncedCalculateHeight = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(calculateHeight, 50);
    };

    // Initial calculation with reduced delays
    const initialTimeouts = [
      setTimeout(calculateHeight, 0),
      setTimeout(calculateHeight, 100),
      setTimeout(calculateHeight, 300),
    ];

    // Use ResizeObserver to watch for changes in headers and banner
    const observers: ResizeObserver[] = [];

    // Observe mobile header
    const mobileHeader = document.getElementById('mobile-header');
    if (mobileHeader) {
      const observer = new ResizeObserver(debouncedCalculateHeight);
      observer.observe(mobileHeader);
      observers.push(observer);
    }
    
    // Observe mobile banner
    const mobileBanner = document.getElementById('mobile-banner');
    if (mobileBanner) {
      const observer = new ResizeObserver(debouncedCalculateHeight);
      observer.observe(mobileBanner);
      observers.push(observer);
    }

    // Observe desktop header (includes banner)
    const desktopHeader = document.getElementById('desktop-header');
    if (desktopHeader) {
      const observer = new ResizeObserver(debouncedCalculateHeight);
      observer.observe(desktopHeader);
      observers.push(observer);
    }

    // Track which elements we're observing to avoid duplicates
    const observedElements = new Set<HTMLElement>();
    
    // Function to observe banner (will be called initially and when banner appears)
    const observeBanner = () => {
      const banner = document.getElementById('upgrade-banner');
      if (banner && !observedElements.has(banner)) {
        const observer = new ResizeObserver(debouncedCalculateHeight);
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

    // Observe page header if it exists
    const pageHeader = document.getElementById('page-header');
    if (pageHeader) {
      const observer = new ResizeObserver(debouncedCalculateHeight);
      observer.observe(pageHeader);
      observers.push(observer);
    }

    // Listen to window resize with debounce
    window.addEventListener('resize', debouncedCalculateHeight);
    
    // Listen for custom event when banner appears/disappears
    const handleBannerChange = debouncedCalculateHeight;
    window.addEventListener('banner-visibility-changed', handleBannerChange);

    // Use MutationObserver to watch for elements being added/removed
    // Only observe specific elements to reduce noise from React re-renders
    const mutationObserver = new MutationObserver((mutations) => {
      // Check if banner was added/removed or visibility changed
      let shouldRecalculate = false;
      
      mutations.forEach((mutation) => {
        // Only check for added/removed nodes that are our target elements
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            if (element.id === 'upgrade-banner' || element.id === 'page-header' || 
                element.id === 'mobile-header' || element.id === 'mobile-banner' || 
                element.id === 'desktop-header' ||
                element.querySelector('#upgrade-banner, #page-header, #mobile-header, #mobile-banner, #desktop-header')) {
              shouldRecalculate = true;
            }
          }
        });
        
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            if (element.id === 'upgrade-banner' || element.id === 'page-header' || 
                element.id === 'mobile-header' || element.id === 'mobile-banner' || 
                element.id === 'desktop-header') {
              shouldRecalculate = true;
            }
          }
        });
        
        // Check for attribute changes (like display, visibility) only on our target elements
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
        debouncedCalculateHeight();
        
        // Also set up observers for newly added elements
        setTimeout(() => {
          observeBanner();
        }, 100);
      }
    });
    
    // Only observe the body element, not the entire subtree, to reduce noise
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: false, // Changed to false to reduce React re-render noise
      attributes: true,
      attributeFilter: ['class', 'style', 'id'],
    });

    return () => {
      initialTimeouts.forEach(timeout => clearTimeout(timeout));
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      observers.forEach(observer => observer.disconnect());
      mutationObserver.disconnect();
      window.removeEventListener('resize', debouncedCalculateHeight);
      window.removeEventListener('banner-visibility-changed', handleBannerChange);
    };
  }, []);

  return totalHeight;
}

