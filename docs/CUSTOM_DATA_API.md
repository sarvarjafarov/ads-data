# Custom Data API Documentation

## Overview

The Custom Data API allows users to import data from Excel files, CSV files, or Google Sheets and use it alongside platform data (Meta, Google Ads, etc.) in dashboards. The system includes AI-powered schema detection, real-time sync for Google Sheets, and flexible querying capabilities.

## Authentication

All API endpoints require authentication via JWT token:

```
Authorization: Bearer <token>
```

Or via cookie:
```
Cookie: token=<token>
```

## Base URL

```
https://your-domain.com/api
```

---

## Endpoints

### 1. Upload and Preview File

Upload an Excel or CSV file for preview and AI-powered schema detection.

**Endpoint:** `POST /api/workspaces/:workspaceId/custom-data/upload`

**Request:**
- Content-Type: `multipart/form-data`
- Body: Form data with file field

```bash
curl -X POST \
  "http://localhost:3000/api/workspaces/123e4567-e89b-12d3-a456-426614174000/custom-data/upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/data.xlsx"
```

**Response:**
```json
{
  "success": true,
  "preview": {
    "filename": "data.xlsx",
    "fileSize": 245678,
    "totalRows": 1500,
    "sampleData": [
      {
        "date": "2024-01-01",
        "campaign": "Summer Sale",
        "spend": 125.50,
        "clicks": 450
      }
    ]
  },
  "detectedSchema": {
    "columns": [
      {
        "name": "date",
        "type": "date",
        "format": "YYYY-MM-DD",
        "role": "date"
      },
      {
        "name": "campaign",
        "type": "string",
        "role": "dimension"
      },
      {
        "name": "spend",
        "type": "currency",
        "role": "metric",
        "aggregation": "sum"
      },
      {
        "name": "clicks",
        "type": "integer",
        "role": "metric",
        "aggregation": "sum"
      }
    ],
    "primaryDateColumn": "date",
    "confidence": 0.95
  },
  "aiSuggestions": {
    "recommendedWidgets": [
      {
        "type": "line_chart",
        "metric": "spend",
        "title": "Spend Over Time",
        "reasoning": "Time series data with numeric spend values"
      },
      {
        "type": "bar_chart",
        "metric": "clicks",
        "groupBy": ["campaign"],
        "title": "Clicks by Campaign",
        "reasoning": "Compare performance across campaigns"
      }
    ],
    "insights": [
      "Data contains 1,500 records spanning 90 days",
      "3 campaigns identified",
      "Average daily spend: $125.50"
    ]
  }
}
```

**Error Responses:**
- `400` - Invalid file type or missing file
- `413` - File too large (max 50MB)
- `401` - Unauthorized
- `500` - Server error

---

### 2. Confirm Import

Confirm the import after reviewing the preview and schema.

**Endpoint:** `POST /api/workspaces/:workspaceId/custom-data/confirm`

**Request:**
```json
{
  "sourceName": "Q4 Campaign Data",
  "description": "Sales campaign performance data for Q4 2024",
  "detectedSchema": { ... },
  "parsedRows": [ ... ],
  "filename": "data.xlsx",
  "fileSize": 245678,
  "syncEnabled": false,
  "syncFrequency": null,
  "aiSuggestions": { ... }
}
```

**Response:**
```json
{
  "success": true,
  "source": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Q4 Campaign Data",
    "type": "excel",
    "rowCount": 1500,
    "dateColumn": "date",
    "metricColumns": ["spend", "clicks", "impressions"],
    "dimensionColumns": ["campaign", "region"]
  },
  "import": {
    "totalRows": 1500,
    "insertedRows": 1500,
    "failedRows": 0,
    "syncJobId": "sync-job-id"
  },
  "aiSuggestions": { ... },
  "message": "Successfully imported 1500 rows."
}
```

**Notes:**
- Data is imported in batches of 1000 rows for efficiency
- AI quality analysis runs in the background
- Deduplication is automatic based on date + dimensions

---

### 3. Connect Google Sheets

