# Custom Data Feature - Complete Implementation

## Overview

The Custom Data feature allows users to import data from Excel files, CSV files, or Google Sheets and seamlessly integrate it with platform data (Meta, Google Ads, TikTok, LinkedIn, Search Console) in unified dashboards. The system includes:

- **AI-Powered Schema Detection** - Automatic column type detection and data structure analysis
- **Real-Time Sync** - Automatic synchronization for Google Sheets with configurable frequencies
- **Flexible Querying** - Advanced filtering, grouping, and aggregation capabilities
- **Dashboard Integration** - Mix custom data with platform data in AI-generated dashboards
- **Performance Optimization** - Redis caching with 5-minute TTL for fast data retrieval

---

## Features

### ✨ Key Capabilities

1. **Multi-Format Support**
   - Excel files (.xlsx, .xls)
   - CSV files
   - Google Sheets (with OAuth)

2. **AI-Powered Intelligence**
   - Automatic schema detection
   - Column type identification (dates, metrics, dimensions)
   - Visualization recommendations
   - Data quality analysis

3. **Real-Time Google Sheets Sync**
   - OAuth 2.0 integration
   - Configurable sync frequencies (hourly, daily, weekly, manual)
   - Webhook support for instant updates
   - Sync history and error tracking

4. **Advanced Data Management**
   - Deduplication based on date + dimensions
   - Batch processing (1000 rows per batch)
   - Support for up to 100,000 rows per source
   - JSONB storage for flexible schema

5. **Dashboard Integration**
   - AI dashboard generation with custom data
   - Mix platform and custom data in single widgets
   - Full widget compatibility (charts, metrics, tables)
   - Real-time updates with cache invalidation

6. **Performance & Scalability**
   - Redis caching (5-minute TTL)
   - PostgreSQL GIN indexes for JSONB queries
   - Materialized views for daily aggregates
   - Optimized batch operations

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Custom Data System                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ File Upload  │  │ Google OAuth │  │ Sync Scheduler│      │
│  │  (Multer)    │  │  (OAuth 2.0) │  │  (node-cron) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         AI Schema Detection (Claude Sonnet 4.5)     │   │
│  │  - Column types    - Date detection                 │   │
│  │  - Metrics vs Dims - Visualization suggestions      │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Data Processing Pipeline                │   │
│  │  - Excel/CSV parsing  - Row transformation          │   │
│  │  - Deduplication      - Batch insertion             │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          PostgreSQL Storage (3 Tables)               │   │
│  │  custom_data_sources   custom_data_records          │   │
│  │  custom_data_sync_jobs                              │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Redis Caching Layer (5min TTL)              │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Widget Data Service (Unified API)            │   │
│  │  - Platform data   - Custom data   - Mixed data     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

**custom_data_sources** - Metadata for each data source
- Source identification (type, name, description)
- Google Sheets info (sheet_id, oauth_token_id)
- AI-detected schema
- Sync configuration
- Statistics (row_count, metric/dimension columns)

**custom_data_records** - Time-series optimized data storage
- source_id (FK to custom_data_sources)
- record_date (indexed for fast queries)
- dimensions JSONB (campaign, region, etc.)
- metrics JSONB (spend, clicks, revenue, etc.)
- hash_key (MD5 for deduplication)

**custom_data_sync_jobs** - Sync operation tracking
- job_type (initial_import, scheduled_sync, manual_refresh)
- status, progress tracking
- Error details and AI analysis results

---

## Installation & Setup

### Prerequisites

- Node.js 16+
- PostgreSQL 14+
- Redis 6+
- Google Cloud Platform account (for Google Sheets integration)

### 1. Install Dependencies

```bash
npm install multer xlsx csv-parser node-cron
```

Dependencies added:
- `multer@2.0.2` - File upload handling
- `xlsx@0.18.5` - Excel parsing
- `csv-parser@3.0.0` - CSV parsing
- `node-cron@3.0.2` - Sync scheduler
- `redis@5.10.0` - Caching layer

### 2. Database Migrations

Run migrations in order:

