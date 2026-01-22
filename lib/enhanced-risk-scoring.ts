// Enhanced Risk Scoring System for IFSM Compliance
// Provides comprehensive risk calculation across all trip phases

import { CHECKLIST_MODULES, ModuleKey } from './checklist-mapping'

export interface RiskScoreBreakdown {
  preTripScore: number
  inTripScore: number
  postTripScore: number
  totalScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  complianceStatus: 'compliant' | 'conditional' | 'non_compliant'
  factors: RiskFactor[]
}

export interface RiskFactor {
  category: string
  weight: number
  score: number
  impact: 'low' | 'medium' | 'high' | 'critical'
  description: string
  mitigatingActions?: string[]
}

export interface ModuleRiskScore {
  moduleId: string
  moduleName: string
  step: number
  score: number
  maxScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  criticalItems: number
  totalItems: number
  completionRate: number
  factors: RiskFactor[]
}

// Risk scoring weights for different phases
const RISK_WEIGHTS = {
  pre_trip: 0.4,      // 40% of total risk
  in_trip: 0.4,        // 40% of total risk  
  post_trip: 0.2,       // 20% of total risk
}

// Module-specific risk multipliers
const MODULE_RISK_MULTIPLIERS = {
  DRIVER_INFO: 0.8,           // Lower risk - administrative
  HEALTH_FITNESS: 1.5,        // Higher risk - safety critical
  DOCUMENTATION: 1.2,          // Medium risk - compliance
  EXTERIOR_INSPECTION: 1.8,   // High risk - vehicle safety
  ENGINE_FLUIDS: 1.6,         // High risk - mechanical safety
  INTERIOR_CABIN: 1.4,         // Medium-high risk - driver safety
  FUNCTIONAL_CHECKS: 2.0,      // Highest risk - operational safety
  SAFETY_EQUIPMENT: 1.7,        // High risk - emergency preparedness
  FINAL_VERIFICATION: 1.3,      // Medium risk - final checks
  RISK_SCORING: 0.0,           // Not applicable - scoring module
  SIGN_OFF: 0.5,               // Lower risk - administrative
}

// Critical item weightings
const CRITICAL_ITEM_WEIGHTS: Record<string, number> = {
  'Alcohol Breath Test/Drugs': 5.0,
  'Temperature Check': 3.0,
  'Brakes: Test brake function': 5.0,
  'Tires: Check for proper inflation': 4.0,
  'Lights: Ensure headlights, taillights': 4.0,
  'All critical defects rectified': 5.0,
  'Vehicle safe and ready for dispatch': 5.0,
}

/**
 * Calculate comprehensive risk score for a trip
 */
export async function calculateComprehensiveRiskScore(
  tripId: string,
  supabase: any
): Promise<RiskScoreBreakdown> {
  try {
    // Get pre-trip data
    const preTripScore = await calculatePreTripRiskScore(tripId, supabase)
    
    // Get in-trip data
    const inTripScore = await calculateInTripRiskScore(tripId, supabase)
    
    // Get post-trip data
    const postTripScore = await calculatePostTripRiskScore(tripId, supabase)
    
    // Calculate weighted total score
    const totalScore = Math.round(
      (preTripScore.score * RISK_WEIGHTS.pre_trip) +
      (inTripScore.score * RISK_WEIGHTS.in_trip) +
      (postTripScore.score * RISK_WEIGHTS.post_trip)
    )
    
    // Determine overall risk level
    const riskLevel = determineRiskLevel(totalScore)
    
    // Determine compliance status
    const complianceStatus = determineComplianceStatus(
      preTripScore, 
      inTripScore, 
      postTripScore, 
      riskLevel
    )
    
    // Combine all risk factors
    const allFactors = [
      ...preTripScore.factors,
      ...inTripScore.factors,
      ...postTripScore.factors
    ]
    
    return {
      preTripScore: preTripScore.score,
      inTripScore: inTripScore.score,
      postTripScore: postTripScore.score,
      totalScore,
      riskLevel,
      complianceStatus,
      factors: allFactors,
    }
  } catch (error) {
    console.error('Error calculating comprehensive risk score:', error)
    throw error
  }
}

