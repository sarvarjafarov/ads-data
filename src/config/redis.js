/**
 * Redis Configuration
 * Caching layer for improved performance
 */

const redis = require('redis');

let redisClient = null;
let isRedisAvailable = false;

/**
 * Initialize Redis client
 */
const initRedis = async () => {
  // Skip Redis initialization if REDIS_URL is not set (optional on Heroku)
  if (!process.env.REDIS_URL) {
    console.log('⚠️  REDIS_URL not set, running without cache');
    isRedisAvailable = false;
    return null;
  }

  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: false, // Don't retry connections - fail fast
      },
    });

    redisClient.on('error', (err) => {
      console.error('Redis client error:', err.message);
      isRedisAvailable = false;
    });

    redisClient.on('connect', () => {
      console.log('Redis client connected');
      isRedisAvailable = true;
    });

    redisClient.on('ready', () => {
      console.log('Redis client ready');
      isRedisAvailable = true;
    });

    redisClient.on('end', () => {
      console.log('Redis client disconnected');
      isRedisAvailable = false;
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('Failed to initialize Redis:', error.message);
    isRedisAvailable = false;
    // Clean up the client to prevent background retries
    if (redisClient) {
      try {
        await redisClient.quit();
      } catch (quitError) {
        // Ignore quit errors
      }
      redisClient = null;
    }
    return null;
  }
};

/**
 * Get value from cache
 */
const getCache = async (key) => {
  if (!isRedisAvailable || !redisClient) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    if (value) {
      // Update cache metadata
      try {
        const { query } = require('./database');
        await query(
          `INSERT INTO cache_metadata (cache_key, hit_count, last_accessed_at)
           VALUES ($1, 1, NOW())
           ON CONFLICT (cache_key)
           DO UPDATE SET
             hit_count = cache_metadata.hit_count + 1,
             last_accessed_at = NOW()`,
          [key]
        );
      } catch (metaError) {
        console.error('Cache metadata update error:', metaError);
      }

      return JSON.parse(value);
    }
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
};

/**
 * Set value in cache
 */
const setCache = async (key, value, ttl = 3600) => {
  if (!isRedisAvailable || !redisClient) {
    return false;
  }

  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));

    // Store cache metadata
    try {
      const { query } = require('./database');
      const expiresAt = new Date(Date.now() + ttl * 1000);
      await query(
        `INSERT INTO cache_metadata (cache_key, expires_at)
         VALUES ($1, $2)
         ON CONFLICT (cache_key)
         DO UPDATE SET
           expires_at = EXCLUDED.expires_at,
           last_accessed_at = NOW()`,
        [key, expiresAt]
      );
    } catch (metaError) {
      console.error('Cache metadata insert error:', metaError);
    }

    return true;
  } catch (error) {
    console.error('Redis set error:', error);
    return false;
  }
};

/**
 * Delete value from cache
 */
const deleteCache = async (key) => {
  if (!isRedisAvailable || !redisClient) {
    return false;
  }

  try {
    await redisClient.del(key);

    // Delete cache metadata
    try {
      const { query } = require('./database');
      await query('DELETE FROM cache_metadata WHERE cache_key = $1', [key]);
    } catch (metaError) {
      console.error('Cache metadata delete error:', metaError);
    }

    return true;
  } catch (error) {
    console.error('Redis delete error:', error);
    return false;
  }
};

/**
 * Clear cache by pattern
 */
const clearCachePattern = async (pattern) => {
  if (!isRedisAvailable || !redisClient) {
    return false;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);

      // Delete cache metadata
      try {
        const { query } = require('./database');
        await query(
          'DELETE FROM cache_metadata WHERE cache_key LIKE $1',
          [pattern.replace('*', '%')]
        );
      } catch (metaError) {
        console.error('Cache metadata delete error:', metaError);
      }
    }
    return true;
  } catch (error) {
    console.error('Redis clear pattern error:', error);
    return false;
  }
};

/**
 * Get cache stats
 */
const getCacheStats = async () => {
  if (!isRedisAvailable || !redisClient) {
    return {
      available: false,
      message: 'Redis not available',
    };
  }

  try {
    const info = await redisClient.info('stats');
    const dbSize = await redisClient.dbSize();

    return {
      available: true,
      dbSize,
      info,
    };
  } catch (error) {
    console.error('Redis stats error:', error);
    return {
      available: false,
      error: error.message,
    };
  }
};

/**
 * Check if Redis is available
 */
const isAvailable = () => isRedisAvailable;

module.exports = {
  initRedis,
  getCache,
  setCache,
  deleteCache,
  clearCachePattern,
  getCacheStats,
  isAvailable,
};
