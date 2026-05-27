/**
 * launching-GCR Sections Loader
 * Include this script in launching-GCR pages to dynamically load all sections
 */

const LAUNCHING_GCR_API = 'https://gcr-api-gules.vercel.app';

class LaunchingGCRSections {
  constructor(options = {}) {
    this.api = options.api || LAUNCHING_GCR_API;
    this.cache = {};
  }

  // Load sections configuration
  async loadSections() {
    if (this.cache.sections) return this.cache.sections;

    try {
      const res = await fetch(`${this.api}/api/gcr/sections`);
      const data = await res.json();
      this.cache.sections = data;
      return data;
    } catch (e) {
      console.error('Failed to load sections:', e);
      return null;
    }
  }

  // Load entities for a specific type
  async loadEntitiesByType(type, options = {}) {
    const { limit = 100, offset = 0, subtype = null } = options;
    let url = `${this.api}/api/gcr/entities?type=${type}&limit=${limit}&offset=${offset}`;
    if (subtype) url += `&subtype=${subtype}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      return data.entities || data.businesses || [];
    } catch (e) {
      console.error(`Failed to load entities for ${type}:`, e);
      return [];
    }
  }

  // Build navigation from sections
  async buildNavigation(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const sections = await this.loadSections();
    if (!sections || !sections.sections) return;

    const nav = document.createElement('nav');
    nav.className = 'gcr-sections-nav';

    sections.sections.forEach(section => {
      const link = document.createElement('a');
      link.href = this.getRouteForType(section.type);
      link.className = 'gcr-section-link';
      link.innerHTML = `
        <span class="section-icon">${section.icon}</span>
        <span class="section-name">${section.name}</span>
        <span class="section-count">${section.count}</span>
      `;
      nav.appendChild(link);
    });

    container.appendChild(nav);
  }

  // Render entity cards
  async renderEntities(containerId, type, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const entities = await this.loadEntitiesByType(type, options);
    const grid = document.createElement('div');
    grid.className = 'gcr-entities-grid';

    entities.forEach(entity => {
      const card = this.createEntityCard(entity);
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  // Create entity card element
  createEntityCard(entity) {
    const card = document.createElement('div');
    card.className = 'gcr-entity-card';
    card.setAttribute('data-slug', entity.slug);

    const hero = document.createElement('div');
    hero.className = 'gcr-entity-hero';
    if (entity.hero_image_url) {
      hero.style.backgroundImage = `url(${entity.hero_image_url})`;
    } else {
      hero.textContent = entity.icon || '🏪';
      hero.style.fontSize = '3rem';
    }

    const body = document.createElement('div');
    body.className = 'gcr-entity-body';
    body.innerHTML = `
      <h3>${entity.name}</h3>
      <div class="entity-meta">
        <span class="entity-type">${entity.entity_type}</span>
        ${entity.city ? `<span class="entity-city">${entity.city}</span>` : ''}
        ${entity.rating ? `<span class="entity-rating">⭐ ${entity.rating}</span>` : ''}
      </div>
      <div class="entity-actions">
        <a href="entity-profile.html?slug=${entity.slug}" class="btn-small">View</a>
        ${entity.website_url ? `<a href="${entity.website_url}" target="_blank" class="btn-small">Website</a>` : ''}
      </div>
    `;

    card.appendChild(hero);
    card.appendChild(body);
    return card;
  }

  // Get route for section type
  getRouteForType(type) {
    const routes = {
      'restaurant': 'restaurants.html',
      'hotel': 'staying.html',
      'activity': 'things-to-do.html',
      'park': 'public-spots.html',
      'shopping': 'shopping.html',
      'nightlife': 'nightlife.html',
      'service': 'services.html',
      'artist': 'artists.html',
      'business': 'directory.html'
    };
    return routes[type.toLowerCase()] || `${type.toLowerCase()}.html`;
  }

  // Render stats dashboard
  async renderStats(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const sections = await this.loadSections();
    if (!sections) return;

    const stats = document.createElement('div');
    stats.className = 'gcr-stats-dashboard';
    stats.innerHTML = `
      <h2>Gulf Coast Radar Directory</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${sections.total_entities.toLocaleString()}</div>
          <div class="stat-label">Total Businesses</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${sections.total_types}</div>
          <div class="stat-label">Categories</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${sections.sections.length}</div>
          <div class="stat-label">Sections</div>
        </div>
      </div>
    `;

    container.appendChild(stats);
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LaunchingGCRSections;
}

// Initialize global instance for HTML
window.gcrSections = new LaunchingGCRSections();

// Auto-load on DOMContentLoaded if data attributes present
document.addEventListener('DOMContentLoaded', () => {
  // Look for elements with data-gcr-* attributes and initialize them
  document.querySelectorAll('[data-gcr-nav]').forEach(el => {
    window.gcrSections.buildNavigation(el.id);
  });

  document.querySelectorAll('[data-gcr-section]').forEach(el => {
    const type = el.getAttribute('data-gcr-section');
    window.gcrSections.renderEntities(el.id, type);
  });

  document.querySelectorAll('[data-gcr-stats]').forEach(el => {
    window.gcrSections.renderStats(el.id);
  });
});
