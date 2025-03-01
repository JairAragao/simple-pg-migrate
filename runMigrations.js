const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function runMigrations(direction = 'up', targetVersion = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cria a tabela de controle de migrations se não existir
    // await client.query(`
    //   CREATE TABLE IF NOT EXISTS migrations (
    //     id SERIAL PRIMARY KEY,
    //     name VARCHAR(255) NOT NULL,
    //     executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    //   )
    // `);

    // Obtém todas as migrations aplicadas
    const appliedMigrations = await client.query('SELECT name FROM migrations ORDER BY executed_at DESC');
    const appliedMigrationNames = appliedMigrations.rows.map(row => row.name);

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
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [migrationName]);
        console.log(`Migration ${file} executed successfully.`);
      } else if (direction === 'down') {
        console.log(`Reverting migration: ${file}`);
        const sql = fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf8');
        await client.query(sql);
        await client.query('DELETE FROM migrations WHERE name = $1', [migrationName]);
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
    console.error(`Error ${direction === 'up' ? 'executing' : 'reverting'} migrations:`, err);
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