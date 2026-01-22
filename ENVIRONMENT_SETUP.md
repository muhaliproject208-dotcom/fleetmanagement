# 🚨 IMPORTANT: Environment Setup Required

The API routes are created but **WILL NOT WORK** until you set up environment variables.

## 📋 Setup Steps

### 1. Get Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings → API**
4. Copy the following:
   - **Project URL** 
   - **anon public key**
   - **service_role key** (from Settings → Database → API)

### 2. Create Environment File

Create a new file called `.env.local` in your project root:

```bash
# Environment Variables for Fleet Safety System

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Optional: Additional Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Fleet Safety System
```

### 3. Replace with Your Values

Replace the placeholder values with your actual Supabase credentials:

- `https://your-project-id.supabase.co` → Your actual project URL
- `your-anon-key-here` → Your actual anon key  
- `your-service-role-key-here` → Your actual service role key

### 4. Restart Development Server

```bash
npm run dev
```

## 🔍 What This Fixes

Without these environment variables:
- ❌ API routes return "Supabase configuration is missing"
- ❌ Authentication won't work
- ❌ Database connections fail
- ❌ All API calls will error

With proper setup:
- ✅ API routes connect to Supabase
- ✅ Authentication works
- ✅ Database operations succeed
- ✅ Full system functionality

## 🛡️ Security Notes

- `.env.local` is in `.gitignore` (correct!)
- Never commit your keys to version control
- Keep your service role key secure
- Use different keys for development/production

## 🧪 Test Your Setup

After setting up environment variables, test:

1. Visit `http://localhost:3000`
2. Should redirect to setup page (if not configured)
3. Check browser console for any errors
4. Try accessing API endpoints directly

## 📞 Need Help?

If you don't have Supabase set up:
1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Run the SQL schema from `scripts/init-database.sql`
4. Follow the steps above

Your Fleet Safety System will be fully functional once environment variables are properly configured! 🚛️
