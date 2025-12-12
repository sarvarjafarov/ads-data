/**
 * Email Service
 * Handles sending emails for scheduled reports and notifications
 */

const nodemailer = require('nodemailer');
const config = require('../config/config');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialize();
  }

  /**
   * Initialize email transporter
   */
  initialize() {
    // In development, use Ethereal (test) email service
    // In production, use configured SMTP settings
    if (config.nodeEnv === 'production' && config.email) {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.password,
        },
      });
    } else {
      // For development: log emails to console instead of sending
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
      console.log('Email service initialized in development mode (emails will be logged, not sent)');
    }
  }

  /**
   * Send a scheduled report email
   * @param {Object} options - Email options
   * @param {string[]} options.to - Recipient email addresses
   * @param {string} options.subject - Email subject
   * @param {string} options.reportName - Name of the report
   * @param {Object} options.reportData - Report data
   * @param {boolean} options.includeCharts - Include charts in email
   */
  async sendScheduledReport({ to, subject, reportName, reportData, includeCharts = true }) {
    try {
      const html = this.generateReportHTML(reportName, reportData, includeCharts);

      const mailOptions = {
        from: config.email?.from || 'AdsData Platform <noreply@adsdata.com>',
        to: to.join(', '),
        subject: subject || `${reportName} - AdsData Report`,
        html,
        text: this.generateReportText(reportName, reportData),
      };

      const info = await this.transporter.sendMail(mailOptions);

      if (config.nodeEnv !== 'production') {
        console.log('Email preview:', info.message.toString());
      }

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('Error sending scheduled report email:', error);
      throw error;
    }
  }

  /**
   * Generate HTML for the report email
   */
  generateReportHTML(reportName, reportData, includeCharts) {
    const { summary, platforms, topPerformers, dateRange } = reportData;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${reportName}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            border-bottom: 3px solid #b7fa31;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          h1 {
            margin: 0;
            color: #1a1a1a;
            font-size: 28px;
          }
          .date-range {
            color: #666;
            font-size: 14px;
            margin-top: 8px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }
          .metric-card {
            background-color: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
            border-left: 4px solid #b7fa31;
          }
          .metric-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
          }
          .metric-value {
            font-size: 28px;
            font-weight: bold;
            color: #1a1a1a;
          }
          .metric-change {
            font-size: 14px;
            margin-top: 8px;
          }
          .metric-change.positive {
            color: #10b981;
          }
          .metric-change.negative {
            color: #ef4444;
          }
          .section {
            margin-bottom: 30px;
          }
          .section-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 15px;
            color: #1a1a1a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background-color: #f8f9fa;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
            color: #666;
            border-bottom: 2px solid #e5e7eb;
          }
          td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 14px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #666;
            text-align: center;
          }
          .footer a {
            color: #b7fa31;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${reportName}</h1>
            <div class="date-range">${dateRange}</div>
          </div>

          ${this.generateSummarySection(summary)}

          ${this.generatePlatformsSection(platforms)}

          ${topPerformers ? this.generateTopPerformersSection(topPerformers) : ''}

          <div class="footer">
            <p>
              This is an automated report from AdsData Platform.<br>
              <a href="http://localhost:3000/dashboard">View Full Dashboard</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate summary section HTML
   */
  generateSummarySection(summary) {
    if (!summary) return '';

    return `
      <div class="summary-grid">
        ${this.generateMetricCard('Total Spend', `$${this.formatNumber(summary.totalSpend)}`, summary.spendChange)}
        ${this.generateMetricCard('Impressions', this.formatNumber(summary.totalImpressions), summary.impressionsChange)}
        ${this.generateMetricCard('Clicks', this.formatNumber(summary.totalClicks), summary.clicksChange)}
        ${this.generateMetricCard('CTR', `${summary.averageCTR?.toFixed(2)}%`, summary.ctrChange)}
      </div>
    `;
  }

  /**
   * Generate metric card HTML
   */
  generateMetricCard(label, value, change) {
    const changeClass = change > 0 ? 'positive' : change < 0 ? 'negative' : '';
    const changeSymbol = change > 0 ? '↑' : change < 0 ? '↓' : '';

    return `
      <div class="metric-card">
        <div class="metric-label">${label}</div>
        <div class="metric-value">${value}</div>
        ${change !== undefined ? `
          <div class="metric-change ${changeClass}">
            ${changeSymbol} ${Math.abs(change).toFixed(1)}% vs previous period
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Generate platforms section HTML
   */
  generatePlatformsSection(platforms) {
    if (!platforms || platforms.length === 0) return '';

    return `
      <div class="section">
        <h2 class="section-title">Performance by Platform</h2>
        <table>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Spend</th>
              <th>Impressions</th>
              <th>Clicks</th>
              <th>CTR</th>
              <th>CPC</th>
            </tr>
          </thead>
          <tbody>
            ${platforms.map(p => `
              <tr>
                <td><strong>${this.formatPlatformName(p.platform)}</strong></td>
                <td>$${this.formatNumber(p.spend)}</td>
                <td>${this.formatNumber(p.impressions)}</td>
                <td>${this.formatNumber(p.clicks)}</td>
                <td>${p.ctr?.toFixed(2)}%</td>
                <td>$${p.cpc?.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Generate top performers section HTML
   */
  generateTopPerformersSection(topPerformers) {
    if (!topPerformers || topPerformers.length === 0) return '';

    return `
      <div class="section">
        <h2 class="section-title">Top Performing Campaigns</h2>
        <table>
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Platform</th>
              <th>Spend</th>
              <th>Conversions</th>
              <th>ROAS</th>
            </tr>
          </thead>
          <tbody>
            ${topPerformers.map(c => `
              <tr>
                <td><strong>${c.name}</strong></td>
                <td>${this.formatPlatformName(c.platform)}</td>
                <td>$${this.formatNumber(c.spend)}</td>
                <td>${this.formatNumber(c.conversions)}</td>
                <td>${c.roas?.toFixed(2)}x</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Generate plain text version of the report
   */
  generateReportText(reportName, reportData) {
    const { summary, platforms, dateRange } = reportData;

    let text = `${reportName}\n${dateRange}\n\n`;
    text += '='.repeat(50) + '\n\n';

    if (summary) {
      text += 'SUMMARY\n\n';
      text += `Total Spend: $${this.formatNumber(summary.totalSpend)}\n`;
      text += `Impressions: ${this.formatNumber(summary.totalImpressions)}\n`;
      text += `Clicks: ${this.formatNumber(summary.totalClicks)}\n`;
      text += `CTR: ${summary.averageCTR?.toFixed(2)}%\n\n`;
    }

    if (platforms && platforms.length > 0) {
      text += 'PERFORMANCE BY PLATFORM\n\n';
      platforms.forEach(p => {
        text += `${this.formatPlatformName(p.platform)}:\n`;
        text += `  Spend: $${this.formatNumber(p.spend)}\n`;
        text += `  Impressions: ${this.formatNumber(p.impressions)}\n`;
        text += `  Clicks: ${this.formatNumber(p.clicks)}\n`;
        text += `  CTR: ${p.ctr?.toFixed(2)}%\n\n`;
      });
    }

    text += '\n' + '-'.repeat(50) + '\n';
    text += 'View full dashboard: http://localhost:3000/dashboard\n';

    return text;
  }

  /**
   * Format platform name for display
   */
  formatPlatformName(platform) {
    const names = {
      facebook: 'Facebook',
      google: 'Google Ads',
      meta: 'Meta Ads',
      search_console: 'Google Search Console',
      linkedin: 'LinkedIn',
      twitter: 'Twitter/X',
    };
    return names[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
  }

  /**
   * Format number with commas
   */
  formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Send email verification email
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.username - Username
   * @param {string} options.verificationToken - Verification token
   */
  async sendVerificationEmail({ to, username, verificationToken }) {
    try {
      const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - AdsData</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: #ffffff;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .logo {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo-box {
              display: inline-block;
              background-color: #b7fa31;
              color: #000000;
              padding: 12px 20px;
              border-radius: 8px;
              font-weight: bold;
              font-size: 24px;
            }
            h1 {
              color: #1a1a1a;
              font-size: 24px;
              margin-bottom: 20px;
              text-align: center;
            }
            p {
              color: #666;
              margin-bottom: 20px;
            }
            .button {
              display: inline-block;
              background-color: #b7fa31;
              color: #000000;
              text-decoration: none;
              padding: 14px 32px;
              border-radius: 6px;
              font-weight: 600;
              text-align: center;
              margin: 20px 0;
            }
            .button-container {
              text-align: center;
            }
            .alt-link {
              color: #666;
              font-size: 12px;
              word-break: break-all;
              background-color: #f8f9fa;
              padding: 12px;
              border-radius: 4px;
              margin-top: 20px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 12px;
              color: #999;
              text-align: center;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 12px;
              margin: 20px 0;
              border-radius: 4px;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-box">AdsData</div>
            </div>

            <h1>Verify Your Email Address</h1>

            <p>Hi ${username},</p>

            <p>Thank you for registering with AdsData! To complete your registration and start using the platform, please verify your email address by clicking the button below:</p>

            <div class="button-container">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>

            <p>This verification link will expire in 24 hours.</p>

            <div class="warning">
              <strong>Important:</strong> If you didn't create an account with AdsData, please ignore this email.
            </div>

            <p style="font-size: 14px; color: #999;">If the button doesn't work, you can copy and paste this link into your browser:</p>
            <div class="alt-link">${verificationUrl}</div>

            <div class="footer">
              <p>
                This is an automated email from AdsData Platform.<br>
                © ${new Date().getFullYear()} AdsData. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const text = `
Hi ${username},

Thank you for registering with AdsData!

To complete your registration and start using the platform, please verify your email address by clicking the link below:

${verificationUrl}

This verification link will expire in 24 hours.

If you didn't create an account with AdsData, please ignore this email.

---
This is an automated email from AdsData Platform.
© ${new Date().getFullYear()} AdsData. All rights reserved.
      `;

      const mailOptions = {
        from: config.email?.from || 'AdsData Platform <noreply@adsdata.com>',
        to,
        subject: 'Verify Your Email - AdsData',
        html,
        text,
      };

      const info = await this.transporter.sendMail(mailOptions);

      if (config.nodeEnv !== 'production') {
        console.log('Verification email preview:', info.message?.toString());
        console.log('Verification URL:', verificationUrl);
      }

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  }

  /**
   * Test email configuration
   */
  async testConnection() {
    try {
      if (this.transporter.verify) {
        await this.transporter.verify();
        return { success: true, message: 'Email configuration is valid' };
      }
      return { success: true, message: 'Email service in development mode' };
    } catch (error) {
      console.error('Email connection test failed:', error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = new EmailService();
