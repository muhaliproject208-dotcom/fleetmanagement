"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">Initial Setup Required</CardTitle>
            <CardDescription className="text-amber-800">
              Configure your Supabase credentials to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-amber-300 bg-white">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle>Environment Variables Missing</AlertTitle>
              <AlertDescription className="text-amber-900">
                Your Supabase project credentials are not configured. Follow the steps below to set them up.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Step 1: Get Your Supabase Credentials</h3>
                <ol className="list-decimal list-inside space-y-2 text-slate-700">
                  <li>Go to your Supabase project dashboard</li>
                  <li>Click on "Settings" → "API"</li>
                  <li>Copy your Project URL and Anon Key</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Step 2: Add Environment Variables</h3>
                <ol className="list-decimal list-inside space-y-2 text-slate-700">
                  <li>Click the "Vars" section in your deployment platform sidebar</li>
                  <li>
                    Add the following variables:
                    <ul className="list-disc list-inside ml-4 mt-2 space-y-1 font-mono text-sm">
                      <li>NEXT_PUBLIC_SUPABASE_URL (your Project URL)</li>
                      <li>NEXT_PUBLIC_SUPABASE_ANON_KEY (your Anon Key)</li>
                    </ul>
                  </li>
                  <li>Click "Save" and refresh the page</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Step 3: Create Database Tables</h3>
                <ol className="list-decimal list-inside space-y-2 text-slate-700">
                  <li>In your Supabase dashboard, go to SQL Editor</li>
                  <li>Copy and run the SQL from README.md (Database Schema section)</li>
                  <li>This creates all required tables and policies</li>
                </ol>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-900">
                  <strong>Need help?</strong> Check the README.md for complete setup instructions and database schema
                  details.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