/**
 * Calculate pre-trip risk score
 */
async function calculatePreTripRiskScore(
  tripId: string, 
  supabase: any
): Promise<{ score: number; factors: RiskFactor[] }> {
  const factors: RiskFactor[] = []
  let totalScore = 0

  try {
    // Get all trip modules with items
    const { data: modules } = await supabase
      .from('trip_modules')
      .select(`
        *,
        module_items (
          label,
          field_type,
          critical,
          points,
          value
        )
      `)
      .eq('trip_id', tripId)

    if (!modules || modules.length === 0) {
      return { score: 0, factors: [] }
    }

    // Calculate score for each module
    for (const module of modules) {
      const moduleScore = calculateModuleRiskScore(module)
      totalScore += moduleScore.score
      
      // Add module-specific risk factors
      factors.push(...moduleScore.factors)
    }

    // Add completion rate factor
    const completedModules = modules.filter((m: any) => m.status === 'completed').length
    const completionRate = completedModules / modules.length
    
    if (completionRate < 1.0) {
      factors.push({
        category: 'Pre-trip Completion',
        weight: 2.0,
        score: (1.0 - completionRate) * 20,
        impact: completionRate < 0.8 ? 'high' : 'medium',
        description: `${Math.round((1.0 - completionRate) * 100)}% of pre-trip modules incomplete`,
        mitigatingActions: ['Complete all required pre-trip checks', 'Address critical failures immediately'],
      })
    }

    return { score: totalScore, factors }
  } catch (error) {
    console.error('Error calculating pre-trip risk score:', error)
    return { score: 0, factors: [] }
  }
}

/**
 * Calculate in-trip risk score
 */
async function calculateInTripRiskScore(
  tripId: string, 
  supabase: any
): Promise<{ score: number; factors: RiskFactor[] }> {
  const factors: RiskFactor[] = []
  let totalScore = 0

  try {
    // Get speed violations
    const { data: violations } = await supabase
      .from('speed_violations')
      .select('*')
      .eq('trip_id', tripId)

    if (violations && violations.length > 0) {
      const violationScore = violations.reduce((sum: number, v: any) => {
        return sum + (v.points_deducted || 0)
      }, 0)
      
      totalScore += violationScore
      
      factors.push({
        category: 'Speed Violations',
        weight: 3.0,
        score: violationScore,
        impact: violationScore > 10 ? 'critical' : violationScore > 5 ? 'high' : 'medium',
        description: `${violations.length} speed violations detected (${violationScore} points)`,
        mitigatingActions: ['Driver training', 'Route planning', 'Speed monitoring'],
      })
    }

    // Get fatigue monitoring data
    const { data: fatigueData } = await supabase
      .from('fatigue_monitoring')
      .select('*')
      .eq('trip_id', tripId)
      .order('timestamp', { ascending: false })
      .limit(1)

    if (fatigueData && fatigueData.length > 0) {
      const latestFatigue = fatigueData[0]
      const fatigueScore = calculateFatigueRiskScore(latestFatigue)
      totalScore += fatigueScore.score
      
      if (fatigueScore.score > 0) {
        factors.push({
          category: 'Driver Fatigue',
          weight: 2.5,
          score: fatigueScore.score,
          impact: fatigueScore.impact,
          description: `Fatigue level: ${latestFatigue.alert_level} (Score: ${latestFatigue.fatigue_score})`,
          mitigatingActions: ['Implement rest breaks', 'Adjust schedule', 'Monitor driver health'],
        })
      }
    }

    // Get in-trip incidents
    const { data: incidents } = await supabase
      .from('in_trip_incidents')
      .select('*')
      .eq('trip_id', tripId)

    if (incidents && incidents.length > 0) {
      const incidentScore = incidents.reduce((sum: number, incident: any) => {
        const severityMultiplier = incident.severity === 'critical' ? 10 : 
                               incident.severity === 'major' ? 5 : 
                               incident.severity === 'minor' ? 2 : 1
        return sum + severityMultiplier
      }, 0)
      
      totalScore += incidentScore
      
      factors.push({
        category: 'In-trip Incidents',
        weight: 4.0,
        score: incidentScore,
        impact: incidentScore > 10 ? 'critical' : incidentScore > 5 ? 'high' : 'medium',
        description: `${incidents.length} incidents reported during trip`,
        mitigatingActions: ['Incident investigation', 'Safety protocol review', 'Emergency response training'],
      })
    }

    // Get real-time alerts
    const { data: alerts } = await supabase
      .from('real_time_alerts')
      .select('*')
      .eq('trip_id', tripId)
      .eq('acknowledged', false)

    if (alerts && alerts.length > 0) {
      const alertScore = alerts.reduce((sum: number, alert: any) => {
        const severityMultiplier = alert.severity === 'emergency' ? 5 :
                               alert.severity === 'critical' ? 3 :
                               alert.severity === 'warning' ? 1 : 0.5
        return sum + severityMultiplier
      }, 0)
      
      totalScore += alertScore
      
      factors.push({
        category: 'Unacknowledged Alerts',
        weight: 2.0,
        score: alertScore,
        impact: alertScore > 5 ? 'high' : 'medium',
        description: `${alerts.length} unacknowledged alerts`,
        mitigatingActions: ['Alert monitoring', 'Response procedures', 'Communication protocols'],
      })
    }

    return { score: totalScore, factors }
  } catch (error) {
    console.error('Error calculating in-trip risk score:', error)
    return { score: 0, factors: [] }
  }
}

