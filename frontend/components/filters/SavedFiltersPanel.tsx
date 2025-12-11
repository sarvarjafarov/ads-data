'use client';

import { useState, useEffect } from 'react';

interface SavedFilter {
  id: string;
  name: string;
  description: string;
  filter_type: string;
  filter_config: any;
  is_default: boolean;
  is_shared: boolean;
  view_count: number;
  created_by_name: string;
}

interface SavedFiltersPanelProps {
  workspaceId: string;
  filterType: string;
  onFilterSelect: (filter: SavedFilter) => void;
  currentFilters?: any;
}

export default function SavedFiltersPanel({
  workspaceId,
  filterType,
  onFilterSelect,
  currentFilters,
}: SavedFiltersPanelProps) {
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [newFilterDesc, setNewFilterDesc] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFilters();
  }, [workspaceId, filterType]);

  const fetchFilters = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/filters/workspaces/${workspaceId}/filters?filterType=${filterType}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setFilters(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch filters:', error);
    }
  };

  const saveCurrentFilter = async () => {
    if (!newFilterName.trim()) {
      alert('Please enter a filter name');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/filters/workspaces/${workspaceId}/filters`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: newFilterName,
            description: newFilterDesc,
            filter_type: filterType,
            filter_config: currentFilters,
            is_default: isDefault,
            is_shared: isShared,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setShowSaveDialog(false);
        setNewFilterName('');
        setNewFilterDesc('');
        setIsDefault(false);
        setIsShared(false);
        fetchFilters();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Failed to save filter');
    } finally {
      setLoading(false);
    }
  };

  const deleteFilter = async (filterId: string) => {
    if (!confirm('Are you sure you want to delete this filter?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/filters/filters/${filterId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        fetchFilters();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Failed to delete filter');
    }
  };

  const applyFilter = async (filter: SavedFilter) => {
    onFilterSelect(filter);

    // Track view count
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:3000/api/filters/filters/${filter.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Failed to track view:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Saved Filters</h3>
        <button
          onClick={() => setShowSaveDialog(true)}
          className="px-3 py-1 bg-primary hover:bg-primary/80 text-black rounded-lg text-sm font-medium transition-colors"
        >
          Save Current
        </button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="card p-4 border border-primary/30">
          <h4 className="text-white font-semibold mb-3">Save Current Filter</h4>
          <div className="space-y-3">
            <input
              type="text"
              value={newFilterName}
              onChange={(e) => setNewFilterName(e.target.value)}
              placeholder="Filter name"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary"
            />
            <textarea
              value={newFilterDesc}
              onChange={(e) => setNewFilterDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary"
            />
            <div className="flex gap-4 text-sm">
              <label className="flex items-center text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="mr-2"
                />
                Set as default
              </label>
              <label className="flex items-center text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                  className="mr-2"
                />
                Share with team
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveCurrentFilter}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/80 text-black rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setNewFilterName('');
                  setNewFilterDesc('');
                }}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters List */}
      <div className="space-y-2">
        {filters.length === 0 ? (
          <p className="text-white/60 text-sm text-center py-4">No saved filters yet</p>
        ) : (
          filters.map((filter) => (
            <div
              key={filter.id}
              className="card-minimal p-3 hover:bg-white/10 transition-colors group"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 cursor-pointer" onClick={() => applyFilter(filter)}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium">{filter.name}</span>
                    {filter.is_default && (
                      <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded">
                        Default
                      </span>
                    )}
                    {filter.is_shared && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                        Shared
                      </span>
                    )}
                  </div>
                  {filter.description && (
                    <p className="text-white/60 text-xs mb-1">{filter.description}</p>
                  )}
                  <p className="text-white/40 text-xs">
                    By {filter.created_by_name} • {filter.view_count} views
                  </p>
                </div>
                <button
                  onClick={() => deleteFilter(filter.id)}
                  className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
