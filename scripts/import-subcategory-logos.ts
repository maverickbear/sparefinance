#!/usr/bin/env tsx
/**
 * Script para importar logos nas subcategorias existentes
 * Usa APIs gratuitas de logos (Clearbit e Google Favicon)
 * 
 * Execute com: npm run import:logos
 */

// Load environment variables from .env.local FIRST
import { loadEnvConfig } from "@next/env";

const projectDir = process.cwd();
loadEnvConfig(projectDir);

// Now import Supabase client after env vars are loaded
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Missing Supabase environment variables");
  console.log("\n💡 Please check your .env.local file:");
  console.log("   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co");
  console.log("   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key\n");
  process.exit(1);
}

// Create service role client directly (bypasses RLS)
function createServiceRoleClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Mapeamento de nomes de subcategorias para domínios
const subcategoryDomainMap: Record<string, string> = {
  // Utilities
  "BC Hydro": "bchydro.com",
  "Fortis BC": "fortisbc.com",
  "Internet": "", // Genérico, não tem logo específico
  "Maintenance": "", // Genérico
  "Insurance": "", // Genérico
  
  // Streaming
  "Netflix": "netflix.com",
  "Disney+": "disney.com",
  "YouTube": "youtube.com",
  "Spotify": "spotify.com",
  
  // Software
  "Adobe": "adobe.com",
  "ChatGPT": "openai.com",
  "Cloud": "", // Genérico
  
  // Vehicle
  "Car Loan": "", // Genérico
  "Car Insurance": "", // Genérico
  "Fuel": "", // Genérico
  "Maintenance": "", // Genérico
  "Parking": "", // Genérico
  "Vehicle Maintenance": "", // Genérico
  
  // Transit
  "Transit Pass": "", // Genérico
  "Public Transit": "", // Genérico
  
  // Food
  "Apollo": "", // Pode ser marca de pet food, mas não tenho certeza do domínio
  
  // Health
  "Ozempic": "ozempic.com",
  "Naor": "", // Nome pessoal
  "Natalia": "", // Nome pessoal
  
  // Business
  "Office Rent (70%)": "", // Genérico
  "Phone & Internet": "", // Genérico
  "Equipment": "", // Genérico
  "Hosting": "", // Genérico
  "Accounting": "", // Genérico
};

/**
 * Tenta inferir o domínio baseado no nome da subcategoria
 */
function inferDomain(subcategoryName: string): string | null {
  // Primeiro, verifica o mapeamento direto
  const mappedDomain = subcategoryDomainMap[subcategoryName];
  if (mappedDomain) {
    // Se for string vazia, significa que é genérico e não tem logo
    if (mappedDomain === "") {
      return null;
    }
    return mappedDomain;
  }
  
  // Tenta inferir baseado no nome
  const name = subcategoryName.toLowerCase().trim();
  
  // Remove caracteres especiais e espaços, mas mantém pontos e hífens
  let cleanName = name.replace(/[^a-z0-9.-]/g, "");
  
  // Remove pontos e hífens no início/fim
  cleanName = cleanName.replace(/^[.-]+|[.-]+$/g, "");
  
  // Se o nome já parece ser um domínio (tem ponto)
  if (cleanName.includes(".")) {
    return cleanName;
  }
  
  // Se o nome parece ser uma empresa conhecida (mais de 3 caracteres)
  if (cleanName.length > 3 && cleanName.length < 30) {
    // Tenta algumas variações comuns
    return `${cleanName}.com`;
  }
  
  return null;
}

/**
 * Busca logo usando Clearbit Logo API
 */
async function getClearbitLogo(domain: string): Promise<string | null> {
  try {
    const url = `https://logo.clearbit.com/${domain}`;
    const response = await fetch(url, { method: "HEAD" });
    
    if (response.ok) {
      return url;
    }
  } catch (error) {
    console.error(`Error fetching Clearbit logo for ${domain}:`, error);
  }
  
  return null;
}

/**
 * Busca logo usando Google Favicon API (fallback)
 */
