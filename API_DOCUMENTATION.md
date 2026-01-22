# Fleet Pre-Trip Safety System - API Documentation

## Overview

This document describes the complete API layer for the Fleet Pre-Trip Safety & Management System. The API is built with Next.js 16, TypeScript, and Supabase, providing full CRUD operations, role-based access control, audit logging, and rate limiting.

## API Structure

```
/api/
├── users/                    # User management
│   ├── route.ts             # GET all, POST create
│   └── [id]/route.ts        # GET, PUT, DELETE specific user
├── profiles/                 # User profiles
│   ├── route.ts             # GET all, POST create
│   └── [userId]/route.ts     # GET, PUT, DELETE specific profile
├── trips/                    # Trip management
│   ├── route.ts             # GET all, POST create
│   ├── [tripId]/            # Trip-specific operations
│   │   ├── route.ts        # GET, PUT, DELETE specific trip
│   │   ├── modules/        # Trip modules
│   │   │   ├── route.ts    # GET all, POST create
│   │   │   └── [moduleId]/route.ts  # GET, PUT, DELETE
│   │   ├── signoffs/       # Digital signatures
│   │   │   ├── route.ts    # GET all, POST create
│   │   │   └── [signoffId]/route.ts  # GET, PUT, DELETE
│   │   ├── critical-failures/  # Critical issues tracking
│   │   │   ├── route.ts    # GET all, POST create
│   │   │   └── [failureId]/route.ts  # GET, PUT, DELETE
│   │   └── draft/          # Draft management
│   │       └── route.ts    # GET, POST, DELETE drafts
├── modules/                  # Module items
│   └── [moduleId]/
│       └── items/
│           ├── route.ts       # GET all, POST create
│           └── [itemId]/route.ts  # GET, PUT, DELETE
├── rpc/                      # RPC-style utility functions
│   ├── email-lookup/route.ts
│   ├── permissions-check/route.ts
│   ├── calculate-trip-score/route.ts
│   └── critical-override-check/route.ts
├── helpers/                  # Server-side helpers
│   ├── current-user/route.ts
│   ├── user-role/route.ts
│   ├── trips-by-role/route.ts
│   └── trip-statistics/route.ts
├── audit/                    # Audit logging
│   ├── logs/
│   │   ├── route.ts       # GET all, POST create
│   │   └── [logId]/route.ts  # GET specific
│   └── statistics/route.ts   # GET audit statistics
└── rate-limit/              # Rate limiting
    └── status/route.ts    # GET rate limit status
```

## Core Features

### 1. Authentication & Authorization
- **Supabase Auth** integration for secure user authentication
- **Role-Based Access Control (RBAC)** with granular permissions
- **Row-Level Security (RLS)** enforcement at database level
- **JWT token** validation for API access

### 2. User Management
- **CRUD operations** for users and profiles
- **Multi-tenant support** with organization-based access
- **Role management** (driver, supervisor, mechanic, org_admin, admin)
- **Profile management** with vehicle and license information

### 3. Trip Management
- **Full CRUD** for trips with status tracking
- **11-step workflow** with modules and items
- **Draft functionality** for partial form completion
- **Submission workflow** (draft → submitted → approved/rejected)
- **Module scoring** and risk level calculation

### 4. Module & Item Management
- **Dynamic module creation** for the 11-step workflow
- **Flexible item types** (checkbox, radio, text, number, etc.)
- **Critical item tracking** with automatic failure detection
- **Real-time scoring** based on item values

### 5. Sign-offs & Approvals
- **Digital signature** collection
- **Role-based sign-offs** (driver, supervisor, mechanic)
- **Approval workflow** with status management
- **Audit trail** for all approval actions

### 6. Critical Failure Tracking
- **Automatic detection** of critical item failures
- **Point-based severity** tracking
- **Resolution management** for critical issues
- **Override logic** for high-risk scenarios

### 7. Rate Limiting
- **Per-user rate limits** by endpoint type
- **Configurable windows** and request limits
- **Automatic cleanup** of old entries
- **Rate limit headers** in API responses