Initiate OAuth flow to connect a Google Sheets data source.

**Endpoint:** `GET /api/oauth/google-sheets/initiate`

**Query Parameters:**
- `workspaceId` (required): Workspace UUID
- `googleSheetUrl` (required): Full Google Sheets URL

**Example:**
```bash
curl "http://localhost:3000/api/oauth/google-sheets/initiate?workspaceId=123e4567-e89b-12d3-a456-426614174000&googleSheetUrl=https://docs.google.com/spreadsheets/d/1ABC123/edit"
```

**Response:**
Redirects to Google OAuth consent screen. After approval, redirects to callback URL with authorization code.

**Callback:** `GET /api/oauth/google-sheets/callback`

The callback handles:
1. Token exchange
2. Fetching spreadsheet data
3. AI schema detection
4. Creating custom data source
5. Initial data import
6. Redirecting to success page

---

### 4. Get All Custom Data Sources

List all custom data sources for a workspace.

**Endpoint:** `GET /api/workspaces/:workspaceId/custom-data/sources`

**Response:**
```json
{
  "success": true,
  "sources": [
    {
      "id": "source-id-1",
      "name": "Q4 Campaign Data",
      "type": "excel",
      "rowCount": 1500,
      "dateColumn": "date",
      "metricColumns": ["spend", "clicks"],
      "dimensionColumns": ["campaign"],
      "syncEnabled": false,
      "syncStatus": null,
      "lastSyncedAt": null,
      "createdAt": "2024-12-15T10:00:00Z"
    },
    {
      "id": "source-id-2",
      "name": "Regional Performance",
      "type": "google_sheets",
      "rowCount": 850,
      "dateColumn": "report_date",
      "metricColumns": ["revenue", "orders"],
      "dimensionColumns": ["region", "product"],
      "syncEnabled": true,
      "syncFrequency": "hourly",
      "syncStatus": "active",
      "lastSyncedAt": "2024-12-15T11:00:00Z",
      "nextSyncAt": "2024-12-15T12:00:00Z",
      "createdAt": "2024-12-10T15:30:00Z"
    }
  ],
  "count": 2
}
```

---

### 5. Get Single Custom Data Source

Get detailed information about a specific custom data source.

**Endpoint:** `GET /api/workspaces/:workspaceId/custom-data/sources/:sourceId`

**Response:**
```json
{
  "success": true,
  "source": {
    "id": "source-id-1",
    "name": "Q4 Campaign Data",
    "description": "Sales campaign performance data",
    "type": "excel",
    "rowCount": 1500,
    "detectedSchema": { ... },
    "columnMappings": {},
    "sampleData": [ ... ],
    "dateColumn": "date",
    "metricColumns": ["spend", "clicks", "impressions"],
    "dimensionColumns": ["campaign", "region"],
    "syncEnabled": false,
    "recommendedVisualizations": [ ... ],
    "createdAt": "2024-12-15T10:00:00Z",
    "updatedAt": "2024-12-15T10:00:00Z"
  }
}
```

---

### 6. Update Custom Data Source

Update source settings and configuration.

**Endpoint:** `PUT /api/workspaces/:workspaceId/custom-data/sources/:sourceId`

**Request:**
```json
{
  "sourceName": "Q4 Campaign Data - Updated",
  "description": "Updated description",
  "columnMappings": {
    "campaign_name": "campaign",
    "total_spend": "spend"
  },
  "syncEnabled": true,
  "syncFrequency": "daily"
}
```

**Response:**
```json
{
  "success": true,
  "source": {
    "id": "source-id-1",
    "name": "Q4 Campaign Data - Updated",
    "syncEnabled": true,
    "syncFrequency": "daily",
    "updatedAt": "2024-12-15T12:00:00Z"
  }
}
```

**Notes:**
- Updates automatically invalidate cached widget data
- Changing syncFrequency recalculates next sync time

---

### 7. Delete Custom Data Source

Delete a custom data source and all associated records.

**Endpoint:** `DELETE /api/workspaces/:workspaceId/custom-data/sources/:sourceId`