async function getGoogleFavicon(domain: string): Promise<string | null> {
  try {
    const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    const response = await fetch(url, { method: "HEAD" });
    
    if (response.ok) {
      return url;
    }
  } catch (error) {
    console.error(`Error fetching Google favicon for ${domain}:`, error);
  }
  
  return null;
}

/**
 * Busca logo para uma subcategoria
 */
async function findLogoForSubcategory(subcategoryName: string): Promise<string | null> {
  const domain = inferDomain(subcategoryName);
  
  if (!domain) {
    console.log(`⚠️  Não foi possível inferir domínio para: ${subcategoryName}`);
    return null;
  }
  
  console.log(`🔍 Buscando logo para "${subcategoryName}" (${domain})...`);
  
  // Tenta Clearbit primeiro (melhor qualidade)
  const clearbitLogo = await getClearbitLogo(domain);
  if (clearbitLogo) {
    console.log(`✅ Logo encontrado (Clearbit): ${clearbitLogo}`);
    return clearbitLogo;
  }
  
  // Fallback para Google Favicon
  const faviconLogo = await getGoogleFavicon(domain);
  if (faviconLogo) {
    console.log(`✅ Logo encontrado (Google Favicon): ${faviconLogo}`);
    return faviconLogo;
  }
  
  console.log(`❌ Logo não encontrado para: ${subcategoryName}`);
  return null;
}

/**
 * Atualiza uma subcategoria com o logo
 */
async function updateSubcategoryLogo(
  supabase: ReturnType<typeof createServiceRoleClient>,
  subcategoryId: string,
  logo: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("Subcategory")
      .update({ logo, updatedAt: new Date().toISOString() })
      .eq("id", subcategoryId)
      .is("userId", null); // Apenas subcategorias do sistema
    
    if (error) {
      console.error(`❌ Erro ao atualizar subcategoria ${subcategoryId}:`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Erro ao atualizar subcategoria ${subcategoryId}:`, error);
    return false;
  }
}

/**
 * Função principal
 */
async function main() {
  console.log("🚀 Iniciando importação de logos para subcategorias...\n");
  
  const supabase = createServiceRoleClient();
  
  // Busca todas as subcategorias do sistema (userId IS NULL)
  const { data: subcategories, error } = await supabase
    .from("Subcategory")
    .select("id, name, logo")
    .is("userId", null)
    .order("name");
  
  if (error) {
    console.error("❌ Erro ao buscar subcategorias:", error);
    process.exit(1);
  }
  
  if (!subcategories || subcategories.length === 0) {
    console.log("ℹ️  Nenhuma subcategoria encontrada.");
    return;
  }
  
  console.log(`📋 Encontradas ${subcategories.length} subcategorias do sistema.\n`);
  
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const subcategory of subcategories) {
    // Pula se já tem logo
    if (subcategory.logo) {
      console.log(`⏭️  Pulando "${subcategory.name}" (já tem logo)`);
      skipped++;
      continue;
    }
    
    // Busca logo
    const logo = await findLogoForSubcategory(subcategory.name);
    
    if (logo) {
      // Atualiza subcategoria
      const success = await updateSubcategoryLogo(supabase, subcategory.id, logo);
      
      if (success) {
        updated++;
        console.log(`✅ Logo importado para "${subcategory.name}"\n`);
      } else {
        failed++;
        console.log(`❌ Falha ao atualizar "${subcategory.name}"\n`);
      }
    } else {
      skipped++;
      console.log(`⏭️  Pulando "${subcategory.name}" (logo não encontrado)\n`);
    }
    
    // Pequeno delay para não sobrecarregar as APIs
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("📊 Resumo:");
  console.log(`✅ Atualizadas: ${updated}`);
  console.log(`⏭️  Puladas: ${skipped}`);
  console.log(`❌ Falhas: ${failed}`);
  console.log("=".repeat(50));
}

// Executa o script
main()
  .then(() => {
    console.log("\n✨ Importação concluída!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro fatal:", error);
    process.exit(1);
  });

