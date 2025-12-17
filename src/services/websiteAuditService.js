const puppeteer = require('puppeteer');

/**
 * Website Audit Service
 *
 * Uses Puppeteer to analyze website tracking pixel installations across major advertising platforms.
 * Detects pixels, events, parameters, CAPI setup, and event matching quality.
 *
 * Supported Platforms:
 * - Meta/Facebook Pixel + Conversions API
 * - Google Analytics GA4
 * - Google Ads Conversion Tracking
 * - TikTok Pixel
 * - LinkedIn Insight Tag
 * - Twitter/X Pixel
 * - Pinterest Tag
 */
class WebsiteAuditService {
  constructor() {
    this.timeout = 25000; // 25 second hard limit (give buffer before Heroku timeout)
    this.pageLoadTimeout = 15000; // 15 second page load
    this.waitAfterLoad = 2000; // Wait 2s for dynamic events (reduced from 5s)
  }

  /**
   * Main audit function
   * @param {string} url - Website URL to audit
   * @param {Object} options - Audit options
   * @returns {Object} Technical findings
   */
  async auditWebsite(url, options = {}) {
    const startTime = Date.now();
    let browser = null;

    try {
      // Validate URL
      const validatedUrl = this.validateUrl(url);

      // Initialize data collectors
      const networkRequests = [];
      const consoleLogs = [];
      let domContent = '';

      // Launch browser
      const launchOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--metrics-recording-only',
          '--no-first-run',
          '--disable-features=TranslateUI',
          '--disable-component-extensions-with-background-pages'
        ],
        timeout: this.timeout
      };

      // On Heroku, use the Chrome binary provided by buildpack
      if (process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN;
      }

      browser = await puppeteer.launch(launchOptions);

      const page = await browser.newPage();

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Enable request interception
      await page.setRequestInterception(true);

