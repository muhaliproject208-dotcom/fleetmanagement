# Google OAuth Setup with Supabase

This guide will help you configure Google OAuth authentication for your Fleet Safety System using Supabase.

## Prerequisites

1. A Supabase project (already created)
2. Google Cloud Console account
3. Your application's callback URL: `https://your-project.supabase.co/auth/v1/callback`

## Step 1: Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Select "Web application"
   - Add a name (e.g., "Fleet Safety System")
   - Add authorized redirect URI:
     ```
     https://your-project.supabase.co/auth/v1/callback
     ```
   - Save the Client ID and Client Secret

## Step 2: Configure Supabase

1. Go to your Supabase project dashboard
2. Navigate to "Authentication" > "Providers"
3. Find "Google" in the list and enable it
4. Enter your Google OAuth credentials:
   - **Client ID**: From Google Cloud Console
   - **Client Secret**: From Google Cloud Console
   - **Redirect URL**: Should be pre-filled as `https://your-project.supabase.co/auth/v1/callback`
5. Click "Save"

## Step 3: Update Environment Variables

Make sure your `.env.local` file contains the correct Supabase configuration:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Step 4: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000/auth`

3. Click the "Continue with Google" button

4. You should be redirected to Google for authentication

5. After successful authentication, you'll be redirected back to your application

## How It Works

### Authentication Flow

1. User clicks "Continue with Google"
2. Application redirects to Google OAuth
3. User authenticates with Google
4. Google redirects to Supabase callback URL
5. Supabase creates/updates user session
6. Application checks for user profile in database
7. If profile exists → redirect to role-specific dashboard
8. If profile doesn't exist → create profile automatically for Google users

### Automatic Profile Creation

For Google OAuth users, the system automatically:
- Creates a user profile in the `users` table
- Sets default role as 'driver'
- Marks user as verified
- Uses Google profile information (name, email)

### Database Schema

The `users` table should have these columns:
- `id` (uuid, primary key) - matches Supabase auth user ID
- `email` (text)
- `full_name` (text)
- `role` (text) - driver, admin, fleet_manager, etc.
- `is_verified` (boolean)
- `org_id` (uuid, optional)
- `created_at` (timestamp)

## Troubleshooting

### Common Issues

1. **Redirect URI Mismatch**
   - Ensure the redirect URI in Google Console matches exactly: `https://your-project.supabase.co/auth/v1/callback`

2. **CORS Errors**
   - Make sure your application domain is added to Supabase CORS settings

3. **Missing User Profile**
   - Check the browser console for errors
   - Verify the `users` table exists and has correct permissions

4. **Environment Variables**
   - Ensure all Supabase environment variables are correctly set

### Debug Mode

To enable debug logging, check the browser console and Supabase logs for detailed error information.

## Security Considerations

1. Keep your Google Client Secret secure
2. Use environment variables for all sensitive data
3. Regularly rotate your OAuth credentials
4. Monitor authentication logs for suspicious activity

## Next Steps

1. Customize the default role assignment logic
2. Add organization mapping for Google users
3. Implement additional user profile fields
4. Set up role-based access controls
5. Add audit logging for authentication events