```bash
# 1. Custom data tables
psql -h localhost -U your_user -d your_db -f src/database/migrations/011_custom_data_sources.sql

# 2. Performance indexes
psql -h localhost -U your_user -d your_db -f src/database/migrations/012_custom_data_indexes_optimization.sql

# 3. Cache metadata
psql -h localhost -U your_user -d your_db -f src/database/migrations/013_cache_metadata.sql
```

### 3. Environment Configuration

Add to `.env`:

```env
# Google OAuth for Sheets
GOOGLE_OAUTH_CLIENT_ID=your_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/oauth/google-sheets/callback

# Anthropic API for AI features
ANTHROPIC_API_KEY=your_anthropic_api_key

# Redis Configuration
REDIS_URL=redis://localhost:6379
```

### 4. Google Cloud Platform Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Sheets API
4. Enable Google Drive API
5. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/oauth/google-sheets/callback`
6. Copy Client ID and Client Secret to `.env`

### 5. Start Services

```bash
# Start Redis
redis-server

# Start PostgreSQL (if not running)
brew services start postgresql

# Start application
npm run dev
```

---

## Usage Examples

### Quick Start - Excel Upload

```javascript
// 1. Upload file
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const preview = await fetch('/api/workspaces/123/custom-data/upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData,
}).then(r => r.json());

// 2. Confirm import
const result = await fetch('/api/workspaces/123/custom-data/confirm', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sourceName: 'My Campaign Data',
    detectedSchema: preview.detectedSchema,
    parsedRows: preview.preview.sampleData,
    filename: preview.preview.filename,
    fileSize: preview.preview.fileSize,
    aiSuggestions: preview.aiSuggestions,
  }),
}).then(r => r.json());

console.log('Source created:', result.source.id);
```

### Quick Start - Google Sheets

```javascript
// 1. Redirect to OAuth
window.location.href = '/api/oauth/google-sheets/initiate?' +
  `workspaceId=123&` +
  `googleSheetUrl=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID`;

// 2. After OAuth callback, data is automatically imported
// User is redirected to: /oauth/success?sourceId=abc&workspaceId=123
```

### Quick Start - AI Dashboard

```javascript
const dashboard = await fetch('/api/dashboards/generate-ai', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: 'Create a dashboard showing revenue and ROI trends',
    workspaceId: '123',
    customSourceIds: ['source-456'],
    createDashboard: true,
  }),
}).then(r => r.json());

console.log('Dashboard created:', dashboard.dashboard.id);
```

---

## API Reference

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workspaces/:id/custom-data/upload` | POST | Upload file for preview |
| `/api/workspaces/:id/custom-data/confirm` | POST | Confirm import after preview |
| `/api/oauth/google-sheets/initiate` | GET | Start Google Sheets OAuth |
| `/api/workspaces/:id/custom-data/sources` | GET | List all sources |
| `/api/workspaces/:id/custom-data/sources/:sourceId` | GET | Get source details |
| `/api/workspaces/:id/custom-data/sources/:sourceId` | PUT | Update source |
| `/api/workspaces/:id/custom-data/sources/:sourceId` | DELETE | Delete source |
| `/api/workspaces/:id/custom-data/sources/:sourceId/metrics` | GET | Get metrics data |
| `/api/workspaces/:id/custom-data/sources/:sourceId/query` | POST | Advanced query |
| `/api/workspaces/:id/custom-data/sources/:sourceId/sync` | POST | Trigger manual sync |
| `/api/workspaces/:id/custom-data/sources/:sourceId/sync-history` | GET | Get sync history |

**Full API documentation:** [docs/CUSTOM_DATA_API.md](./CUSTOM_DATA_API.md)

---

## File Structure

