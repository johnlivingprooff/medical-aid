/**
 * Advanced Search and Filtering Component
 * Sophisticated search with medical aid specific filters and intelligent suggestions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Filter, 
  Save, 
  Clock, 
  X, 
  Star,
  SlidersHorizontal,
  Users,
  FileText,
  Building2,
  Calendar,
  DollarSign,
  MapPin,
  Tag,
  TrendingUp,
  Bookmark,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { apiClient } from '@/lib/api-enhanced';
import { CurrencyUtils } from '@/lib/currency-enhanced';

interface SearchFilters {
  entity_type: string[];
  date_range: {
    start: string;
    end: string;
  };
  amount_range: {
    min: number;
    max: number;
  };
  status: string[];
  location: string[];
  scheme: string[];
  provider_type: string[];
  benefit_type: string[];
  member_relationship: string[];
  urgency: string[];
}

interface SearchResult {
  id: string;
  type: 'CLAIM' | 'PATIENT' | 'PROVIDER' | 'SCHEME' | 'MEMBER';
  title: string;
  subtitle: string;
  description: string;
  metadata: Record<string, any>;
  relevance_score: number;
  highlights: string[];
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Partial<SearchFilters>;
  created_at: string;
  last_used: string;
  use_count: number;
  is_favorite: boolean;
}

interface SearchSuggestion {
  text: string;
  type: 'QUERY' | 'FILTER' | 'ENTITY';
  category: string;
  count?: number;
}

interface Props {
  onResultSelect?: (result: SearchResult) => void;
  defaultEntityTypes?: string[];
  compactMode?: boolean;
}

const ENTITY_TYPES = [
  { value: 'CLAIM', label: 'Claims', icon: FileText },
  { value: 'PATIENT', label: 'Patients', icon: Users },
  { value: 'PROVIDER', label: 'Providers', icon: Building2 },
  { value: 'SCHEME', label: 'Schemes', icon: Tag },
  { value: 'MEMBER', label: 'Members', icon: Users }
];

const STATUS_OPTIONS = [
  'PENDING', 'APPROVED', 'REJECTED', 'IN_REVIEW', 'PAID', 'ACTIVE', 'INACTIVE'
];

const BENEFIT_TYPES = [
  'General Practice', 'Specialist Consultation', 'Diagnostics', 'Surgery',
  'Pharmaceuticals', 'Emergency Care', 'Dental Care', 'Optical Care'
];

export function AdvancedSearchAndFiltering({ 
  onResultSelect, 
  defaultEntityTypes = ['CLAIM'], 
  compactMode = false 
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeTab, setActiveTab] = useState('search');

  const [filters, setFilters] = useState<SearchFilters>({
    entity_type: defaultEntityTypes,
    date_range: { start: '', end: '' },
    amount_range: { min: 0, max: 100000 },
    status: [],
    location: [],
    scheme: [],
    provider_type: [],
    benefit_type: [],
    member_relationship: [],
    urgency: []
  });

  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    loadSavedSearches();
    loadRecentSearches();
  }, []);

  useEffect(() => {
    if (query.length > 2) {
      loadSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [query]);

  const loadSavedSearches = async () => {
    try {
      const response = await apiClient.get('/search/saved/') as any;
      setSavedSearches(response.results || generateMockSavedSearches());
    } catch (error) {
      console.error('Failed to load saved searches:', error);
      setSavedSearches(generateMockSavedSearches());
    }
  };

  const loadRecentSearches = () => {
    const recent = localStorage.getItem('recent_searches');
    if (recent) {
      setRecentSearches(JSON.parse(recent));
    }
  };

  const saveRecentSearch = (searchQuery: string) => {
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('recent_searches', JSON.stringify(updated));
  };

  const loadSuggestions = useCallback(async () => {
    try {
      const response = await apiClient.get(`/search/suggestions/?q=${encodeURIComponent(query)}`) as any;
      setSuggestions(response || generateMockSuggestions(query));
    } catch (error) {
      console.error('Failed to load suggestions:', error);
      setSuggestions(generateMockSuggestions(query));
    }
  }, [query]);

  const performSearch = async () => {
    if (!query.trim() && filters.entity_type.length === 0) return;

    setLoading(true);
    try {
      const searchParams = new URLSearchParams({
        q: query,
        entity_types: filters.entity_type.join(','),
        ...(filters.date_range.start && { date_from: filters.date_range.start }),
        ...(filters.date_range.end && { date_to: filters.date_range.end }),
        ...(filters.amount_range.min > 0 && { amount_min: filters.amount_range.min.toString() }),
        ...(filters.amount_range.max < 100000 && { amount_max: filters.amount_range.max.toString() }),
        ...(filters.status.length > 0 && { status: filters.status.join(',') }),
        ...(filters.benefit_type.length > 0 && { benefit_types: filters.benefit_type.join(',') })
      });

      const response = await apiClient.get(`/search/?${searchParams}`) as any;
      setResults(response.results || generateMockResults(query));
      
      if (query.trim()) {
        saveRecentSearch(query.trim());
      }
      
      setShowSuggestions(false);
    } catch (error) {
      console.error('Search failed:', error);
      setResults(generateMockResults(query));
    } finally {
      setLoading(false);
    }
  };

  const saveSearch = async (name: string) => {
    try {
      const searchData = {
        name,
        query,
        filters,
        entity_types: filters.entity_type
      };

      await apiClient.post('/search/saved/', searchData);
      loadSavedSearches();
    } catch (error) {
      console.error('Failed to save search:', error);
      // Mock save for demo
      const newSearch: SavedSearch = {
        id: Date.now().toString(),
        name,
        query,
        filters,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
        use_count: 1,
        is_favorite: false
      };
      setSavedSearches(prev => [newSearch, ...prev]);
    }
  };

  const loadSavedSearch = (savedSearch: SavedSearch) => {
    setQuery(savedSearch.query);
    setFilters({ ...filters, ...savedSearch.filters });
    performSearch();
  };

  const generateMockSavedSearches = (): SavedSearch[] => [
    {
      id: '1',
      name: 'High Value Claims',
      query: 'claims > 10000',
      filters: { entity_type: ['CLAIM'], amount_range: { min: 10000, max: 100000 } },
      created_at: '2024-01-10T10:00:00Z',
      last_used: '2024-01-15T14:30:00Z',
      use_count: 25,
      is_favorite: true
    },
    {
      id: '2',
      name: 'Pending Provider Reviews',
      query: 'provider status:pending',
      filters: { entity_type: ['PROVIDER'], status: ['PENDING'] },
      created_at: '2024-01-05T09:00:00Z',
      last_used: '2024-01-14T11:20:00Z',
      use_count: 12,
      is_favorite: false
    }
  ];

  const generateMockSuggestions = (searchQuery: string): SearchSuggestion[] => [
    { text: `${searchQuery} claims`, type: 'QUERY', category: 'Claims' },
    { text: `${searchQuery} patients`, type: 'QUERY', category: 'Patients' },
    { text: 'Status: Pending', type: 'FILTER', category: 'Status' },
    { text: 'Amount > MWK 5,000', type: 'FILTER', category: 'Amount' },
    { text: 'Dr. Smith', type: 'ENTITY', category: 'Provider', count: 15 }
  ];

  const generateMockResults = (searchQuery: string): SearchResult[] => [
    {
      id: '1',
      type: 'CLAIM',
      title: 'Claim #CLM-2024-001',
      subtitle: 'General Practice Consultation',
      description: 'Routine consultation with Dr. Smith for patient John Doe',
      metadata: {
        amount: 2500,
        status: 'PENDING',
        date: '2024-01-15',
        patient: 'John Doe',
        provider: 'Dr. Smith'
      },
      relevance_score: 0.95,
      highlights: [`Found "${searchQuery}" in claim description`]
    },
    {
      id: '2',
      type: 'PATIENT',
      title: 'John Doe',
      subtitle: 'Member ID: MBR-0001',
      description: 'Principal member with active coverage under Premium Health Plan',
      metadata: {
        member_id: 'MBR-0001',
        scheme: 'Premium Health Plan',
        status: 'ACTIVE',
        enrollment_date: '2023-06-01'
      },
      relevance_score: 0.87,
      highlights: [`Name matches "${searchQuery}"`]
    },
    {
      id: '3',
      type: 'PROVIDER',
      title: 'Dr. Smith Medical Practice',
      subtitle: 'General Practitioner',
      description: 'Primary care provider specializing in family medicine',
      metadata: {
        provider_id: 'PRV-001',
        specialty: 'General Practice',
        location: 'Lilongwe',
        network_status: 'IN_NETWORK'
      },
      relevance_score: 0.82,
      highlights: [`Provider name contains "${searchQuery}"`]
    }
  ];

  const getEntityIcon = (type: string) => {
    const entity = ENTITY_TYPES.find(e => e.value === type);
    return entity?.icon || FileText;
  };

  const formatMetadata = (result: SearchResult) => {
    switch (result.type) {
      case 'CLAIM':
        return [
          { label: 'Amount', value: CurrencyUtils.format(result.metadata.amount) },
          { label: 'Status', value: result.metadata.status },
          { label: 'Date', value: new Date(result.metadata.date).toLocaleDateString() }
        ];
      case 'PATIENT':
        return [
          { label: 'Member ID', value: result.metadata.member_id },
          { label: 'Scheme', value: result.metadata.scheme },
          { label: 'Status', value: result.metadata.status }
        ];
      case 'PROVIDER':
        return [
          { label: 'Specialty', value: result.metadata.specialty },
          { label: 'Location', value: result.metadata.location },
          { label: 'Network', value: result.metadata.network_status }
        ];
      default:
        return [];
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': case 'active': case 'paid': return 'success';
      case 'pending': case 'in_review': return 'warning';
      case 'rejected': case 'inactive': return 'destructive';
      default: return 'outline';
    }
  };

  const clearFilters = () => {
    setFilters({
      entity_type: defaultEntityTypes,
      date_range: { start: '', end: '' },
      amount_range: { min: 0, max: 100000 },
      status: [],
      location: [],
      scheme: [],
      provider_type: [],
      benefit_type: [],
      member_relationship: [],
      urgency: []
    });
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.date_range.start || filters.date_range.end) count++;
    if (filters.amount_range.min > 0 || filters.amount_range.max < 100000) count++;
    count += filters.status.length;
    count += filters.benefit_type.length;
    return count;
  }, [filters]);

  if (compactMode) {
    return (
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search claims, patients, providers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && performSearch()}
            className="pl-10 pr-10"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="absolute right-1 top-1/2 transform -translate-y-1/2"
          >
            <Filter className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>
        
        {showFilters && (
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Entity Type</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ENTITY_TYPES.map(type => (
                      <Badge
                        key={type.value}
                        variant={filters.entity_type.includes(type.value) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          setFilters(prev => ({
                            ...prev,
                            entity_type: prev.entity_type.includes(type.value)
                              ? prev.entity_type.filter(t => t !== type.value)
                              : [...prev.entity_type, type.value]
                          }));
                        }}
                      >
                        {type.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {STATUS_OPTIONS.slice(0, 4).map(status => (
                      <Badge
                        key={status}
                        variant={filters.status.includes(status) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          setFilters(prev => ({
                            ...prev,
                            status: prev.status.includes(status)
                              ? prev.status.filter(s => s !== status)
                              : [...prev.status, status]
                          }));
                        }}
                      >
                        {status}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {results.length > 0 && (
          <div className="space-y-2">
            {results.slice(0, 5).map(result => {
              const Icon = getEntityIcon(result.type);
              return (
                <div
                  key={result.id}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                  onClick={() => onResultSelect?.(result)}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="h-4 w-4 text-gray-600 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{result.title}</p>
                      <p className="text-sm text-gray-600 truncate">{result.subtitle}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {result.type}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6" />
            Advanced Search
          </h2>
          <p className="text-gray-600">
            Search across all medical aid entities with intelligent filtering
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          placeholder="Search claims, patients, providers, schemes, and members..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onKeyPress={(e) => e.key === 'Enter' && performSearch()}
          onFocus={() => setShowSuggestions(true)}
          className="pl-12 pr-32 h-12 text-lg"
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <Button onClick={performSearch} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && (query.length > 0 || recentSearches.length > 0) && (
          <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-80 overflow-y-auto">
            <CardContent className="p-0">
              {suggestions.length > 0 && (
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-500 mb-2">SUGGESTIONS</p>
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer rounded"
                      onClick={() => {
                        if (suggestion.type === 'QUERY') {
                          setQuery(suggestion.text);
                        } else {
                          setQuery(prev => `${prev} ${suggestion.text}`);
                        }
                        setShowSuggestions(false);
                      }}
                    >
                      <Search className="h-3 w-3 text-gray-400" />
                      <span className="text-sm">{suggestion.text}</span>
                      {suggestion.count && (
                        <Badge variant="outline" className="ml-auto text-xs">
                          {suggestion.count}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {recentSearches.length > 0 && (
                <div className="border-t p-2">
                  <p className="text-xs font-medium text-gray-500 mb-2">RECENT SEARCHES</p>
                  {recentSearches.slice(0, 5).map((search, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer rounded"
                      onClick={() => {
                        setQuery(search);
                        setShowSuggestions(false);
                      }}
                    >
                      <Clock className="h-3 w-3 text-gray-400" />
                      <span className="text-sm">{search}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search">Search Results</TabsTrigger>
          <TabsTrigger value="filters">Advanced Filters</TabsTrigger>
          <TabsTrigger value="saved">Saved Searches</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          {/* Search Results */}
          {results.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Found {results.length} results
                </p>
                {query && (
                  <Button variant="outline" size="sm" onClick={() => saveSearch(query)}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Search
                  </Button>
                )}
              </div>
              
              {results.map(result => {
                const Icon = getEntityIcon(result.type);
                const metadata = formatMetadata(result);
                
                return (
                  <Card 
                    key={result.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => onResultSelect?.(result)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-gray-100 rounded">
                          <Icon className="h-5 w-5 text-gray-600" />
                        </div>
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold">{result.title}</h3>
                              <p className="text-sm text-gray-600">{result.subtitle}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{result.type}</Badge>
                              <div className="text-right text-xs text-gray-500">
                                Score: {(result.relevance_score * 100).toFixed(0)}%
                              </div>
                            </div>
                          </div>
                          
                          <p className="text-sm">{result.description}</p>
                          
                          {metadata.length > 0 && (
                            <div className="flex flex-wrap gap-4 text-xs">
                              {metadata.map((item, index) => (
                                <div key={index} className="flex items-center gap-1">
                                  <span className="text-gray-500">{item.label}:</span>
                                  <span className="font-medium">{item.value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {result.highlights.length > 0 && (
                            <div className="text-xs text-blue-600">
                              {result.highlights.join(' • ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : query || Object.values(filters).some(f => Array.isArray(f) ? f.length > 0 : f) ? (
            <Card>
              <CardContent className="text-center py-12">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No results found</h3>
                <p className="text-gray-600">
                  Try adjusting your search terms or filters
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Start your search</h3>
                <p className="text-gray-600">
                  Enter keywords or use advanced filters to find what you're looking for
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="filters" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Advanced Filters
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Entity Types */}
              <div>
                <label className="text-sm font-medium mb-2 block">Entity Types</label>
                <div className="flex flex-wrap gap-2">
                  {ENTITY_TYPES.map(type => {
                    const Icon = type.icon;
                    return (
                      <Badge
                        key={type.value}
                        variant={filters.entity_type.includes(type.value) ? 'default' : 'outline'}
                        className="cursor-pointer flex items-center gap-1 px-3 py-1"
                        onClick={() => {
                          setFilters(prev => ({
                            ...prev,
                            entity_type: prev.entity_type.includes(type.value)
                              ? prev.entity_type.filter(t => t !== type.value)
                              : [...prev.entity_type, type.value]
                          }));
                        }}
                      >
                        <Icon className="h-3 w-3" />
                        {type.label}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Input
                      type="date"
                      value={filters.date_range.start}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        date_range: { ...prev.date_range, start: e.target.value }
                      }))}
                      placeholder="Start date"
                    />
                  </div>
                  <div>
                    <Input
                      type="date"
                      value={filters.date_range.end}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        date_range: { ...prev.date_range, end: e.target.value }
                      }))}
                      placeholder="End date"
                    />
                  </div>
                </div>
              </div>

              {/* Amount Range */}
              <div>
                <label className="text-sm font-medium mb-2 block">Amount Range</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Input
                      type="number"
                      value={filters.amount_range.min}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        amount_range: { ...prev.amount_range, min: Number(e.target.value) }
                      }))}
                      placeholder="Minimum amount"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      value={filters.amount_range.max}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        amount_range: { ...prev.amount_range, max: Number(e.target.value) }
                      }))}
                      placeholder="Maximum amount"
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map(status => (
                    <Badge
                      key={status}
                      variant={filters.status.includes(status) ? getStatusColor(status) : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        setFilters(prev => ({
                          ...prev,
                          status: prev.status.includes(status)
                            ? prev.status.filter(s => s !== status)
                            : [...prev.status, status]
                        }));
                      }}
                    >
                      {status}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Benefit Types */}
              <div>
                <label className="text-sm font-medium mb-2 block">Benefit Types</label>
                <div className="flex flex-wrap gap-2">
                  {BENEFIT_TYPES.map(type => (
                    <Badge
                      key={type}
                      variant={filters.benefit_type.includes(type) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        setFilters(prev => ({
                          ...prev,
                          benefit_type: prev.benefit_type.includes(type)
                            ? prev.benefit_type.filter(t => t !== type)
                            : [...prev.benefit_type, type]
                        }));
                      }}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saved" className="space-y-4">
          {savedSearches.length > 0 ? (
            <div className="space-y-3">
              {savedSearches.map(search => (
                <Card key={search.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex-1"
                        onClick={() => loadSavedSearch(search)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{search.name}</h3>
                          {search.is_favorite && (
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">"{search.query}"</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Used {search.use_count} times</span>
                          <span>Last used {new Date(search.last_used).toLocaleDateString()}</span>
                          <span>Created {new Date(search.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Bookmark className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Bookmark className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No saved searches</h3>
                <p className="text-gray-600">
                  Save your frequently used searches for quick access
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}