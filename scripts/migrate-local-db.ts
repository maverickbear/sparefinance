/**
 * Script para aplicar migrações no banco de dados local
 * Execute: npm run db:migrate
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';

async function runMigrations() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados local\n');

    // Ler todas as migrações
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️  Diretório de migrações não encontrado:', migrationsDir);
      console.log('   Criando diretório...');
      fs.mkdirSync(migrationsDir, { recursive: true });
      console.log('✅ Diretório criado. Adicione suas migrações SQL lá.\n');
      return;
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      console.log('⚠️  Nenhuma migração encontrada em:', migrationsDir);
      return;
    }

    console.log(`📋 Encontradas ${migrationFiles.length} migração(ões):\n`);

    // Criar tabela de controle de migrações se não existir
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Verificar quais migrações já foram aplicadas
    const { rows: appliedMigrations } = await client.query(
      'SELECT version FROM schema_migrations'
    );
    const appliedVersions = new Set(appliedMigrations.map((r: any) => r.version));

    let appliedCount = 0;

    for (const file of migrationFiles) {
      const version = file.replace('.sql', '');
      
      if (appliedVersions.has(version)) {
        console.log(`⏭️  ${file} - já aplicada`);
        continue;
      }

      console.log(`🔄 Aplicando ${file}...`);
      
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

      try {
        // Executar migração dentro de uma transação
        await client.query('BEGIN');
        await client.query(migrationSQL);
        
        // Registrar migração
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
        
        await client.query('COMMIT');
        console.log(`✅ ${file} - aplicada com sucesso\n`);
        appliedCount++;
      } catch (error: any) {
        await client.query('ROLLBACK');
        console.error(`❌ Erro ao aplicar ${file}:`, error.message);
        throw error;
      }
    }

    console.log('='.repeat(60));
    if (appliedCount > 0) {
      console.log(`✅ ${appliedCount} migração(ões) aplicada(s) com sucesso!`);
    } else {
      console.log('ℹ️  Todas as migrações já foram aplicadas.');
    }
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();

