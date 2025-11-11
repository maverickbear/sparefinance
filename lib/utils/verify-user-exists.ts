"use server";

import { createServerClient } from "@/lib/supabase-server";

/**
 * Verifica se o usuário autenticado existe na tabela User
 * Se não existir, faz logout e retorna false
 * 
 * @returns {Promise<{ exists: boolean; userId: string | null }>}
 */
export async function verifyUserExists(): Promise<{ exists: boolean; userId: string | null }> {
  try {
    const supabase = await createServerClient();
    
    // Verifica se o usuário está autenticado
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return { exists: false, userId: null };
    }

    // Verifica se o usuário existe na tabela User
    const { data: userData, error: userError } = await supabase
      .from("User")
      .select("id")
      .eq("id", authUser.id)
      .single();

    // Se o usuário não existe na tabela User, faz logout
    if (userError || !userData) {
      console.warn(`[verifyUserExists] User ${authUser.id} authenticated but not found in User table. Logging out.`);
      
      // Faz logout para limpar a sessão
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error("[verifyUserExists] Error signing out:", signOutError);
      }
      
      return { exists: false, userId: authUser.id };
    }

    return { exists: true, userId: authUser.id };
  } catch (error) {
    console.error("[verifyUserExists] Error verifying user exists:", error);
    return { exists: false, userId: null };
  }
}

