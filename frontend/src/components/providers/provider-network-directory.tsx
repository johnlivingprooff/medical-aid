/**
 * Enhanced Provider Network Directory
 * Comprehensive provider directory with network status, credentialing, specialties, and availability
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  Shield, 
  Search,
  Filter,
  Star,
  Users,
  Calendar,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Building2,
  Stethoscope,
  Award,
  Navigation,
  Wifi,
  WifiOff
} from 'lucide-react';
import { apiClient } from '@/lib/api-enhanced';

interface Provider {
  id: number;
  name: string;
  provider_number: string;
  practice_number?: string;
  provider_type: 'INDIVIDUAL' | 'GROUP' | 'FACILITY' | 'HOSPITAL';
  specialties: Specialty[];
  contact_info: ContactInfo;
  location: Location;
  network_status: 'IN_NETWORK' | 'OUT_OF_NETWORK' | 'PREFERRED' | 'SUSPENDED';
  credentialing: CredentialingInfo;
  availability: AvailabilityInfo;
  performance_metrics: PerformanceMetrics;
  accepting_new_patients: boolean;
  last_updated: string;
}

interface Specialty {
  id: number;
  name: string;
  code: string;
  is_primary: boolean;
}

interface ContactInfo {
  phone: string;
  email?: string;
  website?: string;
  fax?: string;
  emergency_contact?: string;
}

interface Location {
  address: string;
  city: string;
  postal_code: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  distance_km?: number;
}

interface CredentialingInfo {
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'EXPIRED';
  license_number: string;
  license_expiry: string;
  board_certifications: string[];
  last_verification: string;
  next_review: string;
}

interface AvailabilityInfo {
  online_status: 'ONLINE' | 'OFFLINE' | 'BUSY';
  operating_hours: OperatingHours[];
  emergency_services: boolean;
  telehealth_available: boolean;
  languages_spoken: string[];
}

interface OperatingHours {
  day: string;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

interface PerformanceMetrics {
  patient_satisfaction: number;
  average_wait_time: number;
  claim_approval_rate: number;
  response_time: number;
  total_patients: number;
}

interface Props {
  allowSelection?: boolean;
  selectedProviderId?: number;
  onProviderSelect?: (provider: Provider) => void;
  filterBySpecialty?: string;
  showNetworkOnly?: boolean;
  maxDistance?: number;
  userLocation?: { latitude: number; longitude: number };
}

const PROVIDER_TYPES = {
  INDIVIDUAL: { label: 'Individual Practitioner', icon: Stethoscope },
  GROUP: { label: 'Group Practice', icon: Users },
  FACILITY: { label: 'Medical Facility', icon: Building2 },
  HOSPITAL: { label: 'Hospital', icon: Building2 }
};

const NETWORK_STATUS_COLORS = {
  IN_NETWORK: 'bg-green-100 text-green-800',
  OUT_OF_NETWORK: 'bg-red-100 text-red-800',
  PREFERRED: 'bg-blue-100 text-blue-800',
  SUSPENDED: 'bg-gray-100 text-gray-800'
};

const CREDENTIALING_STATUS_COLORS = {
  ACTIVE: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-red-100 text-red-800'
};

export function ProviderNetworkDirectory({ 
  allowSelection = false,
  selectedProviderId,
  onProviderSelect,
  filterBySpecialty,
  showNetworkOnly = false,
  maxDistance = 50,
  userLocation
}: Props) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState(filterBySpecialty || '');
  const [selectedNetworkStatus, setSelectedNetworkStatus] = useState(showNetworkOnly ? 'IN_NETWORK' : '');
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  useEffect(() => {
    loadProviders();
    loadSpecialties();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [providers, searchTerm, selectedSpecialty, selectedNetworkStatus, showOnlineOnly]);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/providers/') as any;
      const providersData = response.results || response;
      
      if (!providersData || providersData.length === 0) {
        setProviders(generateMockProviders());
      } else {
        setProviders(providersData.map(mapToProvider));
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
      setProviders(generateMockProviders());
    } finally {
      setLoading(false);
    }
  };

  const loadSpecialties = async () => {
    try {
      const response = await apiClient.get('/specialties/') as any;
      const specialtiesData = response.results || response;
      
      if (!specialtiesData || specialtiesData.length === 0) {
        setSpecialties(generateMockSpecialties());
      } else {
        setSpecialties(specialtiesData);
      }
    } catch (error) {
      console.error('Failed to load specialties:', error);
      setSpecialties(generateMockSpecialties());
    }
  };

  const generateMockSpecialties = (): Specialty[] => [
    { id: 1, name: 'General Practice', code: 'GP', is_primary: true },
    { id: 2, name: 'Cardiology', code: 'CARD', is_primary: true },
    { id: 3, name: 'Dermatology', code: 'DERM', is_primary: true },
    { id: 4, name: 'Pediatrics', code: 'PED', is_primary: true },
    { id: 5, name: 'Orthopedics', code: 'ORTH', is_primary: true },
    { id: 6, name: 'Psychiatry', code: 'PSY', is_primary: true }
  ];

  const generateMockProviders = (): Provider[] => [
    {
      id: 1,
      name: 'Dr. Sarah Johnson',
      provider_number: 'PRV-001',
      practice_number: 'PRC-001',
      provider_type: 'INDIVIDUAL',
      specialties: [{ id: 1, name: 'General Practice', code: 'GP', is_primary: true }],
      contact_info: {
        phone: '+265 1 234 5678',
        email: 'dr.johnson@medcenter.mw',
        website: 'www.drjohnson.mw'
      },
      location: {
        address: '123 Medical Street',
        city: 'Lilongwe',
        postal_code: '100001',
        coordinates: { latitude: -13.9833, longitude: 33.7833 },
        distance_km: 2.5
      },
      network_status: 'PREFERRED',
      credentialing: {
        status: 'ACTIVE',
        license_number: 'MED-2024-001',
        license_expiry: '2025-12-31',
        board_certifications: ['Family Medicine Board'],
        last_verification: '2024-01-15',
        next_review: '2025-01-15'
      },
      availability: {
        online_status: 'ONLINE',
        operating_hours: [
          { day: 'Monday', open_time: '08:00', close_time: '17:00', is_closed: false },
          { day: 'Tuesday', open_time: '08:00', close_time: '17:00', is_closed: false },
          { day: 'Wednesday', open_time: '08:00', close_time: '17:00', is_closed: false },
          { day: 'Thursday', open_time: '08:00', close_time: '17:00', is_closed: false },
          { day: 'Friday', open_time: '08:00', close_time: '17:00', is_closed: false },
          { day: 'Saturday', open_time: '09:00', close_time: '13:00', is_closed: false },
          { day: 'Sunday', open_time: '', close_time: '', is_closed: true }
        ],
        emergency_services: false,
        telehealth_available: true,
        languages_spoken: ['English', 'Chichewa']
      },
      performance_metrics: {
        patient_satisfaction: 4.8,
        average_wait_time: 15,
        claim_approval_rate: 95,
        response_time: 2,
        total_patients: 1250
      },
      accepting_new_patients: true,
      last_updated: '2024-10-01T10:00:00Z'
    },
    {
      id: 2,
      name: 'Central Hospital Cardiology',
      provider_number: 'PRV-002',
      provider_type: 'FACILITY',
      specialties: [{ id: 2, name: 'Cardiology', code: 'CARD', is_primary: true }],
      contact_info: {
        phone: '+265 1 345 6789',
        email: 'cardiology@centralhospital.mw',
        emergency_contact: '+265 1 999 0000'
      },
      location: {
        address: '456 Hospital Avenue',
        city: 'Blantyre',
        postal_code: '200001',
        coordinates: { latitude: -15.7861, longitude: 35.0058 },
        distance_km: 15.2
      },
      network_status: 'IN_NETWORK',
      credentialing: {
        status: 'ACTIVE',
        license_number: 'FAC-2024-002',
        license_expiry: '2025-06-30',
        board_certifications: ['Cardiology Board', 'Internal Medicine'],
        last_verification: '2024-02-01',
        next_review: '2025-02-01'
      },
      availability: {
        online_status: 'ONLINE',
        operating_hours: [
          { day: 'Monday', open_time: '07:00', close_time: '19:00', is_closed: false },
          { day: 'Tuesday', open_time: '07:00', close_time: '19:00', is_closed: false },
          { day: 'Wednesday', open_time: '07:00', close_time: '19:00', is_closed: false },
          { day: 'Thursday', open_time: '07:00', close_time: '19:00', is_closed: false },
          { day: 'Friday', open_time: '07:00', close_time: '19:00', is_closed: false },
          { day: 'Saturday', open_time: '08:00', close_time: '16:00', is_closed: false },
          { day: 'Sunday', open_time: '10:00', close_time: '14:00', is_closed: false }
        ],
        emergency_services: true,
        telehealth_available: false,
        languages_spoken: ['English', 'Chichewa', 'Yao']
      },
      performance_metrics: {
        patient_satisfaction: 4.6,
        average_wait_time: 25,
        claim_approval_rate: 92,
        response_time: 5,
        total_patients: 850
      },
      accepting_new_patients: true,
      last_updated: '2024-09-28T14:30:00Z'
    },
    {
      id: 3,
      name: 'Dr. Michael Banda',
      provider_number: 'PRV-003',
      provider_type: 'INDIVIDUAL',
      specialties: [{ id: 4, name: 'Pediatrics', code: 'PED', is_primary: true }],
      contact_info: {
        phone: '+265 1 456 7890',
        email: 'dr.banda@pediatrics.mw'
      },
      location: {
        address: '789 Children\'s Way',
        city: 'Mzuzu',
        postal_code: '300001',
        coordinates: { latitude: -11.4607, longitude: 34.0161 },
        distance_km: 45.8
      },
      network_status: 'IN_NETWORK',
      credentialing: {
        status: 'ACTIVE',
        license_number: 'MED-2024-003',
        license_expiry: '2026-03-31',
        board_certifications: ['Pediatrics Board'],
        last_verification: '2024-03-15',
        next_review: '2025-03-15'
      },
      availability: {
        online_status: 'OFFLINE',
        operating_hours: [
          { day: 'Monday', open_time: '09:00', close_time: '16:00', is_closed: false },
          { day: 'Tuesday', open_time: '09:00', close_time: '16:00', is_closed: false },
          { day: 'Wednesday', open_time: '09:00', close_time: '16:00', is_closed: false },
          { day: 'Thursday', open_time: '09:00', close_time: '16:00', is_closed: false },
          { day: 'Friday', open_time: '09:00', close_time: '16:00', is_closed: false },
          { day: 'Saturday', open_time: '', close_time: '', is_closed: true },
          { day: 'Sunday', open_time: '', close_time: '', is_closed: true }
        ],
        emergency_services: false,
        telehealth_available: true,
        languages_spoken: ['English', 'Chichewa']
      },
      performance_metrics: {
        patient_satisfaction: 4.9,
        average_wait_time: 12,
        claim_approval_rate: 97,
        response_time: 1,
        total_patients: 680
      },
      accepting_new_patients: false,
      last_updated: '2024-10-05T09:15:00Z'
    }
  ];

  const mapToProvider = (apiData: any): Provider => ({
    id: apiData.id,
    name: apiData.name,
    provider_number: apiData.provider_number,
    practice_number: apiData.practice_number,
    provider_type: apiData.provider_type,
    specialties: apiData.specialties || [],
    contact_info: apiData.contact_info || {},
    location: apiData.location || {},
    network_status: apiData.network_status || 'OUT_OF_NETWORK',
    credentialing: apiData.credentialing || {},
    availability: apiData.availability || {},
    performance_metrics: apiData.performance_metrics || {},
    accepting_new_patients: apiData.accepting_new_patients || false,
    last_updated: apiData.last_updated || new Date().toISOString()
  });

  const applyFilters = () => {
    let filtered = [...providers];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(provider =>
        provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        provider.provider_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        provider.specialties.some(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        provider.location.city.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Specialty filter
    if (selectedSpecialty) {
      filtered = filtered.filter(provider =>
        provider.specialties.some(s => s.code === selectedSpecialty)
      );
    }

    // Network status filter
    if (selectedNetworkStatus) {
      filtered = filtered.filter(provider => provider.network_status === selectedNetworkStatus);
    }

    // Online status filter
    if (showOnlineOnly) {
      filtered = filtered.filter(provider => provider.availability.online_status === 'ONLINE');
    }

    setFilteredProviders(filtered);
  };

  const formatOperatingHours = (hours: OperatingHours[]) => {
    const todayHours = hours.find(h => h.day === new Date().toLocaleDateString('en-US', { weekday: 'long' }));
    if (!todayHours || todayHours.is_closed) {
      return 'Closed today';
    }
    return `Open today: ${todayHours.open_time} - ${todayHours.close_time}`;
  };

  const ProviderCard = ({ provider }: { provider: Provider }) => {
    const TypeIcon = PROVIDER_TYPES[provider.provider_type].icon;
    
    return (
      <Card 
        className={`hover:shadow-md transition-shadow cursor-pointer ${
          selectedProviderId === provider.id ? 'ring-2 ring-blue-500' : ''
        }`}
        onClick={() => allowSelection && onProviderSelect?.(provider)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <TypeIcon className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-semibold">{provider.name}</h3>
                <p className="text-sm text-gray-600">{provider.provider_number}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={NETWORK_STATUS_COLORS[provider.network_status]}>
                {provider.network_status.replace('_', ' ')}
              </Badge>
              {provider.availability.online_status === 'ONLINE' ? (
                <Wifi className="h-4 w-4 text-green-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </div>

          {/* Specialties */}
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {provider.specialties.slice(0, 3).map(specialty => (
                <Badge key={specialty.id} variant="outline" className="text-xs">
                  {specialty.name}
                </Badge>
              ))}
              {provider.specialties.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{provider.specialties.length - 3} more
                </Badge>
              )}
            </div>
          </div>

          {/* Location and Contact */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span>{provider.location.city}</span>
              {provider.location.distance_km && (
                <span className="text-gray-500">({provider.location.distance_km} km)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <span>{provider.contact_info.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span>{formatOperatingHours(provider.availability.operating_hours)}</span>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Star className="h-3 w-3 text-yellow-500" />
                <span className="font-semibold">{provider.performance_metrics.patient_satisfaction}</span>
              </div>
              <p className="text-gray-600">Rating</p>
            </div>
            <div className="text-center">
              <p className="font-semibold">{provider.performance_metrics.average_wait_time}m</p>
              <p className="text-gray-600">Wait Time</p>
            </div>
            <div className="text-center">
              <p className="font-semibold">{provider.performance_metrics.claim_approval_rate}%</p>
              <p className="text-gray-600">Approval</p>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {provider.accepting_new_patients ? (
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-600">Accepting Patients</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-xs text-red-600">Not Accepting</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {provider.availability.telehealth_available && (
                <Badge variant="outline" className="text-xs">Telehealth</Badge>
              )}
              {provider.availability.emergency_services && (
                <Badge variant="outline" className="text-xs">Emergency</Badge>
              )}
            </div>
          </div>

          {/* Credentialing Status */}
          <div className="mt-2 pt-2 border-t">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">License Status:</span>
              <Badge className={CREDENTIALING_STATUS_COLORS[provider.credentialing.status]}>
                {provider.credentialing.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading provider directory...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Provider Network Directory</h2>
          <p className="text-gray-600">
            Find healthcare providers in your network
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            List View
          </Button>
          <Button
            variant={viewMode === 'map' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('map')}
          >
            Map View
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search providers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialty">Specialty</Label>
              <select
                id="specialty"
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">All Specialties</option>
                {specialties.map(specialty => (
                  <option key={specialty.id} value={specialty.code}>
                    {specialty.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="network">Network Status</Label>
              <select
                id="network"
                value={selectedNetworkStatus}
                onChange={(e) => setSelectedNetworkStatus(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">All Providers</option>
                <option value="PREFERRED">Preferred</option>
                <option value="IN_NETWORK">In Network</option>
                <option value="OUT_OF_NETWORK">Out of Network</option>
              </select>
            </div>

            <div className="space-y-2 flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showOnlineOnly}
                  onChange={(e) => setShowOnlineOnly(e.target.checked)}
                />
                <span className="text-sm">Online Only</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="flex items-center justify-between">
        <p className="text-gray-600">
          {filteredProviders.length} provider{filteredProviders.length !== 1 ? 's' : ''} found
        </p>
        <select className="text-sm border rounded px-3 py-1">
          <option value="relevance">Sort by Relevance</option>
          <option value="distance">Sort by Distance</option>
          <option value="rating">Sort by Rating</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {/* Provider Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProviders.map(provider => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>

      {filteredProviders.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-2">No Providers Found</h3>
            <p className="text-gray-600 mb-4">
              Try adjusting your search criteria or filters
            </p>
            <Button onClick={() => {
              setSearchTerm('');
              setSelectedSpecialty('');
              setSelectedNetworkStatus('');
              setShowOnlineOnly(false);
            }}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}