### 8. Audit Logging
- **Comprehensive logging** of all CRUD operations
- **Metadata storage** for detailed context
- **Role-based log access** (users see own, admins see all)
- **Statistical analysis** of audit data

### 9. RPC Functions
- **Email lookup** for user identification
- **Permission checking** for dynamic access control
- **Trip score calculation** with module aggregation
- **Critical override analysis** for approval decisions

### 10. Server Helpers
- **Current user fetching** with profile data
- **Role-based trip filtering** and access control
- **Dashboard statistics** and analytics
- **Organization-based data** segregation

## API Response Format

All API endpoints follow a consistent response format:

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
```

## Error Handling

- **Structured error responses** with appropriate HTTP status codes
- **Validation errors** return 400 status
- **Authentication errors** return 401 status
- **Authorization errors** return 403 status
- **Not found errors** return 404 status
- **Rate limit errors** return 429 status
- **Server errors** return 500 status

## Rate Limiting

Rate limits are applied per user per endpoint:

| Endpoint Type | Max Requests | Window |
|---------------|---------------|---------|
| Default | 100 | 60 seconds |
| Auth | 5 | 60 seconds |
| Approve | 20 | 60 seconds |
| Upload | 10 | 60 seconds |
| Export | 5 | 300 seconds |

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when window resets
- `Retry-After`: Seconds until next request is allowed

## Security Features

### Row-Level Security (RLS)
- **Database-level access control** for all tables
- **User-based filtering** for personal data
- **Organization-based filtering** for shared data
- **Admin bypass** for full system access

### Input Validation
- **Required field validation** on all endpoints
- **Type checking** for all input parameters
- **SQL injection prevention** through parameterized queries
- **XSS protection** through proper data sanitization

### Audit Trail
- **Automatic logging** of all data modifications
- **User attribution** for all actions
- **Timestamp tracking** for compliance
- **Metadata preservation** for forensic analysis

## Database Schema

The API supports the following main tables:

- **users** - User accounts and roles
- **profiles** - Extended user information
- **organizations** - Multi-tenant support
- **trips** - Main trip records
- **trip_modules** - 11-step workflow modules
- **module_items** - Individual form questions
- **trip_drafts** - Partial form saves
- **sign_offs** - Digital signatures
- **critical_failures** - High-priority issues
- **audit_logs** - System activity tracking
- **rate_limit_logs** - Rate limiting data

## Usage Examples

### Create a New Trip
```typescript
POST /api/trips
{
  "trip_date": "2024-01-15",
  "route": "Lusaka to Livingstone",
  "initialize_modules": true
}
```

### Submit Trip for Approval
```typescript
PUT /api/trips/[tripId]
{
  "status": "submitted"
}
```

### Create Sign-off
```typescript
POST /api/trips/[tripId]/signoffs
{
  "role": "supervisor",
  "name": "John Supervisor",
  "signature": "base64-encoded-signature"
}
```

### Calculate Trip Score
```typescript
POST /api/rpc/calculate-trip-score
{
  "trip_id": "uuid-here"
}
```

### Check Rate Limit Status
```typescript
GET /api/rate-limit/status?endpoint=approve
```

## Development Setup

1. **Environment Variables**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Database Setup**:
   - Run the SQL migrations in `scripts/init-database.sql`
   - Enable RLS policies as defined in the schema
   - Create test users with appropriate roles

3. **API Testing**:
   - Use the provided test endpoints
   - Verify rate limiting behavior
   - Test role-based access control

## Best Practices

1. **Always include** the `x-user-id` header for authenticated requests
2. **Handle rate limit** responses gracefully with retry logic
3. **Validate responses** using the TypeScript interfaces provided
4. **Use the RPC endpoints** for complex operations
5. **Implement proper error handling** for all API calls
6. **Log all user actions** through the audit endpoints
7. **Respect role permissions** when building UI features
8. **Use draft functionality** for better user experience

## Monitoring & Analytics

The system provides comprehensive monitoring through:
- **Audit log statistics** for compliance reporting
- **Rate limiting metrics** for API usage analysis
- **Trip analytics** for safety insights
- **User activity tracking** for system utilization

This API layer provides a complete, secure, and scalable foundation for the Fleet Pre-Trip Safety & Management System.