```
src/
├── controllers/
│   └── customDataController.js         # Upload, import, CRUD operations
├── services/
│   ├── aiCustomData.js                  # AI schema detection & suggestions
│   ├── customDataParser.js              # Excel/CSV parsing
│   ├── googleSheetsSync.js              # Real-time sync logic
│   ├── widgetDataService.js             # Unified data fetching
│   └── platforms/
│       ├── googleSheets.js              # Google Sheets OAuth service
│       └── index.js                     # Platform service registry
├── models/
│   └── CustomDataSource.js              # ORM for custom data
├── routes/
│   ├── customDataRoutes.js              # Custom data endpoints
│   └── webhookRoutes.js                 # Google Drive webhooks
├── jobs/
│   └── customDataSyncScheduler.js       # Cron-based scheduler
├── middleware/
│   ├── errorHandler.js                  # Enhanced error handling
│   └── auth.js                          # Authentication
├── utils/
│   └── errors.js                        # Custom error classes
├── config/
│   └── redis.js                         # Redis caching configuration
└── database/
    └── migrations/
        ├── 011_custom_data_sources.sql  # Main tables
        ├── 012_custom_data_indexes_optimization.sql  # Indexes
        └── 013_cache_metadata.sql       # Cache tracking

docs/
├── CUSTOM_DATA_README.md                # This file
├── CUSTOM_DATA_API.md                   # API documentation
└── CUSTOM_DATA_USAGE_GUIDE.md           # Usage examples
```

---

## Performance Optimization

### Caching Strategy

**Redis Cache:**
- TTL: 5 minutes
- Cache key format: `widget:data:<md5_hash>`
- Automatic invalidation on:
  - Source updates
  - Source deletes
  - Google Sheets sync completion

**Database Optimization:**
- GIN indexes on JSONB columns with `jsonb_path_ops`
- Composite indexes on (source_id, record_date DESC)
- Materialized views for daily aggregates
- Batch inserts (1000 rows per batch)

### Query Performance

```sql
-- Example optimized query using indexes
SELECT
  record_date,
  SUM((metrics->>'spend')::numeric) as total_spend
FROM custom_data_records
WHERE source_id = 'abc'
  AND record_date >= '2024-01-01'
  AND record_date <= '2024-12-31'
  AND dimensions @> '{"campaign":"Summer"}'::jsonb
GROUP BY record_date
ORDER BY record_date DESC;

-- Uses indexes:
-- - idx_custom_data_records_source_date_composite
-- - idx_custom_data_records_dimensions_jsonb_path
```

---

## Error Handling

### Custom Error Classes

The system uses specialized error classes for consistent error handling:

```javascript
const {
  ValidationError,      // 400 - Invalid input
  AuthenticationError,  // 401 - Auth required
  AuthorizationError,   // 403 - Access denied
  NotFoundError,        // 404 - Resource not found
  ConflictError,        // 409 - Resource exists
  RateLimitError,       // 429 - Too many requests
  FileProcessingError,  // 422 - File processing failed
  SyncError,            // 500 - Sync operation failed
} = require('./utils/errors');

// Usage
if (!sourceName) {
  throw new ValidationError('Source name is required');
}

if (source.workspace_id !== userWorkspaceId) {
  throw new AuthorizationError('Access denied to this source');
}
```

### Error Logging

All errors are logged to the `error_logs` table with:
- User context (user_id, workspace_id)
- Request details (URL, method, body)
- Error details (type, message, stack trace)
- Client info (IP, user agent)

---

## Testing

### Test File Upload

```bash
curl -X POST \
  "http://localhost:3000/api/workspaces/WORKSPACE_ID/custom-data/upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-data.xlsx"
```

### Test Query API

```bash
curl -X POST \
  "http://localhost:3000/api/workspaces/WORKSPACE_ID/custom-data/sources/SOURCE_ID/query" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "select": ["date", "campaign", "spend"],
    "filters": {"campaign": ["Summer Sale"]},
    "groupBy": ["campaign"],
    "limit": 10
  }'
```

### Test Google Sheets Sync

```bash
curl -X POST \
  "http://localhost:3000/api/workspaces/WORKSPACE_ID/custom-data/sources/SOURCE_ID/sync" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Monitoring

### Health Checks

```bash
# Server health
curl http://localhost:3000/api/health

# Redis health
redis-cli ping

