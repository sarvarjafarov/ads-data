/**
 * Dashboard Templates Service
 * Pre-built templates for common use cases
 */

const templates = [
  {
    id: 'ecommerce',
    name: 'E-Commerce Overview',
    description: 'Track revenue, ROAS, and conversion metrics for e-commerce businesses',
    category: 'E-Commerce',
    icon: '🛒',
    widgets: [
      { widgetType: 'kpi_card', title: 'Total Spend', metric: 'spend', position: { x: 0, y: 0, w: 4, h: 4 } },
      { widgetType: 'kpi_card', title: 'Revenue', metric: 'conversions', position: { x: 4, y: 0, w: 4, h: 4 } },
      { widgetType: 'kpi_card', title: 'ROAS', metric: 'conversions', position: { x: 8, y: 0, w: 4, h: 4 } },
      { widgetType: 'line_chart', title: 'Spend Over Time', metric: 'spend', position: { x: 0, y: 4, w: 6, h: 6 } },
      { widgetType: 'line_chart', title: 'Conversions Trend', metric: 'conversions', position: { x: 6, y: 4, w: 6, h: 6 } },
      { widgetType: 'bar_chart', title: 'Cost Per Conversion', metric: 'cost_per_conversion', position: { x: 0, y: 10, w: 6, h: 6 } },
      { widgetType: 'kpi_card', title: 'CTR', metric: 'ctr', position: { x: 6, y: 10, w: 3, h: 4 } },
      { widgetType: 'kpi_card', title: 'CPC', metric: 'cpc', position: { x: 9, y: 10, w: 3, h: 4 } },
    ],
  },
  {
    id: 'lead-generation',
    name: 'Lead Generation',
    description: 'Track lead acquisition costs and conversion rates',
    category: 'Lead Gen',
    icon: '📞',
    widgets: [
      { widgetType: 'kpi_card', title: 'Total Leads', metric: 'conversions', position: { x: 0, y: 0, w: 4, h: 4 } },
      { widgetType: 'kpi_card', title: 'Cost Per Lead', metric: 'cost_per_conversion', position: { x: 4, y: 0, w: 4, h: 4 } },
      { widgetType: 'kpi_card', title: 'Total Spend', metric: 'spend', position: { x: 8, y: 0, w: 4, h: 4 } },
      { widgetType: 'line_chart', title: 'Leads Over Time', metric: 'conversions', position: { x: 0, y: 4, w: 12, h: 6 } },
      { widgetType: 'comparison', title: 'CPL Comparison', metric: 'cost_per_conversion', position: { x: 0, y: 10, w: 6, h: 6 } },
      { widgetType: 'bar_chart', title: 'Daily Spend', metric: 'spend', position: { x: 6, y: 10, w: 6, h: 6 } },
    ],
  },
  {
    id: 'brand-awareness',
    name: 'Brand Awareness',
    description: 'Track reach, impressions, and engagement metrics',
    category: 'Branding',
    icon: '📢',
    widgets: [
      { widgetType: 'kpi_card', title: 'Total Reach', metric: 'reach', position: { x: 0, y: 0, w: 4, h: 4 } },
      { widgetType: 'kpi_card', title: 'Impressions', metric: 'impressions', position: { x: 4, y: 0, w: 4, h: 4 } },
      { widgetType: 'kpi_card', title: 'Frequency', metric: 'frequency', position: { x: 8, y: 0, w: 4, h: 4 } },
      { widgetType: 'line_chart', title: 'Reach Trend', metric: 'reach', position: { x: 0, y: 4, w: 6, h: 6 } },
      { widgetType: 'line_chart', title: 'Impressions Trend', metric: 'impressions', position: { x: 6, y: 4, w: 6, h: 6 } },
      { widgetType: 'kpi_card', title: 'CPM', metric: 'cpm', position: { x: 0, y: 10, w: 4, h: 4 } },
      { widgetType: 'kpi_card', title: 'Total Spend', metric: 'spend', position: { x: 4, y: 10, w: 4, h: 4 } },
    ],
  },
  {
    id: 'traffic',
    name: 'Website Traffic',
    description: 'Track clicks, CTR, and cost per click metrics',
    category: 'Traffic',
    icon: '🌐',
    widgets: [
      { widgetType: 'kpi_card', title: 'Total Clicks', metric: 'clicks', position: { x: 0, y: 0, w: 4, h: 4 } },
      { widgetType: 'kpi_card', title: 'CTR', metric: 'ctr', position: { x: 4, y: 0, w: 4, h: 4 } },
      { widgetType: 'kpi_card', title: 'CPC', metric: 'cpc', position: { x: 8, y: 0, w: 4, h: 4 } },
      { widgetType: 'line_chart', title: 'Clicks Over Time', metric: 'clicks', position: { x: 0, y: 4, w: 12, h: 6 } },
      { widgetType: 'bar_chart', title: 'Impressions', metric: 'impressions', position: { x: 0, y: 10, w: 6, h: 6 } },
      { widgetType: 'kpi_card', title: 'Total Spend', metric: 'spend', position: { x: 6, y: 10, w: 6, h: 4 } },
    ],
  },
  {
    id: 'performance',
    name: 'Performance Overview',
    description: 'Comprehensive view of all key performance metrics',
    category: 'General',
    icon: '📊',
    widgets: [
      { widgetType: 'kpi_card', title: 'Spend', metric: 'spend', position: { x: 0, y: 0, w: 3, h: 4 } },
      { widgetType: 'kpi_card', title: 'Impressions', metric: 'impressions', position: { x: 3, y: 0, w: 3, h: 4 } },
      { widgetType: 'kpi_card', title: 'Clicks', metric: 'clicks', position: { x: 6, y: 0, w: 3, h: 4 } },
      { widgetType: 'kpi_card', title: 'Conversions', metric: 'conversions', position: { x: 9, y: 0, w: 3, h: 4 } },
      { widgetType: 'line_chart', title: 'Spend Trend', metric: 'spend', position: { x: 0, y: 4, w: 6, h: 6 } },
      { widgetType: 'bar_chart', title: 'Performance by Day', metric: 'clicks', position: { x: 6, y: 4, w: 6, h: 6 } },
      { widgetType: 'table', title: 'Metrics Summary', metric: 'spend', position: { x: 0, y: 10, w: 12, h: 6 } },
    ],
  },
  {
    id: 'app-install',
    name: 'App Install Campaign',
    description: 'Track app installs and cost per install',
    category: 'Mobile',
    icon: '📱',
    widgets: [
      { widgetType: 'kpi_card', title: 'App Installs', metric: 'conversions', position: { x: 0, y: 0, w: 4, h: 4 } },
      { widgetType: 'kpi_card', title: 'Cost Per Install', metric: 'cost_per_conversion', position: { x: 4, y: 0, w: 4, h: 4 } },
      { widgetType: 'kpi_card', title: 'Total Spend', metric: 'spend', position: { x: 8, y: 0, w: 4, h: 4 } },
      { widgetType: 'line_chart', title: 'Installs Over Time', metric: 'conversions', position: { x: 0, y: 4, w: 12, h: 6 } },
      { widgetType: 'kpi_card', title: 'Clicks', metric: 'clicks', position: { x: 0, y: 10, w: 4, h: 4 } },
      { widgetType: 'kpi_card', title: 'CTR', metric: 'ctr', position: { x: 4, y: 10, w: 4, h: 4 } },
      { widgetType: 'kpi_card', title: 'Impressions', metric: 'impressions', position: { x: 8, y: 10, w: 4, h: 4 } },
    ],
  },
];

/**
 * Get all templates
 */
function getTemplates() {
  return templates.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    icon: t.icon,
    widgetCount: t.widgets.length,
  }));
}

/**
 * Get template by ID
 */
function getTemplateById(templateId) {
  return templates.find(t => t.id === templateId);
}

/**
 * Get templates by category
 */
function getTemplatesByCategory(category) {
  return templates.filter(t => t.category === category);
}

/**
 * Get all categories
 */
function getCategories() {
  return [...new Set(templates.map(t => t.category))];
}

module.exports = {
  getTemplates,
  getTemplateById,
  getTemplatesByCategory,
  getCategories,
};
