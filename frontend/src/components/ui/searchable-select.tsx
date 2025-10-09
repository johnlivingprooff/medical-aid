import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface Option {
  value: string | number
  label: string
  subtitle?: string
  searchableText?: string
}

interface SearchableSelectProps {
  options: Option[]
  value: string | number | ''
  onChange: (value: string | number) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  searchPlaceholder?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  required = false,
  className = '',
  searchPlaceholder = 'Search...'
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredOptions, setFilteredOptions] = useState<Option[]>(options)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filter options based on search term (search in both label and subtitle)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredOptions(options)
    } else {
      const searchLower = searchTerm.toLowerCase()
      const filtered = options.filter(option => {
        // If searchableText is provided, use it for comprehensive search
        if (option.searchableText) {
          return option.searchableText.toLowerCase().includes(searchLower)
        }
        
        // Otherwise, search in label, subtitle, and value
        return (
          option.label.toLowerCase().includes(searchLower) ||
          option.subtitle?.toLowerCase().includes(searchLower) ||
          String(option.value).toLowerCase().includes(searchLower)
        )
      })
      setFilteredOptions(filtered)
    }
  }, [searchTerm, options])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSearchTerm('')
    }
  }

  const selectedOption = options.find(option => option.value === value)

  const handleSelect = (optionValue: string | number) => {
    onChange(optionValue)
    setIsOpen(false)
    setSearchTerm('')
  }

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setSearchTerm('')
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className={`
          w-full h-9 px-3 text-sm text-left border rounded-md bg-background
          flex items-center justify-between
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'}
          ${isOpen ? 'ring-2 ring-ring ring-offset-2' : ''}
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        role="combobox"
      >
        <span className="flex-1 truncate">
          {selectedOption ? (
            <span className="flex flex-col">
              <span className="text-foreground">{selectedOption.label}</span>
              {selectedOption.subtitle && (
                <span className="text-xs text-muted-foreground">{selectedOption.subtitle}</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {selectedOption && !disabled && (
            <button
              type="button"
              className="h-4 w-4 rounded-sm hover:bg-muted flex items-center justify-center"
              onClick={clearSelection}
              tabIndex={-1}
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-[9999] w-full mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-xl">
          {/* Search Input */}
          <div className="p-2 border-b bg-white dark:bg-gray-800">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8"
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto bg-white dark:bg-gray-800">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {searchTerm ? 'No results found' : 'No options available'}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`
                    w-full px-3 py-2 text-left text-sm hover:bg-muted
                    flex flex-col items-start
                    ${option.value === value ? 'bg-muted' : ''}
                  `}
                  onClick={() => handleSelect(option.value)}
                >
                  <span className="font-medium">{option.label}</span>
                  {option.subtitle && (
                    <span className="text-xs text-muted-foreground">{option.subtitle}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}