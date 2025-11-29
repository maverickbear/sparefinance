/**
 * Domain types for categories
 * Pure TypeScript types with no external dependencies
 */

export interface BaseCategory {
  id: string;
  name: string;
  groupId: string;
  userId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BaseSubcategory {
  id: string;
  name: string;
  categoryId: string;
  userId?: string | null;
  logo?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BaseGroup {
  id: string;
  name: string;
  type: "income" | "expense" | null;
  userId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryWithRelations extends BaseCategory {
  group?: BaseGroup | null;
  subcategories?: Array<{ id: string; name: string; logo?: string | null }>;
}

export interface SubcategoryWithRelations extends BaseSubcategory {
  category?: BaseCategory | null;
}

// Alias for backward compatibility (deprecated - use BaseGroup)
export type Macro = BaseGroup;

// Alias for backward compatibility (matches client-side Category interface)
export interface Category extends Omit<BaseCategory, 'groupId'> {
  groupId?: string | null;
  group?: { id: string; name: string } | null;
  subcategories?: Array<{ id: string; name: string; logo?: string | null }>;
}

// Alias for backward compatibility
export type Group = BaseGroup;

