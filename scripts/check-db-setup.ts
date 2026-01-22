// Database Setup Check Script
// Run this to verify your Supabase database setup

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDatabaseSetup() {
  console.log('🔍 Checking Supabase Database Setup...\n')

  try {
    // Check if we can connect to Supabase
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError) {
      console.error('❌ Supabase connection error:', authError.message)
      return
    }
    console.log('✅ Supabase connection successful')

    // Check if users table exists
    console.log('\n📋 Checking tables...')
    
    const tables = [
      { name: 'users', description: 'User accounts and roles' },
      { name: 'profiles', description: 'User profile information' },
      { name: 'trips', description: 'Trip records' },
      { name: 'trip_modules', description: 'Trip inspection modules' },
      { name: 'module_items', description: 'Individual inspection items' }
    ]

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table.name)
          .select('*')
          .limit(1)

        if (error) {
          if (error.message.includes('does not exist')) {
            console.log(`❌ Table '${table.name}' does not exist`)
            console.log(`   ${table.description}`)
          } else {
            console.log(`⚠️  Table '${table.name}' exists but has access issues:`, error.message)
          }
        } else {
          console.log(`✅ Table '${table.name}' exists and is accessible`)
        }
      } catch (err) {
        console.log(`❌ Error checking table '${table.name}':`, err)
      }
    }

    // Check RLS policies
    console.log('\n🔒 Checking RLS policies...')
    try {
      const { data: rlsData, error: rlsError } = await supabase
        .from('users')
        .select('id')
        .limit(1)

      if (rlsError && rlsError.message.includes('row-level security')) {
        console.log('⚠️  RLS policies may be blocking access')
        console.log('   Make sure RLS policies are properly configured')
      } else if (rlsError) {
        console.log('❌ RLS policy check failed:', rlsError.message)
      } else {
        console.log('✅ RLS policies appear to be working')
      }
    } catch (err) {
      console.log('❌ Error checking RLS policies:', err)
    }

    // Test user creation
    console.log('\n🧪 Testing user creation...')
    const testUserId = '00000000-0000-0000-0000-000000000000'
    
    try {
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('id', testUserId)
        .single()

      if (testError && testError.message.includes('No rows found')) {
        console.log('✅ User select query works (no test user found, which is expected)')
      } else if (testError) {
        console.log('❌ User select query failed:', testError.message)
      } else {
        console.log('✅ User select query works')
      }
    } catch (err) {
      console.log('❌ Error testing user query:', err)
    }

  } catch (error) {
    console.error('❌ Database check failed:', error)
  }

  console.log('\n📝 Setup Instructions:')
  console.log('1. Make sure Supabase environment variables are set')
  console.log('2. Run the SQL schema from README.md in your Supabase project')
  console.log('3. Configure RLS policies for each table')
  console.log('4. Test user creation with the signup form')

  console.log('\n🔧 Quick SQL to create users table:')
  console.log(`
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE,
  role TEXT CHECK (role IN ('driver', 'supervisor', 'mechanic', 'org_admin', 'admin')),
  org_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
`)

  console.log('\n🔧 Quick SQL to create profiles table:')
  console.log(`
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  full_name TEXT,
  phone TEXT,
  license_number TEXT,
  vehicle_id TEXT,
  vehicle_plate TEXT,
  avatar_url TEXT
);
`)
}

checkDatabaseSetup()
