const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

function validateEnvVars() {
  const requiredVars = [
    'DB_USER',
    'DB_HOST',
    'DB_NAME',
    'DB_PASSWORD',
    'DB_PORT',
    'MIGRATIONS_TABLE',
    'MIGRATIONS_NAME_COLUMN'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    const error = new Error();
    error.message = `Variáveis de ambiente obrigatórias faltando: ${missingVars.join(', ')}`;
    throw error;
  }
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function runMigrations(direction = 'up', targetVersion = null) {
  validateEnvVars();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const migrationsTable = process.env.MIGRATIONS_TABLE;
    const nameColumn = process.env.MIGRATIONS_NAME_COLUMN;
    const appliedMigrations = await client.query(`SELECT ${nameColumn} FROM ${migrationsTable} ORDER BY executed_at DESC`);
    const appliedMigrationNames = appliedMigrations.rows.map(row => row[nameColumn]);

    let migrationFiles = fs.readdirSync(path.join(__dirname, 'migrations'))
      .filter(file => file.endsWith(`_${direction}.sql`))
      .sort();

    if (direction === 'up') {
      // Filtra para incluir apenas migrations não aplicadas
      migrationFiles = migrationFiles.filter(file => {
        const migrationName = path.parse(file).name.replace('_up', '');
        return !appliedMigrationNames.includes(migrationName);
      });

      if (targetVersion) {
        const targetIndex = migrationFiles.findIndex(file => file.startsWith(`${targetVersion}_`));
        if (targetIndex !== -1) {
          migrationFiles = migrationFiles.slice(0, targetIndex + 1);
        }
      }
    } else if (direction === 'down') {
      // Filtra para incluir apenas migrations aplicadas
      migrationFiles = migrationFiles.filter(file => {
        const migrationName = path.parse(file).name.replace('_down', '');
        return appliedMigrationNames.includes(migrationName);
      });
      migrationFiles.reverse();

      if (targetVersion) {
        const targetIndex = migrationFiles.findIndex(file => file.startsWith(`${targetVersion}_`));
        if (targetIndex !== -1) {
          migrationFiles = migrationFiles.slice(0, targetIndex + 1);
        }
      }
    }

    for (const file of migrationFiles) {
      const migrationName = path.parse(file).name.replace(`_${direction}`, '');
      const versionNumber = migrationName.split('_')[0];
      
      if (direction === 'up') {
        console.log(`Executing migration: ${file}`);
        const sql = fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf8');
        await client.query(sql);
        await client.query(`INSERT INTO ${migrationsTable} (${nameColumn}) VALUES (${migrationName})`);
        console.log(`Migration ${file} executed successfully.`);
      } else if (direction === 'down') {
        console.log(`Reverting migration: ${file}`);
        const sql = fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf8');
        await client.query(sql);
        await client.query(`DELETE FROM ${migrationsTable} WHERE ${nameColumn} = ${migrationName}`);
        console.log(`Migration ${file} reverted successfully.`);
      }

      if (targetVersion && versionNumber === targetVersion) {
        console.log(`Reached target version ${targetVersion}. Stopping ${direction === 'up' ? 'migration' : 'reversion'}.`);
        break;
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    const errorMessages = {
      '42P01': 'Tabela não encontrada. Verifique se a tabela de migrations existe.',
      '28P01': 'Falha na autenticação. Verifique usuário e senha do banco de dados.',
      '3D000': 'Banco de dados não existe. Verifique o nome do banco configurado.',
      'ENOTFOUND': 'Não foi possível conectar ao servidor do banco de dados.',
      'default': `Erro ao ${direction === 'up' ? 'executar' : 'reverter'} migration`
    };
    
    const errorCode = err.code || 'default';
    const message = errorMessages[errorCode] || errorMessages['default'];
    console.error(`ERRO: ${message}`);
  } finally {
    client.release();
  }
}

const direction = process.argv[2] === 'down' ? 'down' : 'up';
const targetVersion = process.argv[3];

runMigrations(direction, targetVersion).then(() => {
  console.log(`Migrations ${direction === 'up' ? 'executed' : 'reverted'}.`);
  pool.end();
});
