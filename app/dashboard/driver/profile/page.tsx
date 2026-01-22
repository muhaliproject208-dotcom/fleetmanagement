'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AvatarUpload } from '@/components/ui/avatar-upload'
import { useToast } from '@/components/ui/use-toast'
import { ProfileService, DriverProfile, Certification, SafetySummary, CriticalFailure, AuditLog } from '@/lib/profile-service'
import { getSupabaseClient } from '@/lib/supabase-client'
import { 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Edit2, 
  Save, 
  X, 
  Car, 
  Award, 
  FileText, 
  Activity,
  Truck,
  AlertCircle,
  TrendingUp,
  Building,
  CreditCard,
  Heart,
  MapPin
} from 'lucide-react'

export default function DriverProfilePage() {
  const router = useRouter()
  const { toast } = useToast()
  const profileService = new ProfileService()

  const [userId, setUserId] = useState<string>('')
  const [profile, setProfile] = useState<DriverProfile | null>(null)
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [safetySummary, setSafetySummary] = useState<SafetySummary | null>(null)
  const [criticalFailures, setCriticalFailures] = useState<CriticalFailure[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [organizations, setOrganizations] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('personal')
  const [editForm, setEditForm] = useState<Partial<DriverProfile>>({})

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user } } = await getSupabaseClient().auth.getUser()
        if (user) {
          setUserId(user.id)
          await fetchProfileData(user.id)
        } else {
          router.push('/auth')
        }
      } catch (error) {
        console.error('Error fetching user:', error)
        router.push('/auth')
      }
    }
    
    fetchUserData()
  }, [])

  const fetchProfileData = async (userId: string) => {
    try {
      setLoading(true)
      
      const [profileData, certsData, safetyData, failuresData, logsData, orgsData] = await Promise.all([
        profileService.getDriverProfile(userId),
        profileService.getDriverCertifications(userId),
        profileService.getSafetySummary(userId),
        profileService.getCriticalFailures(userId),
        profileService.getAuditLogs(userId),
        profileService.getOrganizations()
      ])

      setProfile(profileData)
      setCertifications(certsData)
      setSafetySummary(safetyData)
      setCriticalFailures(failuresData)
      setAuditLogs(logsData)
      setOrganizations(orgsData)
      
      if (profileData) {
        setEditForm(profileData)
      }
    } catch (error) {
      console.error('Error fetching profile data:', error)
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditToggle = () => {
    if (editing) {
      setEditForm(profile || {})
    }
    setEditing(!editing)
  }

  const handleSaveProfile = async () => {
    if (!profile || !userId) return

    try {
      setSaving(true)
      
      await profileService.updateDriverProfile(userId, editForm)
      
      // Refetch data
      const updatedProfile = await profileService.getDriverProfile(userId)
      setProfile(updatedProfile)
      setEditForm(updatedProfile || {})
      
      setEditing(false)
      toast({
        title: "Success",
        description: "Profile updated successfully"
      })
    } catch (error) {
      console.error('Error saving profile:', error)
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = (avatarUrl: string) => {
    if (profile && userId) {
      setProfile({ ...profile, avatar_url: avatarUrl })
      setEditForm({ ...editForm, avatar_url: avatarUrl })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'bg-green-100 text-green-800'
      case 'expired': return 'bg-red-100 text-red-800'
      case 'expiring_soon': return 'bg-yellow-100 text-yellow-800'
      case 'suspended': return 'bg-orange-100 text-orange-800'
      case 'revoked': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h2>
          <p className="text-gray-600 mb-6">Unable to load your profile information.</p>
          <Button onClick={() => router.push('/dashboard/driver')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900"
              >
                <X className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Driver Compliance Dossier</h1>
                <p className="text-sm text-gray-500">{profile.full_name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleEditToggle}
                variant={editing ? "destructive" : "outline"}
                size="sm"
              >
                {editing ? (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Profile
                  </>
                )}
              </Button>
              {editing && (
                <Button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700"
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-start space-x-6">
              <AvatarUpload
                currentAvatar={profile.avatar_url}
                userId={profile.user_id}
                onAvatarChange={handleAvatarChange}
                size="lg"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{profile.full_name}</h2>
                    <p className="text-gray-600">{profile.email}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(profile.account_status)}>
                      {profile.account_status.toUpperCase()}
                    </Badge>
                    <Badge variant="outline">
                      {profile.access_level.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Building className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Organization:</span>
                    <span className="font-medium">{organizations.find(org => org.id === profile.org_id)?.name || 'Not assigned'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Member Since:</span>
                    <span className="font-medium">{new Date(profile.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Last Login:</span>
                    <span className="font-medium">{profile.last_login ? new Date(profile.last_login).toLocaleDateString() : 'Never'}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="bg-white rounded-xl p-1 border border-gray-200 shadow-sm">
            <nav className="flex space-x-1">
              {[
                { id: 'personal', label: 'Personal Info', icon: User },
                { id: 'licensing', label: 'Licensing & Certifications', icon: CreditCard },
                { id: 'vehicle', label: 'Vehicle Assignment', icon: Truck },
                { id: 'safety', label: 'Safety & Compliance', icon: Shield },
                { id: 'incidents', label: 'Incident History', icon: AlertTriangle },
                { id: 'activity', label: 'Activity & Audit', icon: Activity }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    activeTab === tab.id
                      ? 'bg-green-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'personal' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Personal Information
                </CardTitle>
                <CardDescription>Contact and identity details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    {editing ? (
                      <Input
                        value={editForm.full_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      />
                    ) : (
                      <p className="font-medium">{profile.full_name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <p className="font-medium">{profile.email}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    {editing ? (
                      <Input
                        value={editForm.phone || ''}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                      />
                    ) : (
                      <p className="font-medium">{profile.phone || 'Not provided'}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>National ID / Employee ID</Label>
                    {editing ? (
                      <Input
                        value={editForm.employee_id || ''}
                        onChange={(e) => setEditForm({ ...editForm, employee_id: e.target.value })}
                        placeholder="EMP-12345"
                      />
                    ) : (
                      <p className="font-medium">{profile.employee_id || 'Not provided'}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Heart className="h-5 w-5 mr-2" />
                  Medical Information
                </CardTitle>
                <CardDescription>Medical fitness and health records</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Medical Fitness Status</Label>
                    <Badge className={getStatusColor(profile.medical_fitness_status)}>
                      {profile.medical_fitness_status?.toUpperCase() || 'VALID'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label>Last Medical Check</Label>
                    <p className="font-medium">
                      {profile.last_medical_check ? new Date(profile.last_medical_check).toLocaleDateString() : 'Not provided'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'licensing' && (
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Driver License
                </CardTitle>
                <CardDescription>Licensing information and status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>License Number</Label>
                    {editing ? (
                      <Input
                        value={editForm.license_number || ''}
                        onChange={(e) => setEditForm({ ...editForm, license_number: e.target.value })}
                        placeholder="DL-123456789"
                      />
                    ) : (
                      <p className="font-medium">{profile.license_number || 'Not provided'}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>License Class</Label>
                    {editing ? (
                      <Input
                        value={editForm.license_class || ''}
                        onChange={(e) => setEditForm({ ...editForm, license_class: e.target.value })}
                        placeholder="Class A"
                      />
                    ) : (
                      <p className="font-medium">{profile.license_class || 'Not provided'}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>License Expiry</Label>
                    {editing ? (
                      <Input
                        type="date"
                        value={editForm.license_expiry || ''}
                        onChange={(e) => setEditForm({ ...editForm, license_expiry: e.target.value })}
                      />
                    ) : (
                      <p className="font-medium">
                        {profile.license_expiry ? new Date(profile.license_expiry).toLocaleDateString() : 'Not provided'}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Badge className={
                      profile.license_expiry && new Date(profile.license_expiry) < new Date()
                        ? 'bg-red-100 text-red-800'
                        : profile.license_expiry && new Date(profile.license_expiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }>
                      {profile.license_expiry && new Date(profile.license_expiry) < new Date()
                        ? 'EXPIRED'
                        : profile.license_expiry && new Date(profile.license_expiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        ? 'EXPIRING SOON'
                        : 'VALID'
                    }
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Award className="h-5 w-5 mr-2" />
                    Certifications
                  </div>
                  <Button size="sm" variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    Add Certification
                  </Button>
                </CardTitle>
                <CardDescription>Professional certifications and qualifications</CardDescription>
              </CardHeader>
              <CardContent>
                {certifications.length === 0 ? (
                  <div className="text-center py-8">
                    <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No certifications on record</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {certifications.map((cert) => (
                      <div key={cert.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{cert.certification_type}</h4>
                          <Badge className={getStatusColor(cert.status)}>
                            {cert.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Number:</span> {cert.certification_number || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Expires:</span> {cert.expiry_date ? new Date(cert.expiry_date).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'vehicle' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Truck className="h-5 w-5 mr-2" />
                Vehicle Assignment
              </CardTitle>
              <CardDescription>Current vehicle and route assignment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Assigned Vehicle ID</Label>
                  {editing ? (
                    <Input
                      value={editForm.assigned_vehicle_id || ''}
                      onChange={(e) => setEditForm({ ...editForm, assigned_vehicle_id: e.target.value })}
                      placeholder="VH-001"
                    />
                  ) : (
                    <p className="font-medium">{profile.assigned_vehicle_id || 'Not assigned'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Plate</Label>
                  {editing ? (
                    <Input
                      value={editForm.vehicle_plate || ''}
                      onChange={(e) => setEditForm({ ...editForm, vehicle_plate: e.target.value })}
                      placeholder="ABC-1234"
                    />
                  ) : (
                    <p className="font-medium">{profile.vehicle_plate || 'Not assigned'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Type</Label>
                  {editing ? (
                    <Input
                      value={editForm.vehicle_type || ''}
                      onChange={(e) => setEditForm({ ...editForm, vehicle_type: e.target.value })}
                      placeholder="Heavy Truck"
                    />
                  ) : (
                    <p className="font-medium">{profile.vehicle_type || 'Not assigned'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Depot / Fleet Unit</Label>
                  {editing ? (
                    <Input
                      value={editForm.depot_unit || ''}
                      onChange={(e) => setEditForm({ ...editForm, depot_unit: e.target.value })}
                      placeholder="Central Depot"
                    />
                  ) : (
                    <p className="font-medium">{profile.depot_unit || 'Not assigned'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Primary Route</Label>
                  {editing ? (
                    <Input
                      value={editForm.primary_route || ''}
                      onChange={(e) => setEditForm({ ...editForm, primary_route: e.target.value })}
                      placeholder="Route 42"
                    />
                  ) : (
                    <p className="font-medium">{profile.primary_route || 'Not assigned'}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'safety' && safetySummary && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <FileText className="h-8 w-8 text-blue-600" />
                    <span className="text-2xl font-bold">{safetySummary.total_inspections}</span>
                  </div>
                  <h3 className="font-semibold">Total Inspections</h3>
                  <p className="text-sm text-gray-500">All time</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <span className="text-2xl font-bold">{safetySummary.completed_inspections}</span>
                  </div>
                  <h3 className="font-semibold">Completed</h3>
                  <p className="text-sm text-gray-500">Successfully passed</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Clock className="h-8 w-8 text-yellow-600" />
                    <span className="text-2xl font-bold">{safetySummary.pending_inspections}</span>
                  </div>
                  <h3 className="font-semibold">Pending</h3>
                  <p className="text-sm text-gray-500">Awaiting completion</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="h-8 w-8 text-emerald-600" />
                    <span className="text-2xl font-bold">{safetySummary.approval_rate}%</span>
                  </div>
                  <h3 className="font-semibold">Approval Rate</h3>
                  <p className="text-sm text-gray-500">Success percentage</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Risk Distribution
                </CardTitle>
                <CardDescription>Breakdown of inspection risk levels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{safetySummary.risk_distribution.low}</div>
                    <p className="text-sm text-gray-600">Low Risk</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{safetySummary.risk_distribution.medium}</div>
                    <p className="text-sm text-gray-600">Medium Risk</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{safetySummary.risk_distribution.high}</div>
                    <p className="text-sm text-gray-600">High Risk</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{safetySummary.risk_distribution.critical}</div>
                    <p className="text-sm text-gray-600">Critical Risk</p>
                  </div>
                </div>
                {safetySummary.last_inspection_date && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600">
                      Last Inspection: {new Date(safetySummary.last_inspection_date).toLocaleDateString()}
                      {safetySummary.last_risk_level && (
                        <span className="ml-2">
                          Risk Level: <Badge className={getRiskColor(safetySummary.last_risk_level)}>
                            {safetySummary.last_risk_level.toUpperCase()}
                          </Badge>
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'incidents' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Critical Failures & Incidents
              </CardTitle>
              <CardDescription>Safety incidents and critical issues</CardDescription>
            </CardHeader>
            <CardContent>
              {criticalFailures.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <p className="text-gray-500">No critical failures on record</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {criticalFailures.map((failure) => (
                    <div key={failure.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{failure.failure_category}</h4>
                        <Badge className={getRiskColor(failure.severity)}>
                          {failure.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-gray-600 text-sm mb-2">{failure.description}</p>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>{new Date(failure.created_at).toLocaleDateString()}</span>
                        <Badge className={failure.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {failure.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'activity' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Activity & Audit Trail
              </CardTitle>
              <CardDescription>System actions and profile changes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No activity recorded</p>
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="font-medium text-sm">{log.action}</p>
                          <p className="text-xs text-gray-500">
                            {log.resource_type && `${log.resource_type} • `}
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
