import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { globalSearch } from '@/lib/api'
import type { SearchResult, SearchResponse } from '@/types/api'
import { useDebounce } from '@/hooks/use-debounce'
import { useNavigate } from 'react-router-dom'

interface SearchBarProps {
  placeholder?: string
  onResultClick?: (result: SearchResult) => void
  className?: string
  compact?: boolean // For header usage
}

export function SearchBar({
  placeholder = "Search schemes, claims, members, providers...",
  onResultClick,
  className = "",
  compact = false
}: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [entityType, setEntityType] = useState<'all' | 'schemes' | 'claims' | 'members' | 'providers' | 'services' | 'benefits'>('all')

  const searchRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const debouncedQuery = useDebounce(query, 300)

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      performSearch(debouncedQuery, entityType)
    } else {
      setResults([])
      setIsOpen(false)
    }
  }, [debouncedQuery, entityType])

  const performSearch = async (searchQuery: string, type: string) => {
    setIsLoading(true)
    try {
      const response: SearchResponse = await globalSearch(searchQuery, type, 8)
      setResults(response.results)
      setIsOpen(response.results.length > 0)
      setSelectedIndex(-1)
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }

  const handleEntityTypeChange = (type: typeof entityType) => {
    setEntityType(type)
    if (query.length >= 2) {
      performSearch(query, type)
    }
  }

  const handleResultClick = (result: SearchResult) => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    setSelectedIndex(-1)

    if (onResultClick) {
      onResultClick(result)
    } else {
      // Use React Router navigation
      navigate(result.url)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => prev < results.length - 1 ? prev + 1 : 0)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : results.length - 1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleResultClick(results[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close dropdown on scroll/resize (since we use fixed positioning)
  useEffect(() => {
      const handleScroll = (event: Event) => {
        // Don't close if scrolling inside the dropdown itself
        if (dropdownRef.current && event.target && dropdownRef.current.contains(event.target as Node)) {
          return
        }
      
      if (isOpen) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)
    
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [isOpen])

  // Global keyboard shortcut: Ctrl+/ or Cmd+/ to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+/ (Windows/Linux) or Cmd+/ (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select() // Select any existing text
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  const getEntityTypeLabel = (type: string) => {
    const labels = {
      all: 'All',
      scheme: 'Scheme',
      schemes: 'Schemes',
      claim: 'Claim',
      claims: 'Claims',
      member: 'Member',
      members: 'Members',
      provider: 'Provider',
      providers: 'Providers',
      service_type: 'Service',
      services: 'Services',
      benefit_type: 'Benefit',
      benefits: 'Benefits'
    }
    return labels[type as keyof typeof labels] || type.charAt(0).toUpperCase() + type.slice(1)
  }

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'scheme': return '🏥'
      case 'claim': return '📋'
      case 'member': return '👤'
      case 'provider': return '👨‍⚕️'
      case 'service_type': return '⚕️'
      case 'benefit_type': return '💊'
      default: return '🔍'
    }
  }

  return (
    <div ref={searchRef} className={`relative w-full max-w-md ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute w-4 h-4 transform -translate-y-1/2 left-3 top-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full py-2 pl-10 pr-10 text-sm border rounded-md border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        />
        {!query && !isLoading && (
          <div className="absolute transform -translate-y-1/2 pointer-events-none right-3 top-1/2">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded">
              Ctrl+/
            </kbd>
          </div>
        )}
        {query && (
          <button
            onClick={clearSearch}
            className="absolute transform -translate-y-1/2 right-3 top-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {isLoading && (
          <Loader2 className="absolute w-4 h-4 transform -translate-y-1/2 right-3 top-1/2 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Entity Type Filter */}
      {!compact && (
        <div className="flex gap-1 mt-2 text-xs">
          {(['all', 'schemes', 'claims', 'members', 'providers', 'services', 'benefits'] as const).map((type) => (
            <button
              key={type}
              onClick={() => handleEntityTypeChange(type)}
              className={`px-2 py-1 rounded transition-colors ${
                entityType === type
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {getEntityTypeLabel(type)}
            </button>
          ))}
        </div>
      )}      {/* Search Results Dropdown - Uses fixed positioning to break out of header overflow */}
      {isOpen && (
        <div 
            ref={dropdownRef}
          className="fixed bg-card border border-border rounded-md shadow-xl z-[100] max-h-96 overflow-y-auto backdrop-blur-sm"
          style={{
              top: `${(inputRef.current?.getBoundingClientRect().bottom ?? 0) + 4}px`,
              left: `${inputRef.current?.getBoundingClientRect().left ?? 0}px`,
              width: `${inputRef.current?.getBoundingClientRect().width ?? 0}px`,
          }}
        >
          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => handleResultClick(result)}
              className={`w-full px-4 py-3 text-left hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border last:border-b-0 ${
                index === selectedIndex ? 'bg-accent text-accent-foreground' : 'bg-card'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0 mt-0.5">
                  {getResultIcon(result.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {result.title}
                  </div>
                  <div className="text-xs truncate text-muted-foreground">
                    {result.subtitle}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded">
                      {getEntityTypeLabel(result.type)}
                    </span>
                    {result.metadata.status && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        result.metadata.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                        result.metadata.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        result.metadata.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {result.metadata.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}

          {results.length === 0 && !isLoading && query.length >= 2 && (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <div className="text-sm">No results found for "{query}"</div>
              <div className="mt-1 text-xs">Try adjusting your search or filter</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}