const User = require('../models/User');
const Workspace = require('../models/Workspace');
const { pool } = require('../config/database');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    console.log('🌱 Starting database seeding...\n');

    // Check if admin user already exists
    let existingAdmin = await User.findByUsername(process.env.ADMIN_USERNAME || 'admin');
    let adminUser;

    if (existingAdmin) {
      console.log('ℹ️  Admin user already exists');
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Role: ${existingAdmin.role}`);
      console.log(`   Status: ${existingAdmin.status}`);
      adminUser = existingAdmin;
    } else {
      // Create admin user
      adminUser = await User.create({
        username: process.env.ADMIN_USERNAME || 'admin',
        email: process.env.ADMIN_EMAIL || 'admin@adsdata.com',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        role: 'admin',
        status: 'approved',
        companyName: 'AdsData Platform',
        contactPerson: 'System Administrator',
        phone: null,
      });

      console.log('✅ Admin user created successfully!');
      console.log('\n📋 Admin Credentials:');
      console.log(`   Username: ${adminUser.username}`);
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
      console.log(`   Role: ${adminUser.role}`);
      console.log(`   Status: ${adminUser.status}`);
    }

    // Check if admin workspace already exists
    const existingWorkspaces = await Workspace.findByUserId(adminUser.id);

    if (existingWorkspaces.length > 0) {
      console.log('\nℹ️  Admin workspace already exists');
      console.log(`   Workspace: ${existingWorkspaces[0].name}`);
    } else {
      // Create default workspace for admin
      const workspace = await Workspace.create({
        name: 'Default Workspace',
        ownerId: adminUser.id,
        description: 'Default workspace for AdsData Platform',
        settings: {
          defaultCurrency: 'USD',
          timezone: 'UTC',
        },
      });

      console.log('\n✅ Default workspace created successfully!');
      console.log(`   Workspace: ${workspace.name}`);
      console.log(`   Owner: ${adminUser.username}`);
    }

    console.log('\n🎉 Database seeding completed!');
    console.log('\n⚠️  Remember to change the admin password in production!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error);
    process.exit(1);
  }
};

seedAdmin();
