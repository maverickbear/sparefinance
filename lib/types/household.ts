/**
 * Household and HouseholdMember types for household-based architecture
 */

export interface Household {
  id: string;
  name: string;
  type: 'personal' | 'household';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  settings?: Record<string, unknown>;
}

export interface HouseholdMemberNew {
  id: string;
  householdId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'pending' | 'inactive';
  isDefault: boolean;
  joinedAt: Date;
  invitedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserActiveHousehold {
  userId: string;
  householdId: string;
  updatedAt: Date;
}

export interface HouseholdWithMembers extends Household {
  members?: HouseholdMemberNew[];
}

export interface HouseholdMemberWithUser extends HouseholdMemberNew {
  user?: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl?: string | null;
  };
}