**Response:**
```json
{
  "success": true,
  "message": "Custom data source deleted successfully"
}
```

**Notes:**
- Cascades delete to all records and sync jobs
- Automatically invalidates cached data
- Cannot be undone

---

### 8. Get Metrics Data

Fetch aggregated metrics data for dashboard widgets.

**Endpoint:** `GET /api/workspaces/:workspaceId/custom-data/sources/:sourceId/metrics`

**Query Parameters:**
- `metric` (required): Metric name (e.g., "spend", "clicks")
- `aggregation` (optional): "sum", "avg", "count", "min", "max" (default: "sum")
- `dateRange` (optional): "last_7_days", "last_30_days", "last_90_days", "custom"
- `startDate` (required if dateRange=custom): ISO date string
- `endDate` (required if dateRange=custom): ISO date string
- `filters` (optional): JSON object of dimension filters
- `groupBy` (optional): Comma-separated list of dimensions

**Example:**
```bash
curl -X GET \
  "http://localhost:3000/api/workspaces/123/custom-data/sources/abc/metrics?metric=spend&aggregation=sum&dateRange=last_30_days&filters=%7B%22campaign%22%3A%22Summer%22%7D" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "value": 3567.89,
    "previousValue": 2890.45,
    "changePercent": 23.43,
    "label": "spend",
    "dateRange": {
      "startDate": "2024-11-15",
      "endDate": "2024-12-15"
    },
    "timeSeries": [
      {
        "date": "2024-11-15",
        "value": 125.50
      },
      {
        "date": "2024-11-16",
        "value": 134.20
      }
    ],
    "metadata": {
      "sourceType": "custom_data",
      "sourceName": "Q4 Campaign Data",
      "aggregation": "sum"
    }
  }
}
```

---

### 9. Query Custom Data

Advanced querying with filtering, grouping, and pagination.

**Endpoint:** `POST /api/workspaces/:workspaceId/custom-data/sources/:sourceId/query`

**Request:**
```json
{
  "select": ["date", "campaign", "spend", "clicks"],
  "filters": {
    "campaign": ["Summer Sale", "Winter Campaign"],
    "region": "US"
  },
  "groupBy": ["campaign"],
  "orderBy": ["spend DESC"],
  "dateRange": {
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  },
  "limit": 100,
  "offset": 0
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "campaign": "Summer Sale",
      "spend": 1250.50,
      "clicks": 4500
    },
    {
      "campaign": "Winter Campaign",
      "spend": 890.20,
      "clicks": 3200
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 2,
    "hasMore": false
  }
}
```

**Filter Operators:**
- Array values: `"campaign": ["A", "B"]` → IN operator
- Single values: `"region": "US"` → Equality
- Null values: `"field": null` → IS NULL

---

### 10. Trigger Manual Sync

Manually trigger a sync for Google Sheets sources.

**Endpoint:** `POST /api/workspaces/:workspaceId/custom-data/sources/:sourceId/sync`

**Response:**
```json
{
  "success": true,
  "message": "Sync started",
  "syncJobId": "job-id-123"
}
```

**Error Responses:**
- `400` - Source is not a Google Sheets source
- `409` - Sync already in progress

**Notes:**
- Only available for Google Sheets sources
- Sync runs in background
- 5-minute cooldown between syncs to prevent rate limiting

---

### 11. Get Sync History

Get sync operation history for a source.

**Endpoint:** `GET /api/workspaces/:workspaceId/custom-data/sources/:sourceId/sync-history`

