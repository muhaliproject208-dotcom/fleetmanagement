import '@testing-library/jest-dom'

// Mock Supabase for testing
jest.mock('@/lib/supabase-client', () => ({
  getSupabaseClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      eq: jest.fn(),
      single: jest.fn(),
    })),
  })),
}))

jest.mock('@/lib/supabase-server', () => ({
  getSupabaseServer: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      eq: jest.fn(),
      single: jest.fn(),
    })),
  })),
}))

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  })),
  useParams: jest.fn(() => ({})),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(),
    getAll: jest.fn(),
    has: jest.fn(),
    entries: jest.fn(),
  })),
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
