# Custom Data Usage Guide

## Overview

This guide provides step-by-step examples for implementing and using the Custom Data feature in your AdsData dashboards. It covers Excel/CSV uploads, Google Sheets integration, and creating AI-powered dashboards with custom data.

---

## Table of Contents

1. [Excel/CSV Import Flow](#excelcsv-import-flow)
2. [Google Sheets Integration](#google-sheets-integration)
3. [Creating Dashboards with Custom Data](#creating-dashboards-with-custom-data)
4. [Advanced Querying](#advanced-querying)
5. [Sync Management](#sync-management)
6. [Error Handling](#error-handling)
7. [Frontend Integration Examples](#frontend-integration-examples)

---

## Excel/CSV Import Flow

### Step 1: Upload File for Preview

```javascript
// Frontend JavaScript
async function uploadFile(workspaceId, file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `https://api.yourapp.com/api/workspaces/${workspaceId}/custom-data/upload`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    }
  );

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error);
  }

  return result;
}

// Usage
const fileInput = document.getElementById('file-input');
const file = fileInput.files[0];

try {
  const preview = await uploadFile('workspace-123', file);

  console.log('File Info:', preview.preview);
  console.log('Detected Schema:', preview.detectedSchema);
  console.log('AI Suggestions:', preview.aiSuggestions);

  // Display preview to user for confirmation
  displayPreview(preview);
} catch (error) {
  console.error('Upload failed:', error);
}
```

### Step 2: Confirm Import

```javascript
async function confirmImport(workspaceId, previewData) {
  const response = await fetch(
    `https://api.yourapp.com/api/workspaces/${workspaceId}/custom-data/confirm`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceName: 'Q4 Campaign Data',
        description: 'Performance metrics for Q4 campaigns',
        detectedSchema: previewData.detectedSchema,
        parsedRows: previewData.preview.sampleData, // All rows in production
        filename: previewData.preview.filename,
        fileSize: previewData.preview.fileSize,
        aiSuggestions: previewData.aiSuggestions,
        syncEnabled: false,
        syncFrequency: null,
      }),
    }
  );

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error);
  }

  return result;
}

// Usage
const importResult = await confirmImport('workspace-123', preview);
console.log('Import complete:', importResult.source);
console.log(`Imported ${importResult.import.insertedRows} rows`);

// Redirect to dashboard or data source page
window.location.href = `/workspaces/${workspaceId}/sources/${importResult.source.id}`;
```

### Complete Import Component (React Example)

```jsx
import React, { useState } from 'react';

function CustomDataUpload({ workspaceId, onComplete }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `/api/workspaces/${workspaceId}/custom-data/upload`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: formData,
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      setPreview(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/custom-data/confirm`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sourceName: file.name.replace(/\.[^/.]+$/, ''),
            description: '',
            detectedSchema: preview.detectedSchema,
            parsedRows: preview.preview.sampleData,
            filename: preview.preview.filename,
            fileSize: preview.preview.fileSize,
            aiSuggestions: preview.aiSuggestions,
          }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      onComplete(result.source);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="custom-data-upload">
      {!preview ? (
        <div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            disabled={loading}
          />
          <button onClick={handleUpload} disabled={!file || loading}>
            {loading ? 'Uploading...' : 'Upload & Preview'}
          </button>
        </div>
      ) : (
        <div>
          <h3>Preview: {preview.preview.filename}</h3>
          <p>Total Rows: {preview.preview.totalRows}</p>

          <h4>Detected Schema:</h4>
          <ul>
            {preview.detectedSchema.columns.map(col => (
              <li key={col.name}>
                {col.name} - {col.type} ({col.role})
              </li>
            ))}
          </ul>

          <h4>AI Recommendations:</h4>
          <ul>
            {preview.aiSuggestions.recommendedWidgets.map((widget, i) => (
              <li key={i}>
                {widget.type}: {widget.title}
              </li>
            ))}
          </ul>

          <div>
            <button onClick={handleConfirm} disabled={loading}>
              {loading ? 'Importing...' : 'Confirm Import'}
            </button>
            <button onClick={() => setPreview(null)} disabled={loading}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}

export default CustomDataUpload;
```

---

## Google Sheets Integration

### Step 1: Initiate OAuth Flow

```javascript
function connectGoogleSheet(workspaceId, googleSheetUrl) {
  const authUrl = `https://api.yourapp.com/api/oauth/google-sheets/initiate?` +
    `workspaceId=${workspaceId}&` +
    `googleSheetUrl=${encodeURIComponent(googleSheetUrl)}`;

  // Redirect to OAuth
  window.location.href = authUrl;
}

// Usage in a form
document.getElementById('google-sheets-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const sheetUrl = document.getElementById('sheet-url').value;
  connectGoogleSheet('workspace-123', sheetUrl);
});
```

### Step 2: Handle OAuth Callback

The OAuth callback is handled automatically by the backend. After successful authorization, the user is redirected to a success page:

```javascript
// On the success page (e.g., /oauth/success)
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    sourceId: params.get('sourceId'),
    sourceName: params.get('sourceName'),
    workspaceId: params.get('workspaceId'),
  };
}

