/**
 * Enhanced Member Management Component
 * Comprehensive member management with family relationships, dependents, benefit years, and enrollment tracking
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  User, 
  Calendar, 
  Clock, 
  Shield, 
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Baby,
  Heart,
  UserPlus,
  CalendarDays,
  Timer,
  DollarSign
} from 'lucide-react';
import { CurrencyUtils } from '@/lib/currency-enhanced';
import { apiClient } from '@/lib/api-enhanced';
import type { Patient } from '@/types/medical-aid-enhanced';

interface FamilyMember {
  id: number;
  member_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  relationship: 'PRINCIPAL' | 'SPOUSE' | 'CHILD' | 'DEPENDENT';
  enrollment_date: string;
  benefit_year_start: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'WAITING';
  waiting_periods: WaitingPeriod[];
  scheme_name: string;
  dependent_code?: string;
  age: number;
}

interface WaitingPeriod {
  id: number;
  benefit_type: string;
  start_date: string;
  end_date: string;
  status: 'ACTIVE' | 'COMPLETED' | 'WAIVED';
  days_remaining: number;
}

interface BenefitYear {
  year: number;
  start_date: string;
  end_date: string;
  is_current: boolean;
  enrollment_anniversary: string;
  days_until_renewal: number;
}

interface Props {
  principalMemberId?: string;
  showAddMember?: boolean;
  compact?: boolean;
}

const RELATIONSHIP_OPTIONS = [
  { value: 'PRINCIPAL', label: 'Principal Member', icon: User },
  { value: 'SPOUSE', label: 'Spouse', icon: Heart },
  { value: 'CHILD', label: 'Child', icon: Baby },
  { value: 'DEPENDENT', label: 'Other Dependent', icon: Users }
];

const STATUS_COLORS = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  WAITING: 'bg-yellow-100 text-yellow-800'
};

export function EnhancedMemberManagement({ principalMemberId, showAddMember = true, compact = false }: Props) {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [principalMember, setPrincipalMember] = useState<FamilyMember | null>(null);
  const [benefitYear, setBenefitYear] = useState<BenefitYear | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);

  const [newMemberForm, setNewMemberForm] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    relationship: 'CHILD' as const,
    enrollment_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (principalMemberId) {
      loadFamilyData();
    } else {
      // Load mock data for demonstration
      loadMockData();
    }
  }, [principalMemberId]);

  const loadFamilyData = async () => {
    setLoading(true);
    try {
      // Load principal member details
      const principalResponse = await apiClient.get(`/patients/${principalMemberId}/`) as any;
      
      // Load family members
      const familyResponse = await apiClient.get(`/patients/${principalMemberId}/family/`) as any;
      const familyData = familyResponse.results || familyResponse || [];

      // Load benefit year information
      const benefitYearResponse = await apiClient.get(`/patients/${principalMemberId}/benefit-year/`) as any;
      
      setPrincipalMember(mapToFamilyMember(principalResponse, 'PRINCIPAL'));
      setFamilyMembers(familyData.map((member: any) => mapToFamilyMember(member, member.relationship)));
      setBenefitYear(benefitYearResponse);

    } catch (err: any) {
      console.error('Failed to load family data:', err);
      // Fallback to mock data
      loadMockData();
    } finally {
      setLoading(false);
    }
  };

  const loadMockData = () => {
    const mockPrincipal: FamilyMember = {
      id: 1,
      member_id: 'MBR-0001',
      first_name: 'John',
      last_name: 'Doe',
      date_of_birth: '1980-05-15',
      relationship: 'PRINCIPAL',
      enrollment_date: '2023-01-01',
      benefit_year_start: '2024-01-01',
      status: 'ACTIVE',
      waiting_periods: [],
      scheme_name: 'Premium Health Plan',
      age: 44
    };

    const mockFamily: FamilyMember[] = [
      {
        id: 2,
        member_id: 'MBR-0001-S1',
        first_name: 'Jane',
        last_name: 'Doe',
        date_of_birth: '1982-08-22',
        relationship: 'SPOUSE',
        enrollment_date: '2023-01-01',
        benefit_year_start: '2024-01-01',
        status: 'ACTIVE',
        waiting_periods: [
          {
            id: 1,
            benefit_type: 'Maternity',
            start_date: '2024-06-01',
            end_date: '2024-12-01',
            status: 'ACTIVE',
            days_remaining: 53
          }
        ],
        scheme_name: 'Premium Health Plan',
        dependent_code: 'S1',
        age: 42
      },
      {
        id: 3,
        member_id: 'MBR-0001-D1',
        first_name: 'Emma',
        last_name: 'Doe',
        date_of_birth: '2015-03-10',
        relationship: 'CHILD',
        enrollment_date: '2023-01-01',
        benefit_year_start: '2024-01-01',
        status: 'ACTIVE',
        waiting_periods: [],
        scheme_name: 'Premium Health Plan',
        dependent_code: 'D1',
        age: 9
      }
    ];

    const mockBenefitYear: BenefitYear = {
      year: 2024,
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      is_current: true,
      enrollment_anniversary: '2024-01-01',
      days_until_renewal: 84
    };

    setPrincipalMember(mockPrincipal);
    setFamilyMembers(mockFamily);
    setBenefitYear(mockBenefitYear);
    setLoading(false);
  };

  const mapToFamilyMember = (apiData: any, relationship: string): FamilyMember => {
    const birthDate = new Date(apiData.date_of_birth || apiData.birth_date);
    const age = new Date().getFullYear() - birthDate.getFullYear();
    
    return {
      id: apiData.id,
      member_id: apiData.member_id,
      first_name: apiData.first_name || apiData.user?.first_name,
      last_name: apiData.last_name || apiData.user?.last_name,
      date_of_birth: apiData.date_of_birth || apiData.birth_date,
      relationship: relationship as any,
      enrollment_date: apiData.enrollment_date,
      benefit_year_start: apiData.benefit_year_start || apiData.enrollment_date,
      status: apiData.status || 'ACTIVE',
      waiting_periods: apiData.waiting_periods || [],
      scheme_name: apiData.scheme?.name || 'Unknown Scheme',
      dependent_code: apiData.dependent_code,
      age
    };
  };

  const calculateAge = (birthDate: string): number => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const addFamilyMember = async () => {
    try {
      const memberData = {
        ...newMemberForm,
        principal_member: principalMember?.id,
        age: calculateAge(newMemberForm.date_of_birth)
      };

      const response = await apiClient.post('/patients/', memberData) as any;
      
      const newMember = mapToFamilyMember(response, newMemberForm.relationship);
      setFamilyMembers(prev => [...prev, newMember]);
      
      setShowAddForm(false);
      setNewMemberForm({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        relationship: 'CHILD',
        enrollment_date: new Date().toISOString().split('T')[0]
      });
    } catch (err: any) {
      setError(err.message || 'Failed to add family member');
    }
  };

  const updateMemberStatus = async (memberId: number, status: string) => {
    try {
      await apiClient.patch(`/patients/${memberId}/`, { status });
      setFamilyMembers(prev =>
        prev.map(member =>
          member.id === memberId ? { ...member, status: status as any } : member
        )
      );
    } catch (err: any) {
      setError(err.message || 'Failed to update member status');
    }
  };

  const MemberCard = ({ member }: { member: FamilyMember }) => {
    const RelationshipIcon = RELATIONSHIP_OPTIONS.find(opt => opt.value === member.relationship)?.icon || User;
    
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <RelationshipIcon className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-semibold">{member.first_name} {member.last_name}</h3>
                <p className="text-sm text-gray-600">{member.member_id}</p>
              </div>
            </div>
            <Badge className={STATUS_COLORS[member.status]}>
              {member.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-600">Relationship</p>
              <p className="font-medium">{member.relationship}</p>
            </div>
            <div>
              <p className="text-gray-600">Age</p>
              <p className="font-medium">{member.age} years</p>
            </div>
            <div>
              <p className="text-gray-600">Enrollment</p>
              <p className="font-medium">{new Date(member.enrollment_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-gray-600">Benefit Year</p>
              <p className="font-medium">{new Date(member.benefit_year_start).toLocaleDateString()}</p>
            </div>
          </div>

          {member.waiting_periods.length > 0 && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
              <div className="flex items-center gap-1 mb-1">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Waiting Periods</span>
              </div>
              {member.waiting_periods.map(period => (
                <div key={period.id} className="text-xs text-yellow-700">
                  {period.benefit_type}: {period.days_remaining} days remaining
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setEditingMember(member)}>
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            {member.status === 'ACTIVE' ? (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => updateMemberStatus(member.id, 'SUSPENDED')}
              >
                Suspend
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => updateMemberStatus(member.id, 'ACTIVE')}
              >
                Activate
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading family data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Family Members ({familyMembers.length + (principalMember ? 1 : 0)})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {principalMember && (
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">{principalMember.first_name} {principalMember.last_name}</span>
              </div>
              <Badge className={STATUS_COLORS[principalMember.status]}>
                {principalMember.status}
              </Badge>
            </div>
          )}
          {familyMembers.map(member => (
            <div key={member.id} className="flex items-center justify-between p-2 border rounded">
              <div className="flex items-center gap-2">
                <Baby className="h-4 w-4 text-gray-600" />
                <span className="text-sm">{member.first_name} {member.last_name}</span>
              </div>
              <Badge className={STATUS_COLORS[member.status]}>
                {member.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Family Management</h2>
          {principalMember && (
            <p className="text-gray-600">
              Managing family for {principalMember.first_name} {principalMember.last_name} ({principalMember.member_id})
            </p>
          )}
        </div>
        {showAddMember && (
          <Button onClick={() => setShowAddForm(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Family Member
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="text-sm text-red-700 mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Benefit Year Information */}
      {benefitYear && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Benefit Year {benefitYear.year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Period</p>
                <p className="font-semibold">
                  {new Date(benefitYear.start_date).toLocaleDateString()} - {new Date(benefitYear.end_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Anniversary</p>
                <p className="font-semibold">{new Date(benefitYear.enrollment_anniversary).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Days Until Renewal</p>
                <p className="font-semibold text-orange-600">{benefitYear.days_until_renewal} days</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <Badge variant={benefitYear.is_current ? 'default' : 'outline'}>
                  {benefitYear.is_current ? 'Current' : 'Historical'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Family Members</TabsTrigger>
          <TabsTrigger value="waiting">Waiting Periods</TabsTrigger>
          <TabsTrigger value="history">Enrollment History</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          {/* Principal Member */}
          {principalMember && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Principal Member
              </h3>
              <MemberCard member={principalMember} />
            </div>
          )}

          {/* Family Members */}
          {familyMembers.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                Dependents ({familyMembers.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {familyMembers.map(member => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="waiting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Active Waiting Periods
              </CardTitle>
            </CardHeader>
            <CardContent>
              {familyMembers.flatMap(member => member.waiting_periods).length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-400" />
                  <p className="text-gray-600">No active waiting periods</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {familyMembers.map(member =>
                    member.waiting_periods.map(period => (
                      <div key={`${member.id}-${period.id}`} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-semibold">{member.first_name} {member.last_name}</h4>
                            <p className="text-sm text-gray-600">{period.benefit_type}</p>
                          </div>
                          <Badge variant={period.status === 'ACTIVE' ? 'destructive' : 'outline'}>
                            {period.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Start Date</p>
                            <p className="font-medium">{new Date(period.start_date).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">End Date</p>
                            <p className="font-medium">{new Date(period.end_date).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Days Remaining</p>
                            <p className="font-medium text-orange-600">{period.days_remaining}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Enrollment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[principalMember, ...familyMembers].filter(Boolean).map(member => (
                  <div key={member!.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{member!.first_name} {member!.last_name}</h4>
                        <p className="text-sm text-gray-600">{member!.relationship}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          Enrolled: {new Date(member!.enrollment_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-600">
                          {Math.floor((Date.now() - new Date(member!.enrollment_date).getTime()) / (1000 * 60 * 60 * 24))} days ago
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Member Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add Family Member</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={newMemberForm.first_name}
                    onChange={(e) => setNewMemberForm(prev => ({ ...prev, first_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={newMemberForm.last_name}
                    onChange={(e) => setNewMemberForm(prev => ({ ...prev, last_name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={newMemberForm.date_of_birth}
                  onChange={(e) => setNewMemberForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="relationship">Relationship</Label>
                <select
                  id="relationship"
                  value={newMemberForm.relationship}
                  onChange={(e) => setNewMemberForm(prev => ({ ...prev, relationship: e.target.value as any }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  {RELATIONSHIP_OPTIONS.filter(opt => opt.value !== 'PRINCIPAL').map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enrollment_date">Enrollment Date</Label>
                <Input
                  id="enrollment_date"
                  type="date"
                  value={newMemberForm.enrollment_date}
                  onChange={(e) => setNewMemberForm(prev => ({ ...prev, enrollment_date: e.target.value }))}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={addFamilyMember} className="flex-1">
                  Add Member
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}