**Query Parameters:**
- `limit` (optional): Number of records (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "syncJobs": [
    {
      "id": "job-id-1",
      "jobType": "scheduled_sync",
      "status": "completed",
      "totalRows": 1500,
      "processedRows": 1500,
      "newRows": 45,
      "updatedRows": 1455,
      "failedRows": 0,
      "startedAt": "2024-12-15T11:00:00Z",
      "completedAt": "2024-12-15T11:02:15Z",
      "duration": 135
    },
    {
      "id": "job-id-2",
      "jobType": "manual_refresh",
      "status": "failed",
      "errorMessage": "Invalid credentials",
      "startedAt": "2024-12-15T10:00:00Z",
      "completedAt": "2024-12-15T10:00:05Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 2,
    "hasMore": false
  }
}
```

---

## Using Custom Data in Dashboards

### Widget Data Source Configuration

When creating or updating dashboard widgets, use custom data sources with the following `data_source` configuration:

```json
{
  "type": "custom_data",
  "customSourceId": "source-id-123",
  "metric": "spend",
  "aggregation": "sum",
  "filters": {
    "campaign": "Summer Sale"
  },
  "groupBy": [],
  "dateRange": "last_30_days"
}
```

### AI Dashboard Generation with Custom Data

When using the AI dashboard generation endpoint, include custom source IDs:

**Endpoint:** `POST /api/dashboards/generate-ai`

**Request:**
```json
{
  "prompt": "Create a dashboard comparing Meta ad spend with my custom campaign data",
  "workspaceId": "workspace-id",
  "adAccountIds": ["meta-account-id"],
  "customSourceIds": ["custom-source-id"],
  "createDashboard": true
}
```

The AI will:
1. Analyze available metrics from both platform and custom sources
2. Generate appropriate widget configurations
3. Create a mixed dashboard with both data types

---

## Caching

All widget data queries are cached in Redis with a 5-minute TTL for optimal performance.

**Cache Invalidation:**
- Automatic on source update/delete
- Automatic after Google Sheets sync
- Manual via cache invalidation endpoint (admin only)

**Cache Key Format:**
```
widget:data:<md5_hash_of_config>
```

---

## Rate Limits

- **File uploads:** 10 per hour per workspace
- **Google Sheets sync:** 1 per 5 minutes per source
- **Query endpoint:** 100 per minute per workspace
- **Metrics endpoint:** 500 per minute per workspace

---

## Data Limits

- **File size:** 50 MB maximum
- **Rows per import:** 100,000 rows maximum
- **Query result limit:** 10,000 rows maximum
- **Sample data:** First 10 rows stored for preview

---

## Sync Frequencies

Available sync frequencies for Google Sheets:

- `hourly` - Every hour
- `daily` - Once per day at midnight UTC
- `weekly` - Every Monday at midnight UTC
- `manual` - Sync disabled, manual trigger only

---

## Error Codes

| Code | Description |
|------|-------------|
| 400  | Bad request - invalid parameters |
| 401  | Unauthorized - missing or invalid token |
| 403  | Forbidden - insufficient permissions |
| 404  | Not found - source or workspace doesn't exist |
| 409  | Conflict - operation already in progress |
| 413  | Payload too large - file exceeds size limit |
| 429  | Too many requests - rate limit exceeded |
| 500  | Internal server error |

---

## Webhooks

Google Drive webhook notifications are handled automatically:

**Endpoint:** `POST /webhooks/google-drive`

**Headers:**
```
X-Goog-Channel-ID: <channel-id>
X-Goog-Resource-ID: <resource-id>
X-Goog-Resource-State: update|change
X-Goog-Message-Number: <number>
```

**Notes:**
- No authentication required (Google signature validation)
- 5-minute cooldown between webhook-triggered syncs
- Sync state transitions: sync → update → change
- Automatically ignores duplicate notifications

---

## Best Practices

1. **Schema Validation:** Always review AI-detected schema before confirming import
2. **Date Columns:** Ensure consistent date formats across your data
3. **Dimension Naming:** Use clear, consistent dimension names for filtering
4. **Sync Frequency:** Choose appropriate frequency based on data update rate
5. **Data Quality:** Clean data before import for best results
6. **Testing:** Use preview endpoint to validate data structure
7. **Monitoring:** Check sync history regularly for Google Sheets sources
8. **Cache Awareness:** Expect 5-minute cache TTL for widget data

---

## Support

For issues or questions:
- Check sync history for error details
- Review AI analysis results in sync jobs
- Contact support with source ID and error messages