/**
 * Calculate post-trip risk score
 */
async function calculatePostTripRiskScore(
  tripId: string, 
  supabase: any
): Promise<{ score: number; factors: RiskFactor[] }> {
  const factors: RiskFactor[] = []
  let totalScore = 0

  try {
    // Get post-trip inspection
    const { data: inspection } = await supabase
      .from('post_trip_inspections')
      .select(`
        *,
        post_trip_inspection_items (
          category,
          condition_status,
          requires_maintenance,
          maintenance_priority,
          points_deducted,
          critical
        )
      `)
      .eq('trip_id', tripId)
      .single()

    if (inspection) {
      totalScore += inspection.total_score || 0
      
      // Add inspection completion factor
      if (inspection.status !== 'completed') {
        factors.push({
          category: 'Post-trip Inspection',
          weight: 1.5,
          score: 10,
          impact: 'medium',
          description: 'Post-trip inspection not completed',
          mitigatingActions: ['Complete inspection', 'Document findings', 'Schedule maintenance'],
        })
      }

      // Add maintenance requirements factor
      if (inspection.post_trip_inspection_items) {
        const maintenanceItems = inspection.post_trip_inspection_items.filter(
          (item: any) => item.requires_maintenance
        )
        
        if (maintenanceItems.length > 0) {
          const maintenanceScore = maintenanceItems.reduce((sum: number, item: any) => {
            const priorityMultiplier = item.maintenance_priority === 'urgent' ? 3 :
                                   item.maintenance_priority === 'high' ? 2 :
                                   item.maintenance_priority === 'medium' ? 1 : 0.5
            return sum + (item.points_deducted * priorityMultiplier)
          }, 0)
          
          totalScore += maintenanceScore
          
          factors.push({
            category: 'Maintenance Requirements',
            weight: 2.0,
            score: maintenanceScore,
            impact: maintenanceScore > 10 ? 'high' : 'medium',
            description: `${maintenanceItems.length} maintenance items required`,
            mitigatingActions: ['Schedule maintenance', 'Order parts', 'Plan vehicle downtime'],
          })
        }
      }
    } else {
      // No post-trip inspection - high risk
      totalScore += 15
      factors.push({
        category: 'Post-trip Inspection',
        weight: 3.0,
        score: 15,
        impact: 'high',
        description: 'Post-trip inspection not conducted',
        mitigatingActions: ['Conduct inspection immediately', 'Document vehicle condition', 'Schedule maintenance if needed'],
      })
    }

    // Get fuel tracking data
    const { data: fuelData } = await supabase
      .from('fuel_tracking')
      .select('*')
      .eq('trip_id', tripId)
      .single()

    if (fuelData && fuelData.consumption_anomaly) {
      totalScore += 5
      factors.push({
        category: 'Fuel Consumption',
        weight: 1.0,
        score: 5,
        impact: 'medium',
        description: 'Fuel consumption anomaly detected',
        mitigatingActions: ['Investigate fuel efficiency', 'Check for leaks', 'Review driving behavior'],
      })
    }

    return { score: totalScore, factors }
  } catch (error) {
    console.error('Error calculating post-trip risk score:', error)
    return { score: 0, factors: [] }
  }
}

