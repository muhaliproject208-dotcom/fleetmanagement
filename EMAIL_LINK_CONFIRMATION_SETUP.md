# Email Link Confirmation Setup Guide

**Date:** $(date)  
**Status:** ✅ **CONFIGURED** - Email link confirmation enabled

## Overview

The system now uses **email link confirmation** instead of OTP codes. Users receive an email with a confirmation link that they click to verify their account.

**Note:** All OTP code is preserved and can be re-enabled if needed.

---

## How It Works

### Signup Flow:
1. User signs up with email and password
2. Supabase sends confirmation email with link (using your custom template)
3. User clicks "Confirm Email" button in email
4. User is redirected to `/auth/callback`
5. System verifies email and creates session
6. User is redirected to their dashboard

### Email Template:
The email template you configured in Supabase uses:
- `{{ .ConfirmationURL }}` - The confirmation link
- `{{ .Name }}` - User's name from metadata
- `{{ .Year }}` - Current year

---

## Supabase Configuration

### ✅ Email Template Setup (Already Done)
Your email template is configured in Supabase Dashboard:
- **Location:** Authentication > Email Templates > Confirm signup
- **Template:** Uses `{{ .ConfirmationURL }}` for the confirmation link
- **Styling:** Green theme matching your brand

### Required Settings:
1. **Authentication > Settings**
   - ✅ **Enable email confirmations**: MUST be ON
   - ✅ **Site URL**: Set to your production URL (e.g., `https://yourdomain.com`)
   - ✅ **Redirect URLs**: Add `/auth/callback` to allowed redirect URLs

2. **Email Template Variables:**
   - `{{ .ConfirmationURL }}` - The confirmation link (required)
   - `{{ .Name }}` - User's full name (from signup metadata)
   - `{{ .Year }}` - Current year

---

## Code Changes Made

### ✅ Updated Signup Flow
**File:** `app/auth/page.tsx`
- Changed `emailRedirectTo` from `/auth/verify-otp` to `/auth/callback`
- Removed automatic OTP resend (not needed for link confirmation)
- Redirects to `/auth/check-email` page after signup

### ✅ Updated Callback Handler
**File:** `app/auth/callback/route.ts`
- Added email confirmation status update
- Updates `is_verified` flag when email is confirmed
- Handles email confirmation link clicks

### ✅ Created Check Email Page
**File:** `app/auth/check-email/page.tsx` (NEW)
- Shows instructions to check email
- Provides "Resend Confirmation Email" button
- Green-themed UI matching your brand

### ✅ Created Resend Confirmation API
**File:** `app/api/auth/resend-confirmation/route.ts` (NEW)
- Resends confirmation email link
- Uses service role key for admin operations
- Better error handling

### ✅ Preserved OTP Code
**Files Preserved:**
- `app/auth/verify-otp/page.tsx` - Still available
- `app/api/auth/resend-otp/route.ts` - Still available
- `app/api/verify-otp/route.ts` - Still available

**To switch back to OTP:**
1. Change `emailRedirectTo` back to `/auth/verify-otp`
2. Re-enable OTP resend after signup
3. Update redirect after signup

---

## Testing

### Step 1: Sign Up
1. Go to `/auth`
2. Fill out signup form
3. Submit

### Step 2: Check Email
1. You'll be redirected to `/auth/check-email`
2. Check your email inbox
3. Look for email from "Fleet Pre-trip Safe Clearance"

### Step 3: Confirm Email
1. Click "Confirm Email" button in email
2. You'll be redirected to `/auth/callback`
3. System verifies and creates session
4. You're redirected to dashboard

### Step 4: Resend (if needed)
1. If email not received, click "Resend Confirmation Email"
2. New email will be sent
3. Check inbox again

---

## Troubleshooting

### Email Not Received?
1. **Check Spam Folder** - Emails might go to spam
2. **Check Supabase Logs** - Go to Dashboard > Logs > Email
3. **Verify Email Template** - Check template includes `{{ .ConfirmationURL }}`
4. **Check Rate Limits** - Supabase limits emails (4/hour per user)
5. **Use Resend Button** - Click "Resend Confirmation Email"

### Link Not Working?
1. **Check Redirect URLs** - Ensure `/auth/callback` is in allowed URLs
2. **Check Site URL** - Must match your domain
3. **Check Console Logs** - Look for errors in browser console
4. **Verify Environment Variables** - Ensure Supabase URL is correct

### Still Want OTP?
- All OTP code is preserved
- Can switch back by changing redirect URLs
- OTP pages still accessible at `/auth/verify-otp`

---

## Files Modified

1. **app/auth/page.tsx**
   - Changed to email link confirmation
   - Updated redirect to check-email page

2. **app/auth/callback/route.ts**
   - Added email confirmation status update
   - Improved user verification handling

3. **app/auth/check-email/page.tsx** (NEW)
   - Created check email page
   - Green-themed UI

4. **app/api/auth/resend-confirmation/route.ts** (NEW)
   - Created resend confirmation endpoint
   - Uses service role key

---

## Summary

✅ **Email link confirmation is now active**

Users will:
1. ✅ Receive email with confirmation link
2. ✅ Click "Confirm Email" button
3. ✅ Be automatically verified and logged in
4. ✅ Redirected to their dashboard

**OTP code is preserved** and can be re-enabled if needed.

---

*Setup guide generated*
