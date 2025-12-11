'use client';

import { useState } from 'react';

interface SearchFilter {
  field: string;
  operator: string;
  value: string;
}

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilter[], query: string) => void;
  fields?: Array<{ label: string; value: string; type: string }>;
}

const DEFAULT_FIELDS = [
  { label: 'Campaign Name', value: 'campaign_name', type: 'text' },
  { label: 'Platform', value: 'platform', type: 'select' },
  { label: 'Spend', value: 'spend', type: 'number' },
  { label: 'Conversions', value: 'conversions', type: 'number' },
  { label: 'CPA', value: 'cpa', type: 'number' },
  { label: 'ROAS', value: 'roas', type: 'number' },
  { label: 'Status', value: 'status', type: 'select' },
  { label: 'Date Created', value: 'created_at', type: 'date' },
];

const OPERATORS = {
  text: [
    { label: 'Contains', value: 'contains' },
    { label: 'Equals', value: 'equals' },
    { label: 'Starts with', value: 'starts_with' },
    { label: 'Ends with', value: 'ends_with' },
  ],
  number: [
    { label: 'Equals', value: 'equals' },
    { label: 'Greater than', value: 'gt' },
    { label: 'Less than', value: 'lt' },
    { label: 'Greater than or equal', value: 'gte' },
    { label: 'Less than or equal', value: 'lte' },
    { label: 'Between', value: 'between' },
  ],
  select: [
    { label: 'Is', value: 'equals' },
    { label: 'Is not', value: 'not_equals' },
  ],
  date: [
    { label: 'Is', value: 'equals' },
    { label: 'After', value: 'after' },
    { label: 'Before', value: 'before' },
    { label: 'Between', value: 'between' },
  ],
};

export default function AdvancedSearch({ onSearch, fields = DEFAULT_FIELDS }: AdvancedSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilter[]>([
    { field: '', operator: '', value: '' },
  ]);

  const addFilter = () => {
    setFilters([...filters, { field: '', operator: '', value: '' }]);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, key: keyof SearchFilter, value: string) => {
    const newFilters = [...filters];
    newFilters[index][key] = value;

    // Reset operator when field changes
    if (key === 'field') {
      newFilters[index].operator = '';
      newFilters[index].value = '';
    }

    setFilters(newFilters);
  };

  const getOperators = (fieldValue: string) => {
    const field = fields.find(f => f.value === fieldValue);
    return field ? OPERATORS[field.type as keyof typeof OPERATORS] || [] : [];
  };

  const getFieldType = (fieldValue: string) => {
    const field = fields.find(f => f.value === fieldValue);
    return field?.type || 'text';
  };

  const handleSearch = () => {
    const validFilters = filters.filter(f => f.field && f.operator && f.value);
    onSearch(validFilters, searchQuery);
    setIsOpen(false);
  };

  const clearFilters = () => {
    setFilters([{ field: '', operator: '', value: '' }]);
    setSearchQuery('');
    onSearch([], '');
  };

  return (
    <div className="relative">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search campaigns, keywords, etc..."
            className="w-full px-4 py-2 pl-10 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            isOpen || filters.some(f => f.field)
              ? 'bg-primary text-black'
              : 'bg-white/5 hover:bg-white/10 text-white'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          Advanced Filters
          {filters.some(f => f.field) && (
            <span className="bg-black/30 px-2 py-0.5 rounded-full text-xs">
              {filters.filter(f => f.field).length}
            </span>
          )}
        </button>
        <button onClick={handleSearch} className="btn-primary">
          Search
        </button>
      </div>

      {/* Advanced Filters Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 card p-6 z-50 shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Advanced Filters</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            {filters.map((filter, index) => (
              <div key={index} className="flex gap-3 items-start">
                <div className="flex-1 grid grid-cols-3 gap-3">
                  {/* Field */}
                  <select
                    value={filter.field}
                    onChange={(e) => updateFilter(index, 'field', e.target.value)}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="">Select field...</option>
                    {fields.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </select>

                  {/* Operator */}
                  <select
                    value={filter.operator}
                    onChange={(e) => updateFilter(index, 'operator', e.target.value)}
                    disabled={!filter.field}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary disabled:opacity-50"
                  >
                    <option value="">Operator...</option>
                    {getOperators(filter.field).map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  {/* Value */}
                  <input
                    type={getFieldType(filter.field) === 'number' ? 'number' : getFieldType(filter.field) === 'date' ? 'date' : 'text'}
                    value={filter.value}
                    onChange={(e) => updateFilter(index, 'value', e.target.value)}
                    disabled={!filter.operator}
                    placeholder="Value..."
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>

                {/* Remove Button */}
                {filters.length > 1 && (
                  <button
                    onClick={() => removeFilter(index)}
                    className="p-2 text-red-400 hover:text-red-300 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10">
            <button
              onClick={addFilter}
              className="text-primary hover:text-primary/80 font-medium text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Filter
            </button>

            <div className="flex gap-2">
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-primary hover:bg-primary/80 text-black rounded-lg text-sm font-medium transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
