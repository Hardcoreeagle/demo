/**
 * Slide-over Entity Inspector Drawer
 */

class DetailDrawer {
  constructor() {
    this.backdrop = document.getElementById('drawerBackdrop');
    this.titleEl = document.getElementById('drawerTitle');
    this.subtitleEl = document.getElementById('drawerSubtitle');
    this.contentEl = document.getElementById('drawerContent');
    this.closeBtn = document.getElementById('drawerCloseBtn');

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }
    if (this.backdrop) {
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) this.close();
      });
    }

    // Keyboard escape closes drawer
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  open(title, subtitle, data, sapTableInfo) {
    if (!this.backdrop) return;

    this.titleEl.textContent = title;
    this.subtitleEl.textContent = subtitle || 'SAP S/4HANA Entity Details';

    let html = '';

    if (sapTableInfo) {
      html += `
        <div style="background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 8px; padding: 0.85rem 1rem;">
          <div style="font-size: 0.72rem; color: var(--cyan-400); font-weight: 700; text-transform: uppercase;">SAP Source Table Mapping</div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.88rem; color: #fff; margin-top: 0.25rem;">${sapTableInfo}</div>
        </div>
      `;
    }

    if (data && typeof data === 'object') {
      // Key attributes table
      html += `
        <div>
          <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem; letter-spacing: 0.05em;">Key Attributes</h4>
          <table class="modern-table" style="font-size: 0.8rem;">
            <tbody>
      `;

      for (const [k, v] of Object.entries(data)) {
        if (v !== null && v !== undefined && v !== '') {
          let displayVal = v;
          if (Array.isArray(v)) {
            if (v.length === 0) continue;
            if (typeof v[0] === 'string' || typeof v[0] === 'number') {
              displayVal = v.join(', ');
            } else {
              displayVal = `${v.length} item(s)`;
            }
          } else if (typeof v === 'object') {
            displayVal = Object.keys(v).map(subK => `${subK}: ${v[subK]}`).slice(0, 3).join('; ');
          }

          html += `
            <tr>
              <td style="color: var(--text-secondary); width: 35%;">${this.formatKey(k)}</td>
              <td style="font-family: 'JetBrains Mono', monospace; font-weight: 600; color: var(--text-highlight);">${displayVal}</td>
            </tr>
          `;
        }
      }

      html += `
            </tbody>
          </table>
        </div>
      `;

      // Full JSON viewer with copy
      html += `
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
            <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">Complete SAP Object Payload</h4>
            <button id="copyJsonBtn" class="pill-badge" style="cursor: pointer;">Copy JSON</button>
          </div>
          <pre class="json-viewer-box">${this.escapeHtml(JSON.stringify(data, null, 2))}</pre>
        </div>
      `;
    }

    this.contentEl.innerHTML = html;

    const copyBtn = document.getElementById('copyJsonBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy JSON', 1800);
      });
    }

    this.backdrop.classList.add('open');
  }

  close() {
    if (this.backdrop) {
      this.backdrop.classList.remove('open');
    }
  }

  formatKey(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

window.detailDrawer = new DetailDrawer();
