const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const runMigrations = async () => {
  try {
    console.log('🚀 Starting database migrations...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Database schema created:');
    console.log('  - users');
    console.log('  - workspaces');
    console.log('  - workspace_members');
    console.log('  - oauth_tokens');
    console.log('  - ad_accounts');
    console.log('  - campaigns');
    console.log('  - ad_sets');
    console.log('  - ads');
    console.log('  - ad_metrics');
    console.log('  - dashboards');
    console.log('  - dashboard_widgets');
    console.log('  - sync_jobs');
    console.log('\n🎉 Your database is ready!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
};

runMigrations();