      // Intercept network requests
      page.on('request', (request) => {
        const resourceType = request.resourceType();

        // Block images and fonts to speed up loading
        if (['image', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });

      page.on('response', async (response) => {
        const url = response.url();
        const request = response.request();

        networkRequests.push({
          url,
          method: request.method(),
          headers: request.headers(),
          postData: request.postData(),
          status: response.status(),
          type: request.resourceType()
        });
      });

      // Capture console logs
      page.on('console', (msg) => {
        consoleLogs.push({
          type: msg.type(),
          text: msg.text()
        });
      });

      // Navigate to page (use domcontentloaded instead of networkidle2 for speed)
      await page.goto(validatedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.pageLoadTimeout
      });

      // Wait for dynamic events
      await page.waitForTimeout(this.waitAfterLoad);

      // Extract DOM content
      domContent = await page.content();

      // Extract inline scripts
      const inlineScripts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('script'))
          .map(script => script.innerHTML)
          .filter(content => content.length > 0);
      });

      // Extract data layer
      const dataLayer = await page.evaluate(() => {
        if (window.dataLayer) {
          return JSON.stringify(window.dataLayer);
        }
        return null;
      });

      // Close browser
      await browser.close();
      browser = null;

      const auditDuration = Date.now() - startTime;

      // Analyze collected data
      const findings = {
        websiteUrl: validatedUrl,
        auditDuration,
        platforms: {
          meta: await this.analyzeMetaPixel(networkRequests, domContent, inlineScripts, dataLayer),
          ga4: await this.analyzeGA4(networkRequests, domContent, inlineScripts, dataLayer),
          googleAds: await this.analyzeGoogleAds(networkRequests, domContent, inlineScripts),
          tiktok: await this.analyzeTikTokPixel(networkRequests, domContent, inlineScripts),
          linkedin: await this.analyzeLinkedInTag(networkRequests, domContent, inlineScripts),
          twitter: await this.analyzeTwitterPixel(networkRequests, domContent, inlineScripts),
          pinterest: await this.analyzePinterestTag(networkRequests, domContent, inlineScripts)
        },
        metadata: {
          totalRequests: networkRequests.length,
          consoleLogs: consoleLogs.length,
          hasDataLayer: !!dataLayer
        }
      };

      return findings;

    } catch (error) {
      console.error('Website audit error:', error);

      // Ensure browser is closed on error
      if (browser) {
        await browser.close().catch(e => console.error('Error closing browser:', e));
      }

      // Return error with partial data if available
      throw new Error(`Audit failed: ${error.message}`);
    }
  }

  /**
   * Validate URL for security
   * @param {string} url - URL to validate
   * @returns {string} Validated URL
   */
  validateUrl(url) {
    try {
      const parsed = new URL(url);

      // Only allow http and https
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol. Only HTTP and HTTPS are allowed.');
      }

      // Block localhost and private IPs
      const hostname = parsed.hostname.toLowerCase();
      const blockedPatterns = [
        'localhost',
        '127.0.0.1',
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[01])\./,
        /^192\.168\./,
        /^0\.0\.0\.0/,
        /\[?::1\]?/
      ];

      for (const pattern of blockedPatterns) {
        if (pattern instanceof RegExp) {
          if (pattern.test(hostname)) {
            throw new Error('Cannot audit localhost or private IP addresses.');
          }
        } else if (hostname === pattern) {
          throw new Error('Cannot audit localhost or private IP addresses.');
        }
      }

      return parsed.href;

    } catch (error) {
      throw new Error(`Invalid URL: ${error.message}`);
    }
  }

  /**
   * Analyze Meta/Facebook Pixel implementation
   * @param {Array} requests - Network requests
   * @param {string} domContent - DOM HTML content
   * @param {Array} inlineScripts - Inline script contents
   * @param {string} dataLayer - Data layer JSON
   * @returns {Object} Meta pixel analysis
   */
  async analyzeMetaPixel(requests, domContent, inlineScripts, dataLayer) {
    const analysis = {
      detected: false,
      pixelId: null,
      standardEvents: [],
      customEvents: [],
      eventParameters: {},
      capiDetected: false,
      eventMatchingQuality: 'none', // none, basic, advanced
      issues: [],
      recommendations: []
    };

    // Check for pixel initialization in DOM/scripts
    const fbqPattern = /fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/g;
    const allContent = domContent + inlineScripts.join('\n');

    let match;
    while ((match = fbqPattern.exec(allContent)) !== null) {
      analysis.detected = true;
      analysis.pixelId = match[1];
      break;
    }

    // Check network requests for pixel fires
    const fbPixelRequests = requests.filter(req =>
      req.url.includes('facebook.com/tr') ||
      req.url.includes('connect.facebook.net')
    );

    if (fbPixelRequests.length > 0 && !analysis.detected) {
      analysis.detected = true;
    }

    // Extract events from fbq calls
    const eventPattern = /fbq\s*\(\s*['"]track['"]\s*,\s*['"]([^'"]+)['"]\s*(?:,\s*({[^}]+}))?\s*\)/g;

    while ((match = eventPattern.exec(allContent)) !== null) {
      const eventName = match[1];
      const eventParams = match[2];

      if (['PageView', 'ViewContent', 'Search', 'AddToCart', 'AddToWishlist',
           'InitiateCheckout', 'AddPaymentInfo', 'Purchase', 'Lead', 'CompleteRegistration'].includes(eventName)) {
        analysis.standardEvents.push(eventName);
      } else {
        analysis.customEvents.push(eventName);
      }

      if (eventParams) {
        analysis.eventParameters[eventName] = eventParams;
      }
    }

    // Check for CAPI indicators
    const capiIndicators = [
      /_fbp=/, // First-party cookie
      /fbclid=/, // Click ID
      /event_source_url/,
      /server_event/
    ];

    const hasCapiIndicators = fbPixelRequests.some(req =>
      capiIndicators.some(pattern => pattern.test(req.url + (req.postData || '')))
    );

    if (hasCapiIndicators) {
      analysis.capiDetected = true;
    }

    // Check event matching quality (hashed PII)
    const hashedPIIPattern = /\b(em|ph|fn|ln|ct|st|zp|country|ge|db)\b.*[:=]/;
    const hasEventMatching = fbPixelRequests.some(req =>
      hashedPIIPattern.test(req.postData || '')
    );

    if (hasEventMatching) {
      analysis.eventMatchingQuality = 'advanced';
    } else if (analysis.capiDetected) {
      analysis.eventMatchingQuality = 'basic';
    }

    // Identify issues
    if (!analysis.detected) {
      analysis.issues.push('Meta Pixel not detected');
    } else {
      if (!analysis.standardEvents.includes('PageView')) {
        analysis.issues.push('PageView event missing');
      }
      if (!analysis.standardEvents.includes('Purchase') && !analysis.customEvents.includes('Purchase')) {
        analysis.issues.push('Purchase event missing - cannot track conversions');
      }
      if (!analysis.standardEvents.includes('AddToCart')) {
        analysis.issues.push('AddToCart event missing - limited optimization');
      }
      if (!analysis.capiDetected) {
        analysis.issues.push('Conversions API (CAPI) not detected - losing iOS 14.5+ attribution');
      }
      if (analysis.eventMatchingQuality === 'none' || analysis.eventMatchingQuality === 'basic') {
        analysis.issues.push('Event matching quality poor - limited conversion attribution');
      }
    }

    return analysis;
  }

  /**
   * Analyze Google Analytics GA4 implementation
   * @param {Array} requests - Network requests
   * @param {string} domContent - DOM HTML content
   * @param {Array} inlineScripts - Inline script contents
   * @param {string} dataLayer - Data layer JSON
   * @returns {Object} GA4 analysis
   */
  async analyzeGA4(requests, domContent, inlineScripts, dataLayer) {
    const analysis = {
      detected: false,
      measurementId: null,
      events: [],
      parameters: {},
      enhancedMeasurement: false,
      ecommerce: false,
      issues: [],
      recommendations: []
    };

    // Check for GA4 measurement ID in DOM/scripts
    const ga4Pattern = /gtag\s*\(\s*['"]config['"]\s*,\s*['"]G-([A-Z0-9]+)['"]/g;
    const allContent = domContent + inlineScripts.join('\n');

    let match;
    while ((match = ga4Pattern.exec(allContent)) !== null) {
      analysis.detected = true;
      analysis.measurementId = 'G-' + match[1];
      break;
    }

    // Check network requests for GA4
    const ga4Requests = requests.filter(req =>
      req.url.includes('google-analytics.com/g/collect') ||
      req.url.includes('googletagmanager.com/gtag')
    );

    if (ga4Requests.length > 0 && !analysis.detected) {
      analysis.detected = true;
    }

    // Extract events
    const eventPattern = /gtag\s*\(\s*['"]event['"]\s*,\s*['"]([^'"]+)['"]/g;

    while ((match = eventPattern.exec(allContent)) !== null) {
      const eventName = match[1];
      if (!analysis.events.includes(eventName)) {
        analysis.events.push(eventName);
      }
    }

    // Check for ecommerce events
    const ecommerceEvents = ['purchase', 'add_to_cart', 'begin_checkout', 'view_item'];
    analysis.ecommerce = ecommerceEvents.some(event =>
      analysis.events.includes(event) || allContent.toLowerCase().includes(event)
    );

    // Identify issues
    if (!analysis.detected) {
      analysis.issues.push('GA4 not detected');
    } else {
      if (!analysis.events.includes('purchase')) {
        analysis.issues.push('Purchase event not tracked');
      }
      if (!analysis.ecommerce) {
        analysis.issues.push('E-commerce tracking not configured');
      }
    }

    return analysis;
  }

  /**
   * Analyze Google Ads Conversion Tracking
   * @param {Array} requests - Network requests
   * @param {string} domContent - DOM HTML content
   * @param {Array} inlineScripts - Inline script contents
   * @returns {Object} Google Ads analysis
   */
  async analyzeGoogleAds(requests, domContent, inlineScripts) {
    const analysis = {
      detected: false,
      conversionIds: [],
      conversionLabels: [],
      remarketingDetected: false,
      issues: [],
      recommendations: []
    };

    const allContent = domContent + inlineScripts.join('\n');

    // Check for Google Ads conversion tracking
    const conversionPattern = /AW-(\d+)/g;
    const labelPattern = /send_to['"]\s*:\s*['"]AW-\d+\/([^'"]+)['"]/g;

    let match;
    while ((match = conversionPattern.exec(allContent)) !== null) {
      analysis.detected = true;
      if (!analysis.conversionIds.includes(match[1])) {
        analysis.conversionIds.push(match[1]);
      }
    }

    while ((match = labelPattern.exec(allContent)) !== null) {
      if (!analysis.conversionLabels.includes(match[1])) {
        analysis.conversionLabels.push(match[1]);
      }
    }

    // Check network requests
    const googleAdsRequests = requests.filter(req =>
      req.url.includes('googleadservices.com/pagead/conversion') ||
      req.url.includes('google.com/ads/ga-audiences')
    );

    if (googleAdsRequests.length > 0) {
      analysis.remarketingDetected = true;
    }

    // Identify issues
    if (!analysis.detected) {
      analysis.issues.push('Google Ads conversion tracking not detected');
    } else {
      if (analysis.conversionLabels.length === 0) {
        analysis.issues.push('No conversion labels found');
      }
    }

    return analysis;
  }

  /**
   * Analyze TikTok Pixel implementation
   * @param {Array} requests - Network requests
   * @param {string} domContent - DOM HTML content
   * @param {Array} inlineScripts - Inline script contents
   * @returns {Object} TikTok pixel analysis
   */
  async analyzeTikTokPixel(requests, domContent, inlineScripts) {
    const analysis = {
      detected: false,
      pixelId: null,
      events: [],
      issues: [],
      recommendations: []
    };

    const allContent = domContent + inlineScripts.join('\n');

    // Check for TikTok pixel
    const tiktokPattern = /ttq\.load\s*\(\s*['"]([A-Z0-9]+)['"]/g;

    let match;
    while ((match = tiktokPattern.exec(allContent)) !== null) {
      analysis.detected = true;
      analysis.pixelId = match[1];
      break;
    }

    // Check network requests
    const tiktokRequests = requests.filter(req =>
      req.url.includes('analytics.tiktok.com') ||
      req.url.includes('tiktok.com/i18n/pixel')
    );

    if (tiktokRequests.length > 0 && !analysis.detected) {
      analysis.detected = true;
    }

    // Extract events
    const eventPattern = /ttq\.track\s*\(\s*['"]([^'"]+)['"]/g;

    while ((match = eventPattern.exec(allContent)) !== null) {
      if (!analysis.events.includes(match[1])) {
        analysis.events.push(match[1]);
      }
    }

    // Identify issues
    if (!analysis.detected) {
      analysis.issues.push('TikTok Pixel not detected');
    } else {
      if (!analysis.events.includes('CompletePayment')) {
        analysis.issues.push('Purchase event (CompletePayment) missing');
      }
    }

    return analysis;
  }

  /**
   * Analyze LinkedIn Insight Tag implementation
   * @param {Array} requests - Network requests
   * @param {string} domContent - DOM HTML content
   * @param {Array} inlineScripts - Inline script contents
   * @returns {Object} LinkedIn tag analysis
   */
  async analyzeLinkedInTag(requests, domContent, inlineScripts) {
    const analysis = {
      detected: false,
      partnerId: null,
      conversionIds: [],
      issues: [],
      recommendations: []
    };

    const allContent = domContent + inlineScripts.join('\n');

    // Check for LinkedIn Insight Tag
    const linkedinPattern = /_linkedin_partner_id\s*=\s*['"](\d+)['"]/g;

    let match;
    while ((match = linkedinPattern.exec(allContent)) !== null) {
      analysis.detected = true;
      analysis.partnerId = match[1];
      break;
    }

    // Check network requests
    const linkedinRequests = requests.filter(req =>
      req.url.includes('px.ads.linkedin.com') ||
      req.url.includes('snap.licdn.com')
    );

    if (linkedinRequests.length > 0 && !analysis.detected) {
      analysis.detected = true;
    }

    // Extract conversion IDs
    const conversionPattern = /conversion_id['"]\s*:\s*(\d+)/g;

    while ((match = conversionPattern.exec(allContent)) !== null) {
      if (!analysis.conversionIds.includes(match[1])) {
        analysis.conversionIds.push(match[1]);
      }
    }

    // Identify issues
    if (!analysis.detected) {
      analysis.issues.push('LinkedIn Insight Tag not detected');
    } else {
      if (analysis.conversionIds.length === 0) {
        analysis.issues.push('No conversion tracking configured');
      }
    }

    return analysis;
  }

  /**
   * Analyze Twitter/X Pixel implementation
   * @param {Array} requests - Network requests
   * @param {string} domContent - DOM HTML content
   * @param {Array} inlineScripts - Inline script contents
   * @returns {Object} Twitter pixel analysis
   */
  async analyzeTwitterPixel(requests, domContent, inlineScripts) {
    const analysis = {
      detected: false,
      pixelId: null,
      events: [],
      issues: [],
      recommendations: []
    };

    const allContent = domContent + inlineScripts.join('\n');

    // Check for Twitter pixel
    const twitterPattern = /twq\s*\(\s*['"]init['"]\s*,\s*['"]([a-z0-9]+)['"]/g;

    let match;
    while ((match = twitterPattern.exec(allContent)) !== null) {
      analysis.detected = true;
      analysis.pixelId = match[1];
      break;
    }

    // Check network requests
    const twitterRequests = requests.filter(req =>
      req.url.includes('static.ads-twitter.com') ||
      req.url.includes('analytics.twitter.com')
    );

    if (twitterRequests.length > 0 && !analysis.detected) {
      analysis.detected = true;
    }

    // Extract events
    const eventPattern = /twq\s*\(\s*['"]track['"]\s*,\s*['"]([^'"]+)['"]/g;

    while ((match = eventPattern.exec(allContent)) !== null) {
      if (!analysis.events.includes(match[1])) {
        analysis.events.push(match[1]);
      }
    }

    // Identify issues
    if (!analysis.detected) {
      analysis.issues.push('Twitter/X Pixel not detected');
    } else {
      if (!analysis.events.includes('Purchase')) {
        analysis.issues.push('Purchase event missing');
      }
    }

    return analysis;
  }

  /**
   * Analyze Pinterest Tag implementation
   * @param {Array} requests - Network requests
   * @param {string} domContent - DOM HTML content
   * @param {Array} inlineScripts - Inline script contents
   * @returns {Object} Pinterest tag analysis
   */
  async analyzePinterestTag(requests, domContent, inlineScripts) {
    const analysis = {
      detected: false,
      tagId: null,
      events: [],
      issues: [],
      recommendations: []
    };

    const allContent = domContent + inlineScripts.join('\n');

    // Check for Pinterest tag
    const pinterestPattern = /pintrk\s*\(\s*['"]load['"]\s*,\s*['"](\d+)['"]/g;

    let match;
    while ((match = pinterestPattern.exec(allContent)) !== null) {
      analysis.detected = true;
      analysis.tagId = match[1];
      break;
    }

    // Check network requests
    const pinterestRequests = requests.filter(req =>
      req.url.includes('ct.pinterest.com') ||
      req.url.includes('s.pinimg.com/ct')
    );

    if (pinterestRequests.length > 0 && !analysis.detected) {
      analysis.detected = true;
    }

    // Extract events
    const eventPattern = /pintrk\s*\(\s*['"]track['"]\s*,\s*['"]([^'"]+)['"]/g;

    while ((match = eventPattern.exec(allContent)) !== null) {
      if (!analysis.events.includes(match[1])) {
        analysis.events.push(match[1]);
      }
    }

    // Identify issues
    if (!analysis.detected) {
      analysis.issues.push('Pinterest Tag not detected');
    } else {
      if (!analysis.events.includes('checkout')) {
        analysis.issues.push('Checkout event missing');
      }
    }

    return analysis;
  }
}

// Export singleton instance
module.exports = new WebsiteAuditService();
