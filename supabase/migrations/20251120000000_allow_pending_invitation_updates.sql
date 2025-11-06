-- Migration: Allow pending invitation updates
-- This migration adds a policy to allow users to accept pending invitations
-- when their email matches the invitation email

-- Create a function to check if the authenticated user's email matches the invitation email
CREATE OR REPLACE FUNCTION public.check_invitation_email_match(invitation_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get the authenticated user's email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Return true if emails match
  RETURN user_email = invitation_email;
END;
$$;

-- Drop the existing "Members can accept invitations" policy
DROP POLICY IF EXISTS "Members can accept invitations" ON "HouseholdMember";

-- Recreate the policy to allow updates when:
-- 1. The user is already the member (memberId matches)
-- 2. The user is the owner (ownerId matches)
-- 3. The invitation is pending and the email matches the authenticated user's email
CREATE POLICY "Members can accept invitations" ON "HouseholdMember"
  FOR UPDATE 
  USING (
    auth.uid() = "memberId" 
    OR auth.uid() = "ownerId"
    OR (
      "status" = 'pending' 
      AND public.check_invitation_email_match("email")
    )
  )
  WITH CHECK (
    auth.uid() = "memberId" 
    OR auth.uid() = "ownerId"
    OR (
      "status" = 'pending' 
      AND public.check_invitation_email_match("email")
    )
  );