# Database health
psql -c "SELECT COUNT(*) FROM custom_data_sources;"
```

### Sync Monitoring

```javascript
// Get sync statistics
const history = await fetch(
  `/api/workspaces/${workspaceId}/custom-data/sources/${sourceId}/sync-history`
).then(r => r.json());

history.syncJobs.forEach(job => {
  console.log(`${job.jobType}: ${job.status}`);
  if (job.status === 'completed') {
    console.log(`  New: ${job.newRows}, Updated: ${job.updatedRows}`);
  } else if (job.status === 'failed') {
    console.log(`  Error: ${job.errorMessage}`);
  }
});
```

### Cache Statistics

```javascript
// Get cache stats (admin only)
const stats = await fetch('/api/admin/cache/stats')
  .then(r => r.json());

console.log('Redis DB Size:', stats.dbSize);
console.log('Cache hit rate:', stats.hitRate);
```

---

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production Redis URL
- [ ] Set up SSL certificates
- [ ] Configure CORS origins
- [ ] Enable rate limiting
- [ ] Set up error monitoring (e.g., Sentry)
- [ ] Configure backup schedules for PostgreSQL
- [ ] Set up log aggregation (e.g., ELK stack)
- [ ] Configure Google Cloud credentials
- [ ] Test OAuth redirect URLs
- [ ] Set up monitoring dashboards
- [ ] Configure auto-scaling for Redis

### Environment Variables (Production)

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://prod-redis:6379
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://yourdomain.com/api/oauth/google-sheets/callback
JWT_SECRET=...
CORS_ORIGIN=https://yourdomain.com
```

---

## Troubleshooting

### Common Issues

#### 1. File Upload Fails

**Symptoms:** 413 error or timeout

**Solutions:**
- Check file size (max 50MB)
- Verify multer configuration
- Increase nginx/proxy limits if behind reverse proxy

#### 2. Google Sheets Sync Errors

**Symptoms:** 401/403 errors in sync jobs

**Solutions:**
- Check OAuth token expiration
- Verify sheet sharing permissions
- Ensure redirect URI matches Google Console

#### 3. Slow Query Performance

**Symptoms:** Query timeouts or slow responses

**Solutions:**
- Check indexes: `\d+ custom_data_records`
- Verify Redis is running: `redis-cli ping`
- Review query filters (add specific filters)
- Check materialized view refresh

#### 4. Cache Not Working

**Symptoms:** Every request hits database

**Solutions:**
- Verify Redis connection in logs
- Check `isRedisAvailable()` returns true
- Review cache key generation
- Check cache TTL settings

---

## Security Considerations

### Data Protection

1. **Authentication:** All endpoints require JWT token
2. **Authorization:** Workspace access validated on every request
3. **File Validation:** Strict MIME type and extension checking
4. **SQL Injection:** Parameterized queries throughout
5. **XSS Prevention:** JSON sanitization on output
6. **OAuth Security:** State parameter for CSRF protection

### Rate Limiting

Implemented rate limits (see `/src/middleware/rateLimit.js`):
- File uploads: 10/hour per workspace
- Sync operations: 1 per 5 minutes per source
- Query API: 100/minute per workspace
- Metrics API: 500/minute per workspace

---

## Support & Documentation

- **API Documentation:** [docs/CUSTOM_DATA_API.md](./CUSTOM_DATA_API.md)
- **Usage Guide:** [docs/CUSTOM_DATA_USAGE_GUIDE.md](./CUSTOM_DATA_USAGE_GUIDE.md)
- **GitHub Issues:** https://github.com/your-repo/issues
- **Email Support:** support@yourapp.com

---

## License

[Your License Here]

---

## Credits

Built with:
- [multer](https://github.com/expressjs/multer) - File upload handling
- [xlsx](https://github.com/SheetJS/sheetjs) - Excel parsing
- [csv-parser](https://github.com/mafintosh/csv-parser) - CSV parsing
- [node-cron](https://github.com/node-cron/node-cron) - Task scheduling
- [Redis](https://redis.io/) - Caching layer
- [Claude Sonnet 4.5](https://www.anthropic.com/) - AI-powered features

---

**Last Updated:** December 2024
**Version:** 1.0.0
