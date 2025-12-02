#!/usr/bin/env node
/**
 * Docker entrypoint script that runs migrations before starting the app
 * Handles both development and production environments gracefully
 */

const { execSync, spawn } = require('child_process');

const isProduction = process.env.NODE_ENV === 'production';

async function waitForDatabase(maxAttempts = 30) {
  console.log('⏳ Waiting for database to be ready...');
  
  // Prisma client should be generated during npm ci (prepare script)
  // But handle gracefully if it's not available yet
  let PrismaClient;
  try {
    PrismaClient = require('@prisma/client').PrismaClient;
  } catch (error) {
    console.log('⚠️  Prisma client not available yet, generating...');
    try {
      execSync('npx prisma generate', { stdio: 'pipe' });
      PrismaClient = require('@prisma/client').PrismaClient;
    } catch (genError) {
      console.error('❌ Failed to generate Prisma client:', genError.message);
      throw genError;
    }
  }
  
  const prisma = new PrismaClient();
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await prisma.$connect();
      console.log('✅ Database is ready');
      await prisma.$disconnect();
      return true;
    } catch (error) {
      if (i < maxAttempts - 1) {
        process.stdout.write(`  Attempt ${i + 1}/${maxAttempts}...\r`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error('\n❌ Database connection timeout');
        throw error;
      }
    }
  }
}

async function resolveFailedMigrations() {
  // Check for failed migrations and try to resolve them
  console.log('🔍 Checking for failed migrations...');
  
  try {
    // Try to resolve any failed migrations by marking them as rolled back
    // This handles cases where a migration partially applied
    const failedMigrations = [
      '20251203000000_add_cron_job_executions'
    ];
    
    for (const migration of failedMigrations) {
      try {
        execSync(`npx prisma migrate resolve --rolled-back ${migration}`, { stdio: 'pipe' });
        console.log(`  ✅ Resolved failed migration: ${migration}`);
      } catch (e) {
        // Migration wasn't failed, that's fine
      }
    }
  } catch (error) {
    // Ignore errors - this is just a cleanup attempt
  }
}

async function runMigrations() {
  console.log('📦 Running database migrations...');
  
  // First, try to resolve any previously failed migrations
  await resolveFailedMigrations();
  
  try {
    if (isProduction) {
      console.log('  Using "prisma migrate deploy" for production...');
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    } else {
      console.log('  Using "prisma migrate deploy" for development (Docker)...');
      // In Docker dev, use deploy to avoid interactive prompts
      // This applies pending migrations without creating new ones
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    }
    console.log('✅ Migrations applied successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('❌ This is a critical error. The database schema is out of sync.');
    console.error('❌ Please fix the migration issue before continuing.');
    // Migration failures are critical in both dev and prod
    // The app cannot run with a mismatched schema
    process.exit(1);
  }
}

async function generatePrismaClient() {
  console.log('🔄 Regenerating Prisma client...');
  
  try {
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Prisma client generated');
  } catch (error) {
    console.error('⚠️  Prisma generate failed:', error.message);
    // This is less critical - might already be generated
    console.log('⚠️  Continuing...');
  }
}

async function seedAchievements() {
  console.log('🏆 Seeding achievements...');
  
  try {
    // Check if ts-node is available (it might not be in production builds)
    try {
      execSync('npx ts-node --version', { stdio: 'pipe' });
    } catch (checkError) {
      console.log('⚠️  ts-node not available, skipping achievement seeding');
      console.log('⚠️  Achievements should be seeded manually or via a separate process');
      return;
    }
    
    // Use ts-node to run the TypeScript seed script
    execSync('npx ts-node --project tsconfig.json src/scripts/seed-achievements.ts', { 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' }
    });
    console.log('✅ Achievements seeded successfully');
  } catch (error) {
    console.error('⚠️  Achievement seeding failed:', error.message);
    // This is non-critical - achievements might already be seeded
    // Don't fail the startup, just log the warning
    console.log('⚠️  Continuing without seeding achievements...');
    console.log('⚠️  You may need to seed achievements manually: npm run db:seed:achievements');
  }
}

async function main() {
  const command = process.argv.slice(2);
  
  if (command.length === 0) {
    console.error('❌ No command provided to entrypoint script');
    process.exit(1);
  }

  try {
    await waitForDatabase();
    
    // Run migrations - if this fails, we exit
    await runMigrations();
    
    // Only regenerate Prisma client if migrations succeeded
    await generatePrismaClient();
    
    // Seed achievements (non-blocking, uses upsert so safe to run multiple times)
    await seedAchievements();
    
    console.log('✅ Setup complete, starting application...\n');
    
    // Execute the original command
    const child = spawn(command[0], command.slice(1), {
      stdio: 'inherit',
      shell: true,
      env: process.env
    });
    
    child.on('exit', (code) => {
      process.exit(code || 0);
    });
    
    process.on('SIGTERM', () => {
      child.kill('SIGTERM');
    });
    
    process.on('SIGINT', () => {
      child.kill('SIGINT');
    });
  } catch (error) {
    console.error('❌ Entrypoint script failed:', error);
    process.exit(1);
  }
}

main();