const { sourceId, workspaceId } = getUrlParams();
if (sourceId) {
  // Redirect to source details or dashboard
  window.location.href = `/workspaces/${workspaceId}/sources/${sourceId}`;
}
```

### Step 3: Monitor Sync Status

```javascript
async function getSyncHistory(workspaceId, sourceId) {
  const response = await fetch(
    `/api/workspaces/${workspaceId}/custom-data/sources/${sourceId}/sync-history`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  const result = await response.json();
  return result.syncJobs;
}

// Display sync history
const syncJobs = await getSyncHistory('workspace-123', 'source-456');
syncJobs.forEach(job => {
  console.log(`${job.jobType}: ${job.status}`);
  console.log(`New: ${job.newRows}, Updated: ${job.updatedRows}, Failed: ${job.failedRows}`);
});
```

---

## Creating Dashboards with Custom Data

### Using AI Dashboard Generation

```javascript
async function generateCustomDataDashboard(workspaceId, customSourceIds) {
  const response = await fetch('/api/dashboards/generate-ai', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: 'Create a dashboard showing spend, revenue, and ROI trends over time',
      workspaceId,
      customSourceIds,
      createDashboard: true, // Auto-create the dashboard
    }),
  });

  const result = await response.json();
  return result.dashboard;
}

// Usage
const dashboard = await generateCustomDataDashboard(
  'workspace-123',
  ['source-456', 'source-789']
);

console.log('Dashboard created:', dashboard);
window.location.href = `/dashboards/${dashboard.id}`;
```

### Manual Widget Creation with Custom Data

```javascript
async function createCustomDataWidget(dashboardId, sourceId) {
  const widget = {
    dashboard_id: dashboardId,
    widget_type: 'line_chart',
    title: 'Monthly Spend Trend',
    position: { x: 0, y: 0, width: 6, height: 4 },
    data_source: {
      type: 'custom_data',
      customSourceId: sourceId,
      metric: 'spend',
      aggregation: 'sum',
      filters: {
        campaign: 'Summer Sale'
      },
      dateRange: 'last_30_days',
    },
  };

  const response = await fetch(`/api/dashboards/${dashboardId}/widgets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(widget),
  });

  return await response.json();
}
```

### Mixed Platform + Custom Data Widget

```javascript
// Create a widget comparing platform data with custom data
const mixedWidget = {
  dashboard_id: dashboardId,
  widget_type: 'bar_chart',
  title: 'Ad Spend Comparison',
  data_source: {
    type: 'mixed',
    sources: [
      {
        type: 'platform',
        adAccountId: 'meta-account-123',
        metric: 'spend',
      },
      {
        type: 'custom_data',
        customSourceId: 'source-456',
        metric: 'spend',
        aggregation: 'sum',
      },
    ],
  },
};
```

---

## Advanced Querying

### Basic Query Example

```javascript
async function queryCustomData(workspaceId, sourceId, query) {
  const response = await fetch(
    `/api/workspaces/${workspaceId}/custom-data/sources/${sourceId}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    }
  );

  return await response.json();
}

