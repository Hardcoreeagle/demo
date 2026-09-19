/**
 * Interactive SAP Business Events Timeline Engine
 */

class EventsTimeline {
  constructor(listContainerId) {
    this.container = document.getElementById(listContainerId);
    this.allEvents = [];
    this.filteredEvents = [];
    this.currentFilter = 'all';
    this.searchQuery = '';
  }

  setEvents(events) {
    this.allEvents = events || [];
    this.applyFilters();
  }

  setFilter(filterType) {
    this.currentFilter = filterType;
    this.applyFilters();
  }

  setSearch(query) {
    this.searchQuery = (query || '').toLowerCase();
    this.applyFilters();
  }

  applyFilters() {
    this.filteredEvents = this.allEvents.filter(ev => {
      // Category filter
      if (this.currentFilter !== 'all') {
        const name = (ev.event_name || '').toLowerCase();
        if (this.currentFilter === 'batch' && !name.includes('batch')) return false;
        if (this.currentFilter === 'order' && !name.includes('order')) return false;
        if (this.currentFilter === 'quality' && !name.includes('inspection') && !name.includes('quality') && !name.includes('decision')) return false;
        if (this.currentFilter === 'movement' && !name.includes('movement') && !name.includes('grn') && !name.includes('issue') && !name.includes('consumption')) return false;
      }

      // Search filter
      if (this.searchQuery) {
        const str = `${ev.event_name} ${ev.business_object} ${ev.entity_key} ${ev.description}`.toLowerCase();
        if (!str.includes(this.searchQuery)) return false;
      }

      return true;
    });

    this.render();
  }

  render() {
    if (!this.container) return;

    if (this.filteredEvents.length === 0) {
      this.container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          No SAP business events matching the current criteria.
        </div>
      `;
      return;
    }

    let html = '';
    this.filteredEvents.forEach(ev => {
      let badgeClass = 'active-cyan';
      const name = (ev.event_name || '').toLowerCase();
      if (name.includes('decision') || name.includes('completed') || name.includes('released')) {
        badgeClass = 'active-green';
      } else if (name.includes('transformation') || name.includes('process')) {
        badgeClass = 'active-purple';
      }

      html += `
        <div class="timeline-item" data-event-id="${ev.event_id || ''}" style="cursor: pointer;">
          <div class="timeline-dot"></div>
          <div class="timeline-header">
            <span class="timeline-title">${ev.event_name || 'Event'}</span>
            <span class="timeline-date">${ev.timestamp || '-'}</span>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center; margin: 0.35rem 0;">
            <span class="pill-badge ${badgeClass}">${ev.business_object || 'SAP Entity'}</span>
            <span class="sap-key" style="color: var(--text-highlight);">${ev.entity_key || ''}</span>
          </div>
          <p class="timeline-desc">${ev.description || ''}</p>
        </div>
      `;
    });

    this.container.innerHTML = html;

    // Attach click listener for drawer inspection
    this.container.querySelectorAll('.timeline-item').forEach((el, idx) => {
      el.addEventListener('click', () => {
        const ev = this.filteredEvents[idx];
        if (ev && window.detailDrawer) {
          window.detailDrawer.open(ev.event_name, `Event ID: ${ev.event_id || '-'}`, ev, `Event Source: ${ev.business_object}`);
        }
      });
    });
  }
}

window.eventsTimeline = new EventsTimeline('timelineList');