/**
 * Calculate risk score for a specific module
 */
function calculateModuleRiskScore(module: any): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = []
  let score = 0

  if (!module.module_items || module.module_items.length === 0) {
    return { score: 0, factors: [] }
  }

  const moduleKey = Object.keys(CHECKLIST_MODULES).find(
    key => CHECKLIST_MODULES[key as ModuleKey].name === module.name
  ) as ModuleKey

  const multiplier = MODULE_RISK_MULTIPLIERS[moduleKey] || 1.0

  // Calculate score from items
  for (const item of module.module_items) {
    if (!item.critical) continue

    let itemScore = 0

    // Calculate score based on field type and value
    if (item.field_type === 'pass_fail' && item.value === 'fail') {
      itemScore = item.points || 1
    } else if (item.field_type === 'yes_no' && item.value === 'no') {
      itemScore = item.points || 1
    } else if (item.field_type === 'number' && item.value > 0) {
      itemScore = item.value
    }

    // Apply critical item weighting
    const criticalWeight = CRITICAL_ITEM_WEIGHTS[item.label] || 1.0
    itemScore *= criticalWeight

    score += itemScore
  }

  // Apply module multiplier
  score = Math.round(score * multiplier)

  // Add critical failure factor
  const criticalFailures = module.module_items.filter(
    (item: any) => item.critical && (
      (item.field_type === 'pass_fail' && item.value === 'fail') ||
      (item.field_type === 'yes_no' && item.value === 'no')
    )
  )

  if (criticalFailures.length > 0) {
    factors.push({
      category: 'Critical Failures',
      weight: 3.0,
      score: criticalFailures.length * 5,
      impact: criticalFailures.length > 2 ? 'critical' : 'high',
      description: `${criticalFailures.length} critical item failures in ${module.name}`,
      mitigatingActions: ['Immediate rectification', 'Supervisor notification', 'Trip delay if necessary'],
    })
  }

  return { score, factors }
}

/**
 * Calculate fatigue risk score
 */
function calculateFatigueRiskScore(fatigueData: any): { score: number; impact: 'low' | 'medium' | 'high' | 'critical' } {
  let score = 0
  let impact: 'low' | 'medium' | 'high' | 'critical' = 'low'

  if (fatigueData.alert_level === 'critical') {
    score = 15
    impact = 'critical'
  } else if (fatigueData.alert_level === 'warning') {
    score = 8
    impact = 'high'
  } else if (fatigueData.alert_level === 'caution') {
    score = 4
    impact = 'medium'
  }

  // Add hours-based scoring
  if (fatigueData.hours_driven > 12) {
    score += 10
    impact = 'critical'
  } else if (fatigueData.hours_driven > 8) {
    score += 5
    impact = impact === 'critical' ? 'critical' : 'high'
  }

  return { score, impact }
}

/**
 * Determine risk level from score
 */
function determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score <= 10) return 'low'
  if (score <= 25) return 'medium'
  if (score <= 50) return 'high'
  return 'critical'
}