// Query: Get top 10 campaigns by spend
const result = await queryCustomData('workspace-123', 'source-456', {
  select: ['campaign', 'spend'],
  filters: {},
  groupBy: ['campaign'],
  orderBy: ['spend DESC'],
  limit: 10,
  offset: 0,
  dateRange: {
    startDate: '2024-01-01',
    endDate: '2024-12-31',
  },
});

console.log('Top campaigns:', result.data);
```

### Complex Filtering Example

```javascript
// Query: Get performance for specific campaigns in US region
const result = await queryCustomData('workspace-123', 'source-456', {
  select: ['date', 'campaign', 'spend', 'revenue'],
  filters: {
    campaign: ['Summer Sale', 'Winter Campaign'],
    region: 'US',
  },
  groupBy: ['date', 'campaign'],
  orderBy: ['date DESC'],
  limit: 100,
  dateRange: {
    startDate: '2024-10-01',
    endDate: '2024-12-31',
  },
});
```

### Building a Custom Analytics Dashboard

```javascript
// Get metrics for multiple dimensions
async function getMultiDimensionalAnalytics(workspaceId, sourceId) {
  // 1. Get spend by campaign
  const byCampaign = await queryCustomData(workspaceId, sourceId, {
    select: ['campaign', 'spend', 'clicks'],
    groupBy: ['campaign'],
    orderBy: ['spend DESC'],
    limit: 10,
  });

  // 2. Get daily trends
  const dailyTrends = await queryCustomData(workspaceId, sourceId, {
    select: ['date', 'spend', 'revenue'],
    groupBy: ['date'],
    orderBy: ['date ASC'],
    dateRange: {
      startDate: '2024-11-01',
      endDate: '2024-12-31',
    },
  });

  // 3. Get regional performance
  const byRegion = await queryCustomData(workspaceId, sourceId, {
    select: ['region', 'spend', 'revenue'],
    groupBy: ['region'],
    orderBy: ['revenue DESC'],
  });

  return {
    topCampaigns: byCampaign.data,
    dailyTrends: dailyTrends.data,
    regionalPerformance: byRegion.data,
  };
}
```

---

## Sync Management

### Trigger Manual Sync

```javascript
async function triggerSync(workspaceId, sourceId) {
  const response = await fetch(
    `/api/workspaces/${workspaceId}/custom-data/sources/${sourceId}/sync`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  return await response.json();
}

// Usage with status polling
async function syncWithStatusUpdates(workspaceId, sourceId) {
  console.log('Starting sync...');
  const syncResult = await triggerSync(workspaceId, sourceId);

  if (!syncResult.success) {
    throw new Error(syncResult.error);
  }

  // Poll sync status every 5 seconds
  const syncJobId = syncResult.syncJobId;
  const pollInterval = setInterval(async () => {
    const history = await getSyncHistory(workspaceId, sourceId);
    const latestJob = history.find(job => job.id === syncJobId);

    if (latestJob && latestJob.status !== 'in_progress') {
      clearInterval(pollInterval);

      if (latestJob.status === 'completed') {
        console.log(`Sync completed: ${latestJob.newRows} new, ${latestJob.updatedRows} updated`);
      } else {
        console.error('Sync failed:', latestJob.errorMessage);
      }
    }
  }, 5000);
}
```

### Update Sync Settings

```javascript
async function updateSyncSettings(workspaceId, sourceId, settings) {
  const response = await fetch(
    `/api/workspaces/${workspaceId}/custom-data/sources/${sourceId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        syncEnabled: settings.enabled,
        syncFrequency: settings.frequency, // 'hourly', 'daily', 'weekly'
      }),
    }
  );

  return await response.json();
}

// Enable hourly sync
await updateSyncSettings('workspace-123', 'source-456', {
  enabled: true,
  frequency: 'hourly',
});
```

---

## Error Handling

### Comprehensive Error Handling Example

```javascript
async function uploadFileWithErrorHandling(workspaceId, file) {
  try {
    // Validate file size
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_SIZE) {
      throw new Error('File size exceeds 50MB limit');
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];

    if (!allowedTypes.includes(file.type) &&
        !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      throw new Error('Invalid file type. Only Excel and CSV files are allowed');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `/api/workspaces/${workspaceId}/custom-data/upload`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      }
    );

    const result = await response.json();

    // Handle API errors
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in');
      } else if (response.status === 413) {
        throw new Error('File is too large');
      } else if (response.status === 429) {
        throw new Error('Too many uploads. Please try again later');
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    }

    if (!result.success) {
      throw new Error(result.error);
    }

    return result;

  } catch (error) {
    console.error('Upload error:', error);

    // Show user-friendly error message
    if (error.message.includes('NetworkError')) {
      throw new Error('Network error. Please check your connection');
    }

    throw error;
  }
}
```

### Retry Logic for Sync Operations

```javascript
async function syncWithRetry(workspaceId, sourceId, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Sync attempt ${attempt}/${maxRetries}`);
      const result = await triggerSync(workspaceId, sourceId);

      if (result.success) {
        console.log('Sync started successfully');
        return result;
      }

      lastError = new Error(result.error || 'Sync failed');
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt} failed:`, error.message);

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Sync failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

---

## Frontend Integration Examples

### Complete Custom Data Manager Component (Vue.js)

```vue
<template>
  <div class="custom-data-manager">
    <h2>Custom Data Sources</h2>

    <!-- Upload Section -->
    <div class="upload-section">
      <input
        type="file"
        ref="fileInput"
        accept=".xlsx,.xls,.csv"
        @change="handleFileSelect"
      />
      <button @click="handleUpload" :disabled="!selectedFile || uploading">
        {{ uploading ? 'Uploading...' : 'Upload File' }}
      </button>
    </div>

    <!-- Google Sheets Section -->
    <div class="google-sheets-section">
      <input
        v-model="googleSheetUrl"
        type="text"
        placeholder="Google Sheets URL"
      />
      <button @click="connectGoogleSheet" :disabled="!googleSheetUrl">
        Connect Google Sheet
      </button>
    </div>

    <!-- Sources List -->
    <div class="sources-list">
      <h3>Your Data Sources</h3>
      <div v-for="source in sources" :key="source.id" class="source-card">
        <h4>{{ source.name }}</h4>
        <p>Type: {{ source.type }}</p>
        <p>Rows: {{ source.rowCount }}</p>

        <div v-if="source.type === 'google_sheets'" class="sync-info">
          <p>Sync: {{ source.syncEnabled ? 'Enabled' : 'Disabled' }}</p>
          <p v-if="source.lastSyncedAt">
            Last synced: {{ formatDate(source.lastSyncedAt) }}
          </p>
          <button @click="triggerSync(source.id)">Manual Sync</button>
        </div>

        <button @click="viewSource(source.id)">View Details</button>
        <button @click="deleteSource(source.id)" class="danger">Delete</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CustomDataManager',
  props: ['workspaceId'],
  data() {
    return {
      sources: [],
      selectedFile: null,
      uploading: false,
      googleSheetUrl: '',
    };
  },
  async mounted() {
    await this.loadSources();
  },
  methods: {
    async loadSources() {
      const response = await fetch(
        `/api/workspaces/${this.workspaceId}/custom-data/sources`,
        {
          headers: { 'Authorization': `Bearer ${this.getToken()}` },
        }
      );
      const result = await response.json();
      this.sources = result.sources || [];
    },
    handleFileSelect(event) {
      this.selectedFile = event.target.files[0];
    },
    async handleUpload() {
      // Implementation from previous examples
    },
    connectGoogleSheet() {
      window.location.href =
        `/api/oauth/google-sheets/initiate?` +
        `workspaceId=${this.workspaceId}&` +
        `googleSheetUrl=${encodeURIComponent(this.googleSheetUrl)}`;
    },
    async triggerSync(sourceId) {
      const response = await fetch(
        `/api/workspaces/${this.workspaceId}/custom-data/sources/${sourceId}/sync`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${this.getToken()}` },
        }
      );
      const result = await response.json();
      alert(result.message || 'Sync started');
      await this.loadSources();
    },
    viewSource(sourceId) {
      this.$router.push(`/workspaces/${this.workspaceId}/sources/${sourceId}`);
    },
    async deleteSource(sourceId) {
      if (!confirm('Are you sure you want to delete this source?')) return;

      await fetch(
        `/api/workspaces/${this.workspaceId}/custom-data/sources/${sourceId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${this.getToken()}` },
        }
      );

      await this.loadSources();
    },
    getToken() {
      return localStorage.getItem('token');
    },
    formatDate(date) {
      return new Date(date).toLocaleString();
    },
  },
};
</script>
```

---

## Best Practices

### 1. Data Validation Before Import

```javascript
function validateDataBeforeImport(preview) {
  const issues = [];

  // Check for date column
  if (!preview.detectedSchema.primaryDateColumn) {
    issues.push('No date column detected. Time-series analysis may be limited.');
  }

  // Check for metrics
  const metrics = preview.detectedSchema.columns.filter(c => c.role === 'metric');
  if (metrics.length === 0) {
    issues.push('No numeric metrics detected.');
  }

  // Check data quality
  if (preview.aiSuggestions.warnings) {
    issues.push(...preview.aiSuggestions.warnings);
  }

  return issues;
}
```

### 2. Caching Awareness

```javascript
// Data is cached for 5 minutes
// Force refresh if needed by invalidating cache through source update
async function forceRefreshData(workspaceId, sourceId) {
  // Trigger any update to invalidate cache
  await fetch(
    `/api/workspaces/${workspaceId}/custom-data/sources/${sourceId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: new Date().toISOString(), // Dummy update
      }),
    }
  );
}
```

### 3. Performance Optimization

```javascript
// Use pagination for large datasets
async function loadDataInBatches(workspaceId, sourceId) {
  const batchSize = 1000;
  let offset = 0;
  let allData = [];
  let hasMore = true;

  while (hasMore) {
    const result = await queryCustomData(workspaceId, sourceId, {
      select: ['*'],
      limit: batchSize,
      offset,
    });

    allData = allData.concat(result.data);
    hasMore = result.pagination.hasMore;
    offset += batchSize;
  }

  return allData;
}
```

---

## Troubleshooting

### Common Issues

1. **File Upload Fails**
   - Check file size (max 50MB)
   - Verify file type (.xlsx, .xls, .csv)
   - Ensure proper authentication

2. **Google Sheets Sync Issues**
   - Verify OAuth permissions
   - Check if sheet is shared properly
   - Review sync history for error details

3. **Query Performance**
   - Add appropriate filters to reduce data volume
   - Use pagination for large result sets
   - Check Redis cache is enabled

4. **Widget Data Not Updating**
   - Wait for cache TTL (5 minutes)
   - Trigger manual sync for Google Sheets
   - Check source sync status

---

## Support Resources

- **API Documentation:** `/docs/CUSTOM_DATA_API.md`
- **Error Logs:** Check `/api/workspaces/:workspaceId/errors`
- **Sync History:** Review sync jobs for detailed error messages
- **GitHub Issues:** Report bugs at https://github.com/your-repo/issues
