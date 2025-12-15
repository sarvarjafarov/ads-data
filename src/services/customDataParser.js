const XLSX = require('xlsx');
const csv = require('csv-parser');
const { Readable } = require('stream');
const crypto = require('crypto');

class CustomDataParser {
  /**
   * Parse Excel file from buffer
   * @param {Buffer} fileBuffer - File buffer from multer
   * @param {string} filename - Original filename
   * @returns {Object} - Parsed data with rows and metadata
   */
  static parseExcel(fileBuffer, filename) {
    try {
      // Read workbook from buffer
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

      // Get first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });

      if (rows.length === 0) {
        throw new Error('Excel file is empty or has no data rows');
      }

      // Extract headers from first row
      const headers = Object.keys(rows[0]);

      return {
        rows,
        headers,
        totalRows: rows.length,
        sheetName,
        filename
      };
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  /**
   * Parse CSV file from buffer
   * @param {Buffer} fileBuffer - File buffer from multer
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} - Parsed data with rows and metadata
   */
  static async parseCSV(fileBuffer, filename) {
    return new Promise((resolve, reject) => {
      const rows = [];
      let headers = [];

      // Create readable stream from buffer
      const stream = Readable.from(fileBuffer);

      stream
        .pipe(csv())
        .on('headers', (headerList) => {
          headers = headerList;
        })
        .on('data', (row) => {
          rows.push(row);
        })
        .on('end', () => {
          if (rows.length === 0) {
            reject(new Error('CSV file is empty or has no data rows'));
            return;
          }

          resolve({
            rows,
            headers,
            totalRows: rows.length,
            filename
          });
        })
        .on('error', (error) => {
          reject(new Error(`Failed to parse CSV file: ${error.message}`));
        });
    });
  }

  /**
   * Parse file based on mimetype
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} filename - Original filename
   * @param {string} mimetype - File mimetype
   * @returns {Promise<Object>} - Parsed data
   */
  static async parseFile(fileBuffer, filename, mimetype) {
    if (mimetype === 'text/csv' || filename.endsWith('.csv')) {
      return await this.parseCSV(fileBuffer, filename);
    } else if (
      mimetype === 'application/vnd.ms-excel' ||
      mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      filename.endsWith('.xlsx') ||
      filename.endsWith('.xls')
    ) {
      return this.parseExcel(fileBuffer, filename);
    } else {
      throw new Error('Unsupported file type. Please upload Excel (.xlsx, .xls) or CSV files.');
    }
  }

  /**
   * Extract sample data (first N rows)
   * @param {Array} rows - All rows
   * @param {number} sampleSize - Number of rows to sample
   * @returns {Array} - Sample rows
   */
  static getSampleData(rows, sampleSize = 10) {
    return rows.slice(0, sampleSize);
  }

  /**
   * Detect column types from sample data
   * @param {Array} sampleRows - Sample rows
   * @returns {Object} - Column types and stats
   */
  static detectColumnTypes(sampleRows) {
    if (sampleRows.length === 0) {
      return { columns: {}, confidence: 0 };
    }

    const headers = Object.keys(sampleRows[0]);
    const columnStats = {};

    headers.forEach(header => {
      const values = sampleRows.map(row => row[header]).filter(v => v !== null && v !== undefined && v !== '');

      if (values.length === 0) {
        columnStats[header] = {
          type: 'unknown',
          role: 'dimension',
          confidence: 0,
          nullCount: sampleRows.length
        };
        return;
      }

      const stats = {
        total: sampleRows.length,
        nonNull: values.length,
        nullCount: sampleRows.length - values.length,
        nullPercentage: ((sampleRows.length - values.length) / sampleRows.length) * 100
      };

      // Detect type
      const detectedType = this.detectValueType(values);

      columnStats[header] = {
        ...detectedType,
        ...stats
      };
    });

    return {
      columns: columnStats,
      confidence: this.calculateOverallConfidence(columnStats),
      headers
    };
  }

  /**
   * Detect type of values
   * @param {Array} values - Array of values
   * @returns {Object} - Type information
   */
  static detectValueType(values) {
    let numericCount = 0;
    let dateCount = 0;
    let booleanCount = 0;
    let stringCount = 0;
    let currencyCount = 0;
    let percentageCount = 0;

    values.forEach(value => {
      const strValue = String(value).trim();

      // Check for boolean
      if (/^(true|false|yes|no|0|1)$/i.test(strValue)) {
        booleanCount++;
        return;
      }

      // Check for currency
      if (/^[$€£¥]?\s?[\d,]+\.?\d*$/.test(strValue) || /^[\d,]+\.?\d*\s?[$€£¥]$/.test(strValue)) {
        currencyCount++;
        numericCount++;
        return;
      }

      // Check for percentage
      if (/^\d+\.?\d*%$/.test(strValue)) {
        percentageCount++;
        numericCount++;
        return;
      }

      // Check for date
      const dateRegex = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{2,4}$|^\d{1,2}-\d{1,2}-\d{2,4}$/;
      if (dateRegex.test(strValue)) {
        const parsed = new Date(strValue);
        if (!isNaN(parsed.getTime())) {
          dateCount++;
          return;
        }
      }

      // Check for numeric
      if (!isNaN(parseFloat(strValue)) && isFinite(strValue)) {
        numericCount++;
        return;
      }

      // Default to string
      stringCount++;
    });

    const total = values.length;
    const confidence = Math.max(numericCount, dateCount, booleanCount, stringCount) / total;

    // Determine primary type
    if (dateCount / total > 0.8) {
      return { type: 'date', role: 'date', confidence, aggregation: null };
    }
    if (currencyCount / total > 0.7) {
      return { type: 'currency', role: 'metric', confidence, aggregation: 'sum' };
    }
    if (percentageCount / total > 0.7) {
      return { type: 'percentage', role: 'metric', confidence, aggregation: 'avg' };
    }
    if (numericCount / total > 0.8) {
      return { type: 'numeric', role: 'metric', confidence, aggregation: 'sum' };
    }
    if (booleanCount / total > 0.8) {
      return { type: 'boolean', role: 'dimension', confidence, aggregation: null };
    }

    // Default to string (dimension)
    return { type: 'string', role: 'dimension', confidence, aggregation: null };
  }

  /**
   * Calculate overall confidence in type detection
   * @param {Object} columnStats - Column statistics
   * @returns {number} - Confidence score (0-1)
   */
  static calculateOverallConfidence(columnStats) {
    const confidences = Object.values(columnStats).map(stat => stat.confidence || 0);
    if (confidences.length === 0) return 0;
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  /**
   * Transform row data into records format for storage
   * @param {Array} rows - Parsed rows
   * @param {Object} schema - Detected schema with column types
   * @param {string} sourceId - Source UUID
   * @returns {Array} - Records ready for database insertion
   */
  static transformRowsToRecords(rows, schema, sourceId) {
    return rows.map(row => {
      const dimensions = {};
      const metrics = {};
      const metricKeys = [];
      let recordDate = null;

      // Separate dimensions and metrics based on schema
      Object.entries(row).forEach(([key, value]) => {
        const columnInfo = schema.columns[key];
        if (!columnInfo) return;

        if (columnInfo.role === 'date') {
          // Try to parse as date
          const parsed = this.parseDate(value);
          if (parsed) {
            recordDate = parsed;
          }
        } else if (columnInfo.role === 'metric') {
          // Parse as number and store in metrics
          const numValue = this.parseNumericValue(value);
          if (numValue !== null) {
            metrics[key] = numValue;
            metricKeys.push(key);
          }
        } else {
          // Store as dimension
          dimensions[key] = value;
        }
      });

      // Generate hash key for deduplication
      const hashKey = crypto.createHash('md5').update(JSON.stringify(dimensions)).digest('hex');

      return {
        sourceId,
        recordDate: recordDate || new Date().toISOString().split('T')[0], // Default to today if no date
        recordTimestamp: recordDate ? new Date(recordDate) : new Date(),
        dimensions,
        metrics,
        rawData: row,
        metricKeys,
        hashKey
      };
    });
  }

  /**
   * Parse date from various formats
   * @param {*} value - Value to parse
   * @returns {string|null} - Date string in YYYY-MM-DD format or null
   */
  static parseDate(value) {
    if (!value) return null;

    const strValue = String(value).trim();
    const parsed = new Date(strValue);

    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0]; // Return YYYY-MM-DD
    }

    return null;
  }

  /**
   * Parse numeric value from string (handles currency, percentages, etc.)
   * @param {*} value - Value to parse
   * @returns {number|null} - Numeric value or null
   */
  static parseNumericValue(value) {
    if (value === null || value === undefined || value === '') return null;

    let strValue = String(value).trim();

    // Remove currency symbols
    strValue = strValue.replace(/[$€£¥,\s]/g, '');

    // Handle percentages
    if (strValue.includes('%')) {
      const num = parseFloat(strValue.replace('%', ''));
      return isNaN(num) ? null : num / 100; // Convert to decimal
    }

    const num = parseFloat(strValue);
    return isNaN(num) ? null : num;
  }

  /**
   * Validate parsed data
   * @param {Object} parsedData - Parsed data object
   * @returns {Object} - Validation result
   */
  static validateData(parsedData) {
    const errors = [];
    const warnings = [];

    if (!parsedData.rows || parsedData.rows.length === 0) {
      errors.push('No data rows found in file');
    }

    if (parsedData.totalRows > 100000) {
      errors.push('File exceeds maximum row limit of 100,000 rows');
    }

    if (!parsedData.headers || parsedData.headers.length === 0) {
      errors.push('No column headers found');
    }

    if (parsedData.headers && parsedData.headers.length > 100) {
      warnings.push('File has more than 100 columns, which may affect performance');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = CustomDataParser;
