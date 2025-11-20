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
        // On mobile: MobileHeader (top) -> PageHeader
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
        
        // Update page header height
        document.documentElement.style.setProperty('--page-header-height', `${pageHeaderHeight}px`);
      } else {
        // On desktop: PageHeader (top)
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
        
        // Update page header height
        document.documentElement.style.setProperty('--page-header-height', `${pageHeaderHeight}px`);
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
      
      
      // Calculate fixed tabs height if present
      const fixedTabs = document.querySelector('[data-fixed-tabs]');
      if (fixedTabs) {
        const tabsHeight = fixedTabs.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--fixed-tabs-height', `${tabsHeight}px`);
        // Update total fixed height to include tabs
        const totalFixedHeight = height + tabsHeight;
        document.documentElement.style.setProperty('--total-fixed-height', `${totalFixedHeight}px`);
      } else {
        document.documentElement.style.setProperty('--fixed-tabs-height', '0px');
        document.documentElement.style.setProperty('--total-fixed-height', `${height}px`);
      }
      
      // Calculate bottom nav height for mobile
      if (isMobile) {
        const bottomNav = document.querySelector('nav[class*="fixed bottom-0"]');
        if (bottomNav) {
          const computedStyle = window.getComputedStyle(bottomNav);
          if (computedStyle.display !== 'none') {
            const bottomNavHeight = bottomNav.getBoundingClientRect().height;
            document.documentElement.style.setProperty('--bottom-nav-height', `${bottomNavHeight}px`);
          } else {
            document.documentElement.style.setProperty('--bottom-nav-height', '0px');
          }
        } else {
          document.documentElement.style.setProperty('--bottom-nav-height', '0px');
        }
      } else {
        document.documentElement.style.setProperty('--bottom-nav-height', '0px');
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

    // Observe fixed tabs if present
    const fixedTabs = document.querySelector('[data-fixed-tabs]');
    if (fixedTabs) {
      const observer = new ResizeObserver(debouncedCalculateHeight);
      observer.observe(fixedTabs);
      observers.push(observer);
    }

    // Observe bottom nav (mobile only)
    const bottomNav = document.querySelector('nav[class*="fixed bottom-0"]');
    if (bottomNav) {
      const observer = new ResizeObserver(debouncedCalculateHeight);
      observer.observe(bottomNav);
      observers.push(observer);
    }


    // Observe page header if it exists
    const pageHeader = document.getElementById('page-header');
    if (pageHeader) {
      const observer = new ResizeObserver(debouncedCalculateHeight);
      observer.observe(pageHeader);
      observers.push(observer);
    }

    // Listen to window resize with debounce
    window.addEventListener('resize', debouncedCalculateHeight);

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
            if (element.id === 'page-header' || 
                element.id === 'mobile-header' ||
                element.querySelector('#page-header, #mobile-header')) {
              shouldRecalculate = true;
            }
          }
        });
        
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            if (element.id === 'page-header' || 
                element.id === 'mobile-header') {
              shouldRecalculate = true;
            }
          }
        });
        
        // Check for attribute changes (like display, visibility) only on our target elements
        if (mutation.type === 'attributes') {
          const target = mutation.target as HTMLElement;
          if (target.id === 'page-header' || 
              target.id === 'mobile-header') {
            shouldRecalculate = true;
          }
        }
      });
      
      if (shouldRecalculate) {
        debouncedCalculateHeight();
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
    };
  }, []);

  return totalHeight;
}

