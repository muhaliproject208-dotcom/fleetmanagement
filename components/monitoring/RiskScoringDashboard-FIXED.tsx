'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Shield,
  Activity,
  BarChart3,
  RefreshCw,
  Info,
  Zap
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface RiskScoringDashboardProps {
  tripId: string
  className?: string
}

interface RiskScoreBreakdown {
  preTripScore: number
  inTripScore: number
  postTripScore: number
  totalScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  complianceStatus: 'compliant' | 'conditional' | 'non_compliant'
  factors: RiskFactor[]
}

interface ModuleRiskScore {
  moduleId: string
  moduleName: string
  step: number
  score: number
  maxScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  criticalItems: number
  totalItems: number
  completionRate: number
}

interface RiskFactor {
  category: string
  weight: number
  score: number
  impact: 'low' | 'medium' | 'high' | 'critical'
  description: string
  mitigatingActions?: string[]
}

export default function RiskScoringDashboard({ 
  tripId, 
  className 
}: RiskScoringDashboardProps) {
  const [riskData, setRiskData] = useState<RiskScoreBreakdown | null>(null)
  const [moduleScores, setModuleScores] = useState<ModuleRiskScore[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [userRole, setUserRole] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [canRecalculate, setCanRecalculate] = useState<boolean>(false)
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  // Get current user session and role
  useEffect(() => {
    const getUserSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserId(session.user.id)
        
        // Get user role from profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        
        if (profile) {
          setUserRole(profile.role)
          // Set recalculation permissions
          setCanRecalculate(['admin', 'supervisor', 'org_admin'].includes(profile.role))
        }
      }
    }
    
    getUserSession()
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (session?.user) {
        setUserId(session.user.id)
        getUserSession()
      } else {
        setUserId('')
        setUserRole('')
        setCanRecalculate(false)
      }
    })
    
    return () => subscription.unsubscribe()
  }, [supabase])

  // Fetch risk scoring data with proper authentication
  const fetchRiskData = async () => {
    try {
      setLoading(true)
      
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('User not authenticated')
      }
      
      const response = await fetch(`/api/trips/${tripId}/risk-scoring?include_modules=true&include_trend=true`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Validate data structure and permissions
        if (data.success && data.data) {
          setRiskData(data.data.comprehensiveRiskScore)
          setModuleScores(data.data.moduleRiskScores || [])
          setLastUpdate(new Date())
        } else {
          throw new Error(data.error || 'Invalid response format')
        }
      } else if (response.status === 401) {
        throw new Error('Authentication failed - please log in again')
      } else if (response.status === 403) {
        throw new Error('Access denied - insufficient permissions')
      } else if (response.status === 404) {
        throw new Error('Trip not found or access denied')
      } else {
        throw new Error('Failed to fetch risk scoring data')
      }
    } catch (error) {
      console.error('Error fetching risk data:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch risk scoring data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Initial data fetch
  useEffect(() => {
    if (tripId && userId) {
      fetchRiskData()
    }
  }, [tripId, userId])

  // Handle manual recalculation with proper permissions
  const recalculateScores = async () => {
    try {
      if (!canRecalculate) {
        throw new Error('You do not have permission to recalculate risk scores')
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('User not authenticated')
      }

      const response = await fetch(`/api/trips/${tripId}/risk-scoring/recalculate`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          updateComplianceStatus: true,
          requestedBy: userId,
          userRole: userRole
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        if (data.success && data.data) {
          setRiskData(data.data.comprehensiveRiskScore)
          setModuleScores(data.data.moduleRiskScores || [])
          setLastUpdate(new Date())
          
          toast({
            title: "Scores Recalculated",
            description: `Risk scores updated. Total score changed by ${data.data.changes.scoreChange > 0 ? '+' : ''}${data.data.changes.scoreChange} points.`,
          })
        } else {
          throw new Error(data.error || 'Invalid response format')
        }
      } else if (response.status === 403) {
        throw new Error('Access denied - insufficient permissions to recalculate scores')
      } else {
        throw new Error('Failed to recalculate scores')
      }
    } catch (error) {
      console.error('Error recalculating scores:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to recalculate risk scores",
        variant: "destructive"
      })
    }
  }

  // Get risk level color and styling
  const getRiskLevelStyling = (level: string) => {
    switch (level) {
      case 'critical':
        return {
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          borderColor: 'border-red-200',
          icon: AlertTriangle,
          iconColor: 'text-red-600'
        }
      case 'high':
        return {
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-800',
          borderColor: 'border-orange-200',
          icon: AlertTriangle,
          iconColor: 'text-orange-600'
        }
      case 'medium':
        return {
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          borderColor: 'border-yellow-200',
          icon: Info,
          iconColor: 'text-yellow-600'
        }
      default:
        return {
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-200',
          icon: CheckCircle,
          iconColor: 'text-green-600'
        }
    }
  }

  // Get compliance status styling
  const getComplianceStyling = (status: string) => {
    switch (status) {
      case 'non_compliant':
        return {
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          label: 'Non-Compliant'
        }
      case 'conditional':
        return {
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          label: 'Conditional'
        }
      default:
        return {
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          label: 'Compliant'
        }
    }
  }

  // Get score percentage for progress bars
  const getScorePercentage = (score: number, maxScore: number = 100) => {
    return Math.min((score / maxScore) * 100, 100)
  }

  if (!userId) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Please log in to view risk scoring data</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading risk scoring data...</span>
      </div>
    )
  }

  if (!riskData) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No risk scoring data available</p>
        </div>
      </div>
    )
  }

  const riskStyling = getRiskLevelStyling(riskData.riskLevel)
  const complianceStyling = getComplianceStyling(riskData.complianceStatus)
  const RiskIcon = riskStyling.icon

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Risk Scoring Dashboard</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchRiskData}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          {canRecalculate && (
            <Button 
              size="sm" 
              onClick={recalculateScores}
              disabled={loading}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Recalculate
            </Button>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Risk Score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Risk Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{riskData.totalScore}</div>
              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${riskStyling.bgColor} ${riskStyling.textColor}`}>
                <RiskIcon className={`h-3 w-3 mr-1 ${riskStyling.iconColor}`} />
                {riskData.riskLevel.toUpperCase()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Status</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${complianceStyling.bgColor} ${complianceStyling.textColor}`}>
                {complianceStyling.label}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pre-Trip Score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pre-Trip Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{riskData.preTripScore}</div>
              <Progress value={getScorePercentage(riskData.preTripScore)} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* In-Trip Score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In-Trip Score</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{riskData.inTripScore}</div>
              <Progress value={getScorePercentage(riskData.inTripScore)} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Module Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Module Risk Scores</CardTitle>
          <CardDescription>
            Risk assessment for each trip module
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {moduleScores.map((module) => {
              const moduleRiskStyling = getRiskLevelStyling(module.riskLevel)
              const ModuleRiskIcon = moduleRiskStyling.icon
              
              return (
                <div 
                  key={module.moduleId} 
                  className={`p-4 rounded-lg border ${moduleRiskStyling.borderColor} ${moduleRiskStyling.bgColor}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <ModuleRiskIcon className={`h-5 w-5 ${moduleRiskStyling.iconColor}`} />
                      <div>
                        <div className="font-medium">
                          Step {module.step}: {module.moduleName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {module.criticalItems} critical items • {module.totalItems} total items
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{module.score}</div>
                      <div className="text-sm text-muted-foreground">
                        {module.completionRate === 1.0 ? 'Completed' : `${Math.round(module.completionRate * 100)}% complete`}
                      </div>
                    </div>
                  </div>
                  <Progress 
                    value={getScorePercentage(module.score, module.maxScore)} 
                    className="h-2 mt-3" 
                  />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Risk Factors */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Factors Analysis</CardTitle>
          <CardDescription>
            Key factors contributing to overall risk score
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {riskData.factors
              .sort((a, b) => b.score - a.score)
              .slice(0, 10)
              .map((factor, index) => {
                const factorStyling = getRiskLevelStyling(factor.impact)
                const FactorIcon = factorStyling.icon
                
                return (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border ${factorStyling.borderColor} ${factorStyling.bgColor}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <FactorIcon className={`h-5 w-5 mt-0.5 ${factorStyling.iconColor}`} />
                        <div className="flex-1">
                          <div className="font-medium">{factor.category}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {factor.description}
                          </div>
                          {factor.mitigatingActions && factor.mitigatingActions.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs font-medium mb-1">Recommended Actions:</div>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {factor.mitigatingActions.map((action, actionIndex) => (
                                  <li key={actionIndex} className="flex items-center">
                                    <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                                    {action}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{factor.score}</div>
                        <div className="text-sm text-muted-foreground">
                          Weight: {factor.weight}x
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={`text-xs mt-1 ${factorStyling.bgColor} ${factorStyling.textColor}`}
                        >
                          {factor.impact}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
