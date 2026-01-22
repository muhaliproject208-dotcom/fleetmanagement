# Fleet Safety System - Setup Guide

## Quick Start

### 1. Supabase Setup

1. Create a new Supabase project
2. Go to Project Settings > API to get your credentials
3. Save these values:
   - Project URL
   - Anon Key (public)
   - Service Role Key (keep secret)

### 2. Environment Configuration

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Database Setup

1. Go to Supabase SQL Editor
2. Run the SQL migrations from the README
3. Enable RLS on all tables
4. Set up RLS policies:

```sql
-- Allow drivers to see only their own data
CREATE POLICY "drivers_own_trips" ON trips
  FOR SELECT USING (auth.uid() = user_id);

-- Allow supervisors to see their org's data
CREATE POLICY "supervisors_org_trips" ON trips
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND org_id = trips.org_id
      AND role IN ('supervisor', 'org_admin', 'admin')
    )
  );
```

### 4. Create Test Users

1. Go to Supabase Auth > Users
2. Create accounts for:
   - driver@test.com (driver role)
   - supervisor@test.com (supervisor role)
   - admin@test.com (admin role)

### 5. Start Application

```bash
npm install
npm run dev
```

Access at `http://localhost:3000`

## User Workflows

### Driver Workflow
1. Login with driver account
2. Fill pre-trip form (11 modules)
3. Form auto-saves every 30 seconds
4. Submit when complete
5. Wait for supervisor approval

### Supervisor Workflow
1. Login with supervisor account
2. Go to Dashboard
3. See pending approvals
4. Review trip details and score
5. Approve or reject with notes
6. Driver receives notification

### Admin Workflow
1. Login with admin account
2. Go to Analytics
3. View compliance metrics
4. Manage users and corrective measures
5. Override approvals if needed

## Troubleshooting

### "Unauthorized" on API calls
- Check if user is authenticated
- Verify Supabase credentials
- Check RLS policies

### Draft not saving
- Check browser console for errors
- Verify Supabase write permissions
- Check if trip_drafts table exists

### Can't approve trips
- Verify user role is supervisor/admin
- Check if trip status is "submitted"
- Verify RLS policies allow updates

## Performance Tips

1. **Form Optimization**: 11 modules load in ~2s
2. **API Caching**: Analytics cached for 5 minutes
3. **Database Indexing**: Add indexes on frequently queried columns
4. **Image Optimization**: Use next/image for all images

## Monitoring

Monitor key metrics:
- Trip submission rate
- Approval time (avg)
- Critical failure rate
- User adoption
