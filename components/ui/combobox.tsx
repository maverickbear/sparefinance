"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, Check, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxItem {
  id: string;
  name: string;
  [key: string]: any;
}

export interface ComboboxGroup {
  id: string;
  name: string;
  items: ComboboxItem[];
}

export interface ComboboxProps {
  items?: ComboboxItem[];
  groups?: ComboboxGroup[];
  value?: string | null;
  onChange?: (value: string | null, item: ComboboxItem | null) => void;
  onSearchChange?: (searchTerm: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  noResultsMessage?: string;
  allowCustomValue?: boolean;
  size?: "tiny" | "small" | "medium" | "large";
  className?: string;
  disabled?: boolean;
  showClearButton?: boolean;
  renderItem?: (item: ComboboxItem) => React.ReactNode;
  renderGroupHeader?: (group: ComboboxGroup) => React.ReactNode;
  onCreateNew?: () => void;
  createNewLabel?: string;
}

const sizeClasses = {
  tiny: {
    button: "px-2.5 py-1.5 text-xs",
    input: "px-2.5 py-1.5 text-xs",
    item: "px-2.5 py-1.5 text-xs",
    icon: "w-3.5 h-3.5",
  },
  small: {
    button: "px-3 py-1.5 text-sm",
    input: "px-3 py-1.5 text-sm",
    item: "px-3 py-2 text-sm",
    icon: "w-4 h-4",
  },
  medium: {
    button: "px-4 py-2.5 text-sm",
    input: "px-4 py-2 text-sm",
    item: "px-4 py-2.5 text-sm",
    icon: "w-4 h-4",
  },
  large: {
    button: "px-4 py-3 text-base",
    input: "px-4 py-2.5 text-base",
    item: "px-4 py-3 text-base",
    icon: "w-5 h-5",
  },
};

export function Combobox({
  items = [],
  groups,
  value,
  onChange,
  onSearchChange,
  placeholder = "Select or type...",
  searchPlaceholder = "Search or type...",
  emptyMessage = "No items found.",
  noResultsMessage = "No matches found.",
  allowCustomValue = true,
  size = "medium",
  className,
  disabled = false,
  showClearButton = true,
  renderItem,
  renderGroupHeader,
  onCreateNew,
  createNewLabel = "Create New",
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const comboboxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const sizeConfig = sizeClasses[size];

  // Get selected item
  const selectedItem = React.useMemo(() => {
    if (!value) return null;
    
    // Search in items
    if (items.length > 0) {
      return items.find((item) => item.id === value) || null;
    }
    
    // Search in groups
    if (groups) {
      for (const group of groups) {
        const item = group.items.find((item) => item.id === value);
        if (item) return item;
      }
    }
    
    return null;
  }, [value, items, groups]);

  // Filter items/groups based on search term
  const filteredData = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return { items, groups };
    }

    const searchLower = searchTerm.toLowerCase();

    if (groups) {
      const filteredGroups: ComboboxGroup[] = groups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) =>
              item.name.toLowerCase().includes(searchLower) ||
              group.name.toLowerCase().includes(searchLower)
          ),
        }))
        .filter((group) => group.items.length > 0);

      return { items: [], groups: filteredGroups };
    }

    const filteredItems = items.filter((item) =>
      item.name.toLowerCase().includes(searchLower)
    );

    return { items: filteredItems, groups: undefined };
  }, [searchTerm, items, groups]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isClickInCombobox = comboboxRef.current?.contains(target);
      const isClickInMenu = menuRef.current?.contains(target);
      
      // Only close if click is outside both combobox and menu
      if (!isClickInCombobox && !isClickInMenu) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      // Use bubbling phase so stopPropagation works correctly
      document.addEventListener("mousedown", handleClickOutside);
      
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Calculate menu position when opening
  useEffect(() => {
    if (isOpen && comboboxRef.current) {
      const updatePosition = () => {
        const rect = comboboxRef.current?.getBoundingClientRect();
        if (rect) {
          // getBoundingClientRect returns viewport coordinates
          // Since we use position: fixed, we use viewport coordinates directly
          setMenuPosition({
            top: rect.bottom + 8, // 8px = mt-2
            left: rect.left,
            width: rect.width,
          });
        }
      };

      updatePosition();
      // Use capture phase to catch scroll events in nested containers (like dialog)
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);

      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    } else {
      setMenuPosition(null);
    }
  }, [isOpen]);

  // Sync search term with selected value
  useEffect(() => {
    if (selectedItem) {
      setSearchTerm(selectedItem.name);
    } else if (value && !selectedItem) {
      setSearchTerm(value);
    } else if (!value && !selectedItem) {
      setSearchTerm("");
    }
  }, [selectedItem, value]);

  const handleSelect = (item: ComboboxItem) => {
    onChange?.(item.id, item);
    setSearchTerm(item.name);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onChange?.(null, null);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    onSearchChange?.(newSearchTerm);
    setIsOpen(true);

    // If allowing custom values, update the value as user types
    if (allowCustomValue) {
      // Check if it matches an existing item
      const matchesItem = items.some(
        (item) => item.name.toLowerCase() === newSearchTerm.toLowerCase()
      );
      
      if (groups) {
        const matchesGroupItem = groups.some((group) =>
          group.items.some(
            (item) => item.name.toLowerCase() === newSearchTerm.toLowerCase()
          )
        );
        if (!matchesGroupItem && newSearchTerm) {
          onChange?.(newSearchTerm, null);
        }
      } else if (!matchesItem && newSearchTerm) {
        onChange?.(newSearchTerm, null);
      }
    }
  };

  const handleInputFocus = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Don't close if clicking into the menu
    if (menuRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    // Close after a delay to allow click events to fire
    setTimeout(() => {
      if (document.activeElement !== inputRef.current && !menuRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
      }
    }, 300);
  };

  return (
    <div className={cn("relative", className)} ref={comboboxRef}>
      {/* Search Input */}
      <div className="relative">
        <Search
        className={cn(
            "absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10 pointer-events-none",
            sizeConfig.icon
          )}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsOpen(false);
              inputRef.current?.blur();
            } else if (e.key === "Enter" && allowCustomValue && searchTerm.trim()) {
              // Allow pressing Enter to confirm custom value
              onChange?.(searchTerm, null);
              setIsOpen(false);
            }
          }}
          disabled={disabled}
          className={cn(
            "w-full border border-input rounded-lg bg-background",
            "hover:border-ring active:border-ring focus:outline-none",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            // Padding left: icon position (left-3 = 12px) + icon width + gap (8px)
            // tiny: icon w-3.5 (14px) = 12 + 14 + 8 = 34px (pl-[34px])
            // small/medium: icon w-4 (16px) = 12 + 16 + 8 = 36px (pl-9)
            // large: icon w-5 (20px) = 12 + 20 + 8 = 40px (pl-10)
            size === "tiny" ? "pl-[34px]" : size === "small" || size === "medium" ? "pl-9" : "pl-10",
            // Padding right: space for clear button and chevron
            size === "tiny" ? "pr-[34px]" : size === "small" || size === "medium" ? "pr-10" : "pr-12",
            // Use only vertical padding and text size from sizeConfig
            size === "tiny" ? "py-1.5 text-xs" : size === "small" ? "py-1.5 text-sm" : size === "medium" ? "py-2.5 text-sm" : "py-3 text-base"
          )}
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2 flex-shrink-0">
          {showClearButton && searchTerm && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
                inputRef.current?.focus();
              }}
              className="p-1 hover:bg-muted rounded transition-colors cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClear();
                  inputRef.current?.focus();
                }
              }}
            >
              <X className={cn("text-muted-foreground", sizeConfig.icon)} />
            </div>
          )}
          <ChevronDown
            className={cn(
              "text-muted-foreground transition-transform",
              sizeConfig.icon,
              isOpen && "rotate-180"
                )}
              />
            </div>
          </div>

      {/* Dropdown Menu - Rendered via Portal to escape dialog overflow */}
      {isOpen && !disabled && menuPosition && typeof window !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] bg-popover border border-input rounded-lg shadow-xl overflow-hidden"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            width: `${menuPosition.width}px`,
            maxHeight: '16rem',
          }}
          onMouseDown={(e) => {
            // Prevent mousedown events from triggering outside click detection
            e.stopPropagation();
          }}
        >
          {/* Items List */}
          <div 
            className="overflow-y-auto overflow-x-hidden"
            style={{ 
              maxHeight: '16rem',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgb(156 163 175) transparent',
            }}
          >
            {(() => {
              const hasGroups = filteredData.groups && filteredData.groups.length > 0;
              const hasItems = filteredData.items && filteredData.items.length > 0;
              const hasResults = hasGroups || hasItems;

              if (!hasResults && !searchTerm.trim()) {
                return (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </div>
                );
              }

              if (!hasResults && searchTerm.trim()) {
                return (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {noResultsMessage}
                    {allowCustomValue && searchTerm && (
                      <div className="mt-2 text-xs">
                        Press Enter to use "{searchTerm}"
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div>
                  {/* Render Groups */}
                  {hasGroups &&
                    filteredData.groups!.map((group) => (
                      <div key={group.id}>
                        {renderGroupHeader ? (
                          renderGroupHeader(group)
                        ) : (
                          <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted/30">
                            {group.name}
                          </div>
                        )}
                        {group.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSelect(item);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between text-left hover:bg-muted transition-colors",
                              sizeConfig.item,
                              value === item.id && "bg-accent"
                            )}
                          >
                            {renderItem ? (
                              renderItem(item)
                            ) : (
                              <span className="font-medium text-foreground">
                                {item.name}
                              </span>
                            )}
                            {value === item.id && (
                              <Check
                                className={cn(
                                  "text-primary flex-shrink-0 ml-2",
                                  sizeConfig.icon
                                )}
                              />
                            )}
                          </button>
                        ))}
                      </div>
                    ))}

                  {/* Render Items (no groups) */}
                  {!hasGroups &&
                    hasItems &&
                    filteredData.items!.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelect(item);
                        }}
                        onMouseDown={(e) => {
                          // Prevent blur event from firing before click
                          e.preventDefault();
                        }}
                        className={cn(
                          "w-full flex items-center justify-between text-left hover:bg-muted transition-colors",
                          sizeConfig.item,
                          value === item.id && "bg-accent"
                        )}
                      >
                        {renderItem ? (
                          renderItem(item)
                        ) : (
                          <span className="font-medium text-foreground">
                            {item.name}
                          </span>
                        )}
                        {value === item.id && (
                          <Check
                            className={cn(
                              "text-primary flex-shrink-0 ml-2",
                              sizeConfig.icon
                            )}
                          />
                        )}
                      </button>
                    ))}

                  {/* Create New Button */}
                  {onCreateNew && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onCreateNew();
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 text-left hover:bg-muted transition-colors",
                        sizeConfig.item
                      )}
                    >
                      <Plus className={sizeConfig.icon} />
                      <span>{createNewLabel}</span>
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