/**
 * Determine compliance status
 */
function determineComplianceStatus(
  preTrip: { score: number },
  inTrip: { score: number },
  postTrip: { score: number },
  riskLevel: string
): 'compliant' | 'conditional' | 'non_compliant' {
  // Non-compliant if any phase has critical issues
  if (riskLevel === 'critical' || inTrip.score > 30) {
    return 'non_compliant'
  }

  // Conditional if moderate issues exist
  if (riskLevel === 'high' || preTrip.score > 15 || postTrip.score > 10) {
    return 'conditional'
  }

  // Compliant if all phases are acceptable
  return 'compliant'
}

/**
 * Get module risk scores for a trip
 */
export async function getModuleRiskScores(
  tripId: string,
  supabase: any
): Promise<ModuleRiskScore[]> {
  try {
    const { data: modules } = await supabase
      .from('trip_modules')
      .select(`
        *,
        module_items (
          label,
          field_type,
          critical,
          points,
          value
        )
      `)
      .eq('trip_id', tripId)
      .order('step', { ascending: true })

    if (!modules || modules.length === 0) {
      return []
    }

    return modules.map((module: any) => {
      const moduleScore = calculateModuleRiskScore(module)
      const totalItems = module.module_items?.length || 0
      const criticalItems = module.module_items?.filter((item: any) => item.critical).length || 0
      const completionRate = module.status === 'completed' ? 1.0 : 0.0

      return {
        moduleId: module.id,
        moduleName: module.name,
        step: module.step,
        score: moduleScore.score,
        maxScore: 100, // Normalized max score
        riskLevel: determineRiskLevel(moduleScore.score),
        criticalItems,
        totalItems,
        completionRate,
        factors: moduleScore.factors,
      }
    })
  } catch (error) {
    console.error('Error getting module risk scores:', error)
    return []
  }
}

/**
 * Calculate trend analysis for risk scores
 */
export async function calculateRiskTrend(
  driverId: string,
  days: number,
  supabase: any
): Promise<any> {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: trips } = await supabase
      .from('trips')
      .select('id, trip_date, aggregate_score, risk_level, status')
      .eq('driver_id', driverId)
      .gte('trip_date', startDate)
      .order('trip_date', { ascending: true })

    if (!trips || trips.length === 0) {
      return {
        trend: 'insufficient_data',
        averageScore: 0,
        riskDistribution: {},
        improvementRate: 0,
      }
    }

    const completedTrips = trips.filter((trip: any) => trip.status === 'completed' || trip.status === 'fully_completed')
    const averageScore = completedTrips.reduce((sum: number, trip: any) => sum + (trip.aggregate_score || 0), 0) / completedTrips.length

    const riskDistribution = completedTrips.reduce((dist: any, trip: any) => {
      dist[trip.risk_level] = (dist[trip.risk_level] || 0) + 1
      return dist
    }, {})

    // Calculate improvement rate (simple trend)
    let improvementRate = 0
    if (completedTrips.length >= 2) {
      const recent = completedTrips.slice(-Math.ceil(completedTrips.length / 2))
      const older = completedTrips.slice(0, Math.floor(completedTrips.length / 2))
      
      const recentAvg = recent.reduce((sum: number, trip: any) => sum + (trip.aggregate_score || 0), 0) / recent.length
      const olderAvg = older.reduce((sum: number, trip: any) => sum + (trip.aggregate_score || 0), 0) / older.length
      
      improvementRate = ((olderAvg - recentAvg) / olderAvg) * 100
    }

    return {
      trend: improvementRate > 10 ? 'improving' : improvementRate < -10 ? 'declining' : 'stable',
      averageScore,
      riskDistribution,
      improvementRate,
      totalTrips: completedTrips.length,
    }
  } catch (error) {
    console.error('Error calculating risk trend:', error)
    return {
      trend: 'error',
      averageScore: 0,
      riskDistribution: {},
      improvementRate: 0,
    }
  }
}
