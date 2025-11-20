-- Migration: Allow public validation of pending invitations by token
-- This is more secure than using service role client
-- Only allows reading specific fields of pending invitations when token matches

-- Create a function that validates invitation tokens
-- This function can be called without authentication but only returns limited data
CREATE OR REPLACE FUNCTION public.validate_invitation_token(p_token text)
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  role text,
  status text,
  owner_id uuid
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hm.id,
    hm.email,
    hm.name,
    hm.role,
    hm.status,
    hm."ownerId" as owner_id
  FROM "HouseholdMember" hm
  WHERE hm."invitationToken" = p_token
    AND hm.status = 'pending';
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(text) TO authenticated;

-- Create a function to get owner info for invitation validation
-- This is also secure as it only returns name and email
CREATE OR REPLACE FUNCTION public.get_owner_info_for_invitation(p_owner_id uuid)
RETURNS TABLE (
  name text,
  email text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.name,
    u.email
  FROM "User" u
  WHERE u.id = p_owner_id;
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_owner_info_for_invitation(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_owner_info_for_invitation(uuid) TO authenticated;

-- Create a function to check if email has an account
CREATE OR REPLACE FUNCTION public.check_email_has_account(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM "User" 
    WHERE email = LOWER(p_email)
  ) INTO user_exists;
  
  RETURN user_exists;
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.check_email_has_account(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_email_has_account(text) TO authenticated;

