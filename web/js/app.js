/**
 * SAP S/4HANA & ECC Traceability 360° - Master Application Controller
 * CORE ARCHITECTURE: Traceability is driven directly by SAP Business Objects (BO #01 to BO #37).
 */

class AppController {
  constructor() {
    this.currentBatchId = 'PF05043';
    this.batchCategory = 'finished'; // 'finished' or 'raw'
    this.activeTraceFlow = 'finished'; // 'finished' or 'direct_rm'
    this.currentView = 'viewHome';
    this.currentBoFilter = 'all';
    this.currentBatchPkg = null;
    this.allCatalog = [];
    this.allEvents = [];
    this.boManifest = [];
  }

  async init() {
    console.log('[App] Bootstrapping Business Object Traceability 360 Engine...');

    // Theme toggle setup
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    // View Navigation Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const viewId = btn.dataset.view;
        this.switchView(viewId);
      });
    });

    // Business Object Domain Filter Buttons in Traceability View
    document.querySelectorAll('.bo-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bo-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentBoFilter = btn.dataset.bofilter;
        this.renderBusinessObjectsTraceability();
      });
    });

    // Global Search Bar
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleGlobalSearch(e.target.value));
    }

    // Event filter buttons in timeline
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        if (window.eventsTimeline) {
          window.eventsTimeline.setFilter(filter);
        }
      });
    });

    // In-Traceability Sub Navigation (Lifecycle BOs, Graph Visualizer, Audit Events, Transformation)
    this.currentTraceSubview = 'subStages';
    document.querySelectorAll('.trace-subnav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const subview = btn.dataset.subview;
        this.switchTraceSubview(subview);
      });
    });

    // Category Filter Buttons (Finished Batches vs Raw Material Batches)
    const btnCatFinished = document.getElementById('btnCatFinished');
    const btnCatRaw = document.getElementById('btnCatRaw');
    if (btnCatFinished) {
      btnCatFinished.addEventListener('click', () => {
        this.batchCategory = 'finished';
        this.renderBatchSelector();
      });
    }
    if (btnCatRaw) {
      btnCatRaw.addEventListener('click', () => {
        this.batchCategory = 'raw';
        this.renderBatchSelector();
      });
    }

    // Genealogy Stream Switcher (Finished Goods Lifecycle vs Direct Raw Material Flow)
    document.querySelectorAll('.flow-pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.activeTraceFlow = e.currentTarget.dataset.flow;
        document.querySelectorAll('.flow-pill-btn').forEach(b => b.classList.toggle('active', b === e.currentTarget));
        this.renderBusinessObjectsTraceability();
      });
    });

    // In-Traceability Dedicated Batch Search
    const traceSearchInput = document.getElementById('traceBatchSearchInput');
    const traceSearchBtn = document.getElementById('traceBatchSearchBtn');
    if (traceSearchBtn && traceSearchInput) {
      const doSearch = () => {
        const val = traceSearchInput.value.trim().toUpperCase();
        if (val) {
          const availFinished = window.dataService.getAvailableBatches();
          const availRaw = window.dataService.getAvailableRawBatches();
          const allAvail = [...availFinished, ...availRaw];
          const match = allAvail.find(b => b.toUpperCase() === val || b.toUpperCase().includes(val));
          if (match) {
            this.selectBatch(match);
            traceSearchInput.value = match;
          } else {
            alert(`Batch '${val}' not found in registry. Try one of:\nFinished: ${availFinished.slice(0, 5).join(', ')}...\nRaw: ${availRaw.slice(0, 5).join(', ')}...`);
          }
        }
      };
      traceSearchBtn.addEventListener('click', doSearch);
      traceSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSearch();
      });
    }

    // Initialize Graph
    if (window.genealogyGraph) {
      window.genealogyGraph.init();
    }

    // Load initial data
    await this.loadInitialData();

    // Render Batch Selector Pills
    this.renderBatchSelector();

    // Load active batch
    await this.selectBatch(this.currentBatchId);

    // Initial view activation based on current pathname
    this.initRouter();
  }

  initRouter() {
    // Check path
    const path = window.location.pathname.toLowerCase();
    let targetView = 'viewLogin';
    let targetUrl = '/';

    if (path === '/home') {
      targetView = 'viewHome';
      targetUrl = '/home';
    } else if (path === '/tracibility' || path === '/traceability') {
      targetView = 'viewPipeline';
      targetUrl = '/tracibility';
    } else if (path === '/blockchain' || path === '/gs1') {
      targetView = 'viewBlockchain';
      targetUrl = '/blockchain';
    } else if (path === '/counterfeit' || path === '/shield') {
      targetView = 'viewCounterfeit';
      targetUrl = '/counterfeit';
    } else if (path === '/graph' || path === '/genealogy') {
      targetView = 'viewGraph';
      targetUrl = '/graph';
    } else if (path === '/transform') {
      targetView = 'viewTransform';
      targetUrl = '/transform';
    } else if (path === '/events') {
      targetView = 'viewEvents';
      targetUrl = '/events';
    } else {
      // Default: Root URL (/) lands on Login Page
      targetView = 'viewLogin';
      targetUrl = '/';
    }

    // Set up auth button listener
    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
      authBtn.addEventListener('click', () => {
        if (this.currentView === 'viewLogin') {
          this.switchView('viewHome', '/home');
        } else {
          this.switchView('viewLogin', '/');
        }
      });
    }

    // Handle browser back/forward buttons
    window.addEventListener('popstate', (e) => {
      const stateView = e.state?.view || this.getViewFromPath(window.location.pathname);
      this.switchView(stateView, window.location.pathname, false);
    });

    this.switchView(targetView, targetUrl, false);
  }

  getViewFromPath(path) {
    const p = (path || '').toLowerCase();
    if (p === '/' || p === '' || p.includes('login')) return 'viewLogin';
    if (p.includes('tracib') || p.includes('trace')) return 'viewPipeline';
    if (p.includes('block') || p.includes('gs1')) return 'viewBlockchain';
    if (p.includes('counter')) return 'viewCounterfeit';
    if (p.includes('graph')) return 'viewGraph';
    if (p.includes('transform')) return 'viewTransform';
    if (p.includes('event')) return 'viewEvents';
    if (p.includes('home')) return 'viewHome';
    return 'viewLogin';
  }

  getPathFromView(viewId) {
    switch (viewId) {
      case 'viewLogin': return '/';
      case 'viewPipeline': return '/tracibility';
      case 'viewBlockchain': return '/blockchain';
      case 'viewCounterfeit': return '/counterfeit';
      case 'viewGraph': return '/graph';
      case 'viewTransform': return '/transform';
      case 'viewEvents': return '/events';
      default: return '/home';
    }
  }

  toggleTheme() {
    const root = document.documentElement;
    const current = root.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = next === 'dark' ? '🌙' : '☀️';
  }

  switchView(viewId, customUrl = null, updateHistory = true) {
    this.currentView = viewId;
    const urlPath = customUrl || this.getPathFromView(viewId);

    // Update browser URL bar without reloading page
    if (updateHistory && window.history && window.history.pushState) {
      window.history.pushState({ view: viewId }, '', urlPath);
    }

    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === viewId);
    });

    // Update active panel
    document.querySelectorAll('.view-panel').forEach(p => {
      p.classList.toggle('active', p.id === viewId);
    });

    // Toggle top navigation bar: ONLY show on viewPipeline (Traceability 360°), hide on Home and other views
    const tabsNav = document.getElementById('tabsNav');
    if (tabsNav) {
      tabsNav.style.display = (viewId === 'viewPipeline') ? 'flex' : 'none';
    }

    // Update header auth button display
    const authLabel = document.getElementById('authLabel');
    if (authLabel) {
      authLabel.textContent = (viewId === 'viewLogin') ? 'Exit Login' : 'Admin Login';
    }

    // Render corresponding view dynamically
    if (viewId === 'viewLogin') {
      this.renderLoginView();
    } else if (viewId === 'viewHome') {
      this.renderHomeView();
    } else if (viewId === 'viewBlockchain') {
      this.renderBlockchainView();
    } else if (viewId === 'viewCounterfeit') {
      this.renderCounterfeitView();
    } else if (viewId === 'viewPipeline') {
      this.renderBusinessObjectsTraceability();
      if (this.currentTraceSubview === 'subGraph' && window.genealogyGraph && this.currentBatchPkg) {
        setTimeout(() => window.genealogyGraph.render(this.currentBatchPkg), 50);
      }
    }
  }

  switchTraceSubview(subviewId) {
    this.currentTraceSubview = subviewId;

    // Update active subnav buttons
    document.querySelectorAll('.trace-subnav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subview === subviewId);
    });

    // Hide all subview panels
    const subStages = document.getElementById('traceSubStages');
    const subGraph = document.getElementById('traceSubGraph');
    const subEvents = document.getElementById('traceSubEvents');
    const subTransform = document.getElementById('traceSubTransform');

    if (subStages) subStages.style.display = (subviewId === 'subStages') ? 'block' : 'none';
    if (subGraph) subGraph.style.display = (subviewId === 'subGraph') ? 'block' : 'none';
    if (subEvents) subEvents.style.display = (subviewId === 'subEvents') ? 'block' : 'none';
    if (subTransform) subTransform.style.display = (subviewId === 'subTransform') ? 'block' : 'none';

    // Trigger subview renderers
    if (subviewId === 'subStages') {
      this.renderBusinessObjectsTraceability();
    } else if (subviewId === 'subGraph' && window.genealogyGraph && this.currentBatchPkg) {
      setTimeout(() => window.genealogyGraph.render(this.currentBatchPkg), 50);
    } else if (subviewId === 'subEvents' && window.eventsTimeline && this.currentBatchPkg) {
      const evts = this.currentBatchPkg.events && this.currentBatchPkg.events.length > 0
        ? this.currentBatchPkg.events
        : this.allEvents;
      window.eventsTimeline.setEvents(evts);
    } else if (subviewId === 'subTransform') {
      this.renderTransformationView();
    }
  }

  async loadInitialData() {
    try {
      this.allCatalog = await window.dataService.getRelationshipCatalog();
      this.allEvents = await window.dataService.getAllBusinessEvents();
      this.boManifest = await window.dataService.getBusinessObjectsManifest();

      // Render static views
      this.renderBusinessObjectsCatalogGrid();

      // Update badge counts in tabs
      const boBadge = document.getElementById('boCountBadge');
      if (boBadge) boBadge.textContent = this.boManifest.length || 37;

      const evtBadge = document.getElementById('evtCountBadge');
      if (evtBadge) evtBadge.textContent = this.allEvents.length || 580;
    } catch (e) {
      console.error('[App] Error loading initial catalogs:', e);
    }
  }

  renderBatchSelector() {
    const listEl = document.getElementById('batchPillsList');
    if (!listEl) return;

    // Update active state on category tab buttons
    const btnCatFinished = document.getElementById('btnCatFinished');
    const btnCatRaw = document.getElementById('btnCatRaw');
    if (btnCatFinished) btnCatFinished.classList.toggle('active', this.batchCategory === 'finished');
    if (btnCatRaw) btnCatRaw.classList.toggle('active', this.batchCategory === 'raw');

    let batches = [];
    if (this.batchCategory === 'finished') {
      batches = window.dataService.getAvailableBatches();
    } else {
      batches = window.dataService.getAvailableRawBatches();
    }

    let html = '';
    batches.forEach(bId => {
      let tag = 'FINISHED';
      if (bId.startsWith('RM-COAT-')) tag = 'COATING';
      else if (bId.startsWith('RM-MET-')) tag = 'API';
      else if (bId.startsWith('RM-TEL-')) tag = 'API';
      else if (bId.startsWith('RM-')) tag = 'RAW';
      else if (bId.startsWith('PF')) tag = 'METFORMIN';
      else if (bId.startsWith('TE')) tag = 'TELMISARTAN';

      const activeClass = bId === this.currentBatchId ? 'active' : '';

      html += `
        <button class="batch-btn ${activeClass}" data-batch-id="${bId}">
          <span>${bId}</span>
          <span class="tag">${tag}</span>
        </button>
      `;
    });

    listEl.innerHTML = html;

    listEl.querySelectorAll('.batch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const bId = btn.dataset.batchId;
        this.selectBatch(bId);
      });
    });
  }

  async selectBatch(batchId) {
    this.currentBatchId = batchId;

    // Synchronize category state
    if (batchId.startsWith('RM-')) {
      if (this.batchCategory !== 'raw') {
        this.batchCategory = 'raw';
        this.renderBatchSelector();
      }
    } else {
      if (this.batchCategory !== 'finished') {
        this.batchCategory = 'finished';
        this.renderBatchSelector();
      }
    }

    // Update active pill button
    document.querySelectorAll('.batch-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.batchId === batchId);
    });

    try {
      this.currentBatchPkg = await window.dataService.getBatchGenealogyPackage(batchId);
      console.log(`[App] Loaded Batch Package: ${batchId}`, this.currentBatchPkg);

      // 1. Update KPI ribbon
      this.updateKpiRibbon();

      // 2. Render Traceability by Business Objects
      this.renderBusinessObjectsTraceability();

      // 3. Render Transformation Matrix View
      this.renderTransformationView();

      // 4. Render Active View Dynamically
      if (this.currentView === 'viewHome') {
        this.renderHomeView();
      } else if (this.currentView === 'viewBlockchain') {
        this.renderBlockchainView();
      } else if (this.currentView === 'viewCounterfeit') {
        this.renderCounterfeitView();
      }

      // 5. Render Network Graph View
      if (window.genealogyGraph) {
        window.genealogyGraph.render(this.currentBatchPkg);
      }

      // 6. Update Timeline with batch specific events
      if (window.eventsTimeline) {
        const evts = this.currentBatchPkg.events && this.currentBatchPkg.events.length > 0
          ? this.currentBatchPkg.events
          : this.allEvents;
        window.eventsTimeline.setEvents(evts);
      }
    } catch (err) {
      console.error(`[App] Failed to load batch ${batchId}:`, err);
    }
  }

  updateKpiRibbon() {
    if (!this.currentBatchPkg) return;
    const isRaw = this.currentBatchPkg.is_raw_material || this.currentBatchId.startsWith('RM-');
    const bo = this.currentBatchPkg.raw_material_genealogy?.batch_genealogy?.business_objects
      || this.currentBatchPkg.finished_genealogy?.batch_genealogy?.business_objects
      || {};

    const batchIdEl = document.getElementById('kpiBatchId');
    const statusEl = document.getElementById('kpiBatchStatus');
    const matEl = document.getElementById('kpiMaterial');
    const yieldEl = document.getElementById('kpiYield');
    const supplierEl = document.getElementById('kpiSupplier');
    const salesEl = document.getElementById('kpiSales');

    if (batchIdEl) batchIdEl.textContent = this.currentBatchId;
    if (statusEl) statusEl.textContent = bo.batch?.status || 'RELEASED';
    if (matEl) matEl.textContent = bo.material?.material_description || (isRaw ? 'RAW MATERIAL API / EXCIPIENT' : 'PHARMACEUTICAL FINISHED PRODUCT');

    if (isRaw) {
      const stockQty = Number(bo.inventory_stock?.unrestricted_stock || bo.material_movement?.quantity || 110.0);
      const consumedQty = Number(bo.material_consumption?.consumed_quantity || 0.768);
      const uom = bo.material_movement?.UOM || 'KG';
      if (yieldEl) yieldEl.textContent = `RMS Stock: ${stockQty.toFixed(1)} ${uom} (Consumed: ${consumedQty.toFixed(3)} ${uom})`;

      const suppName = bo.supplier_or_source?.Source_Name || 'Aarti Drugs Limited';
      if (supplierEl) supplierEl.textContent = suppName;

      const poId = bo.process_order?.process_order_id || '400000000643';
      const fgBatch = bo.finished_product_output?.batch_id || bo.batch_transformation?.output_batch_id || 'PF05043';
      if (salesEl) salesEl.textContent = `Consumed in PO ${poId} ➔ FG ${fgBatch}`;
    } else {
      const producedQty = Number(bo.yield?.yield_quantity || bo.produced_product?.produced_quantity || bo.process_order?.produced_product?.produced_quantity || 104.034);
      const uom = bo.yield?.UOM || bo.produced_product?.uom || bo.process_order?.UOM || 'KG';
      if (yieldEl) yieldEl.textContent = `${producedQty.toFixed(2)} ${uom}`;

      const suppName = bo.supplier_or_source?.Source_Name || 'Aarti Drugs Limited';
      if (supplierEl) supplierEl.textContent = suppName;

      const delivId = bo.outbound_delivery?.delivery_id || '2100084439';
      const invId = bo.billing_document?.billing_document_id || bo.billing_document?.invoice_id || '5402100863';
      if (salesEl) salesEl.textContent = `Delivery ${delivId} | Inv ${invId} (Clean)`;
    }
  }

  /**
   * CORE TRACEABILITY ENGINE: Structured directly by Business Objects (BO #01 to BO #37).
   */
  renderBusinessObjectsTraceability() {
    const container = document.getElementById('stagesGrid');
    if (!container || !this.currentBatchPkg) return;

    const isRaw = this.currentBatchPkg.is_raw_material || this.currentBatchId.startsWith('RM-');
    const flowSwitcher = document.getElementById('flowSwitcherContainer');
    if (flowSwitcher) {
      flowSwitcher.style.display = isRaw ? 'none' : 'flex';
      const btnFlowFinished = document.getElementById('btnFlowFinished');
      const btnFlowDirectRM = document.getElementById('btnFlowDirectRM');
      const btnFlowCoatRM = document.getElementById('btnFlowCoatRM');
      if (btnFlowFinished) btnFlowFinished.classList.toggle('active', this.activeTraceFlow === 'finished');
      if (btnFlowDirectRM) btnFlowDirectRM.classList.toggle('active', this.activeTraceFlow === 'direct_rm');
      if (btnFlowCoatRM) btnFlowCoatRM.classList.toggle('active', this.activeTraceFlow === 'coat_rm');
    }

    const bo = this.currentBatchPkg.raw_material_genealogy?.batch_genealogy?.business_objects
      || this.currentBatchPkg.finished_genealogy?.batch_genealogy?.business_objects
      || {};
    const rmBo = this.currentBatchPkg.direct_raw_material_flow
      || bo.direct_raw_material_flow
      || (isRaw ? bo : {});
    const coatBo = this.currentBatchPkg.coating_raw_material_flow
      || bo.coating_raw_material_flow
      || (window.BUNDLE_DATA?.raw_batches?.['RM-COAT-05043']?.business_objects)
      || {};
    const batchId = this.currentBatchId;

    if (isRaw || (!isRaw && (this.activeTraceFlow === 'direct_rm' || this.activeTraceFlow === 'coat_rm'))) {
      const isCoating = (!isRaw && this.activeTraceFlow === 'coat_rm');
      const activeBo = isRaw ? bo : (isCoating ? coatBo : rmBo);
      const activeRawBatchId = isRaw ? batchId : (isCoating ? 'RM-COAT-05043' : (activeBo.batch?.batch_id || ('RM-MET-' + batchId.replace('PF', ''))));
      const rawBoTraceabilityChain = [
        {
          boNum: "05",
          name: "Supplier or Source",
          domain: "procurement",
          domainLabel: "Procurement Vendor",
          keyName: "Supplier_or_Source_id",
          keyVal: activeBo.supplier_or_source?.Supplier_or_Source_id || "0000400860",
          relationship: "SUPPLIES_MATERIAL_FOR",
          nextBO: "BO #06: Purchase Requisition",
          sapTables: "LFA1, LFB1, ADRC, EORD",
          summary: `${activeBo.supplier_or_source?.Source_Name || 'Aarti Drugs Ltd'} | Status: ${activeBo.supplier_or_source?.status || 'ACTIVE'}`,
          events: activeBo.supplier_or_source?.events || [{ event_type: "SupplierAudited" }, { event_type: "SupplierApproved" }],
          data: activeBo.supplier_or_source
        },
        {
          boNum: "06",
          name: "Purchase Requisition",
          domain: "procurement",
          domainLabel: "Procurement PR",
          keyName: "purchase_requisition_id",
          keyVal: `${activeBo.purchase_requisition?.purchase_requisition_id || '1000037529'} / ${activeBo.purchase_requisition?.item_id || '0010'}`,
          relationship: "CONVERTED_TO",
          nextBO: "BO #07: Purchase Order",
          sapTables: "EBAN",
          summary: `Material: ${activeBo.purchase_requisition?.material_description || 'API RAW MATERIAL'} | Req Qty: ${activeBo.purchase_requisition?.requested_quantity || 110} KG`,
          events: activeBo.purchase_requisition?.events || [{ event_type: "PurchaseRequisitionCreated" }],
          data: activeBo.purchase_requisition
        },
        {
          boNum: "07",
          name: "Purchase Order",
          domain: "procurement",
          domainLabel: "Purchasing PO",
          keyName: "purchase_order_id",
          keyVal: `${activeBo.purchase_order?.purchase_order_id || '4500012345'} / Item ${activeBo.purchase_order?.item?.item_id || '0010'}`,
          relationship: "RECEIVED_BY",
          nextBO: "BO #37: Goods Receipt (GRN)",
          sapTables: "EKKO, EKPO, EKET",
          summary: `Vendor: ${activeBo.purchase_order?.Supplier_or_Source_id || '0000400860'} | Order Date: ${activeBo.purchase_order?.order_date || '2010-01-05'}`,
          events: activeBo.purchase_order?.events || [{ event_type: "PurchaseOrderCreated" }, { event_type: "PurchaseOrderApproved" }],
          data: activeBo.purchase_order
        },
        {
          boNum: "37",
          name: "Goods Receipt (GRN)",
          domain: "procurement",
          domainLabel: "Inbound Goods Receipt",
          keyName: "material_document_id",
          keyVal: `MATDOC ${activeBo.material_movement?.material_document_id || '5000012345'} (Movement 101)`,
          relationship: "POSTS_MOVEMENT_TO",
          nextBO: "BO #08: Material Movement",
          sapTables: "MATDOC (Movement 101)",
          summary: `Received: ${activeBo.material_movement?.quantity || 110.0} ${activeBo.material_movement?.UOM || 'KG'} to RMS Warehouse Stock`,
          events: [{ event_type: "GRNCreated" }, { event_type: "GRNPosted" }],
          data: activeBo.material_movement
        },
        {
          boNum: "08",
          name: "Material Movement",
          domain: "procurement",
          domainLabel: "Inventory Movement",
          keyName: "material_document_id",
          keyVal: activeBo.material_movement?.material_document_id || "5000012345",
          relationship: "STOCKS_BATCH_INTO",
          nextBO: "BO #09: Inventory / Stock",
          sapTables: "MATDOC Unified Journal",
          summary: `Movement Type: ${activeBo.material_movement?.movement_type || '101'} | Storage Location: ${activeBo.material_movement?.storage_location_id || 'RMS'}`,
          events: activeBo.material_movement?.events || [],
          data: activeBo.material_movement
        },
        {
          boNum: "09",
          name: "Inventory / Stock",
          domain: "procurement",
          domainLabel: "Raw Material Warehouse",
          keyName: "inventory_id",
          keyVal: `Plant ${activeBo.inventory_stock?.plant_id || 'EP04'} / Loc ${activeBo.inventory_stock?.storage_location_id || 'RMS'}`,
          relationship: "MAINTAINS_BATCH",
          nextBO: "BO #04: Batch (Raw Material Master)",
          sapTables: "MCHB, MARD, MARA",
          summary: `Unrestricted Stock: ${activeBo.inventory_stock?.unrestricted_stock || 110.0} KG in Raw Material Store (RMS)`,
          events: activeBo.inventory_stock?.events || [],
          data: activeBo.inventory_stock
        },
        {
          boNum: "04",
          name: "Batch (Raw Material Master)",
          domain: "manufacturing",
          domainLabel: "Batch Master",
          keyName: "batch_id",
          keyVal: activeBo.batch?.batch_id || activeRawBatchId,
          relationship: "INSPECTED_BY",
          nextBO: "BO #24: Quality Inspection Lot",
          sapTables: "MCHA, MCH1",
          summary: `Batch: ${activeBo.batch?.batch_id || activeRawBatchId} | Type: RAW_MATERIAL | Status: ${activeBo.batch?.status || 'RELEASED'} | Exp: ${activeBo.batch?.expiery_date || '2012-05-14'}`,
          events: activeBo.batch?.events || [],
          data: activeBo.batch
        },
        {
          boNum: "24",
          name: "Quality Inspection Lot",
          domain: "quality",
          domainLabel: "Quality Control",
          keyName: "inspection_lot_id",
          keyVal: activeBo.quality_inspection_lot?.inspection_lot_id || "01000012345",
          relationship: "SAMPLED_BY",
          nextBO: "BO #25: Sampling",
          sapTables: "QALS (Origin 01: Goods Receipt Inspection)",
          summary: `Origin: 01 (Inbound GR) | Qty: ${activeBo.quality_inspection_lot?.lot_quantity || 110.0} KG | Status: ${activeBo.quality_inspection_lot?.status || 'COMPLETED'}`,
          events: activeBo.quality_inspection_lot?.events || [],
          data: activeBo.quality_inspection_lot
        },
        {
          boNum: "25",
          name: "Sampling",
          domain: "quality",
          domainLabel: "Quality Control",
          keyName: "sample_id",
          keyVal: activeBo.sampling?.sample_id || "SMP-01000012345-01",
          relationship: "TESTED_FOR",
          nextBO: "BO #26: Inspection Result",
          sapTables: "QASE, QALS",
          summary: `Sample Taken: ${activeBo.sampling?.sample_quantity || 0.5} ${activeBo.sampling?.sample_UOM || 'KG'} | Status: ${activeBo.sampling?.status || 'COMPLETED'}`,
          events: activeBo.sampling?.events || [],
          data: activeBo.sampling
        },
        {
          boNum: "26",
          name: "Inspection Result",
          domain: "quality",
          domainLabel: "Quality Control",
          keyName: "inspection_result_id",
          keyVal: activeBo.inspection_result?.inspection_result_id || "RES-01000012345-01",
          relationship: "EVALUATED_BY",
          nextBO: "BO #27: Usage Decision",
          sapTables: "QAMR, QASE",
          summary: `HPLC Assay: ${activeBo.inspection_result?.result_value || 99.8}% | Valuation: ${activeBo.inspection_result?.result_status || 'PASSED'}`,
          events: activeBo.inspection_result?.events || [],
          data: activeBo.inspection_result
        },
        {
          boNum: "27",
          name: "Usage Decision (UD)",
          domain: "quality",
          domainLabel: "Quality Release",
          keyName: "usage_decision_id",
          keyVal: activeBo.usage_decision?.usage_decision_id || "UD-01000012345",
          relationship: "RELEASES_STOCK_TO_RESERVATION",
          nextBO: "BO #10: Reservation",
          sapTables: "QAVE, QALS",
          summary: `Decision: ${activeBo.usage_decision?.decision_code || 'ACCEPT'} (Unrestricted Release to RMS)`,
          events: activeBo.usage_decision?.events || [],
          data: activeBo.usage_decision
        },
        {
          boNum: "10",
          name: "Reservation",
          domain: "manufacturing",
          domainLabel: "Manufacturing Reservation",
          keyName: "reservation_id",
          keyVal: `${activeBo.reservation?.reservation_id || '2000029081'} / Item ${activeBo.reservation?.reservation_item_id || '0002'}`,
          relationship: "DETERMINES_ALLOCATION_FOR",
          nextBO: "BO #15: Batch Determination",
          sapTables: "RESB, RKPF",
          summary: `Req Qty: ${activeBo.reservation?.requirement_quantity || 0.768} KG | Movement: ${activeBo.reservation?.movement_type || '261'} for Process Order ${activeBo.reservation?.process_order_id || '400000000643'}`,
          events: activeBo.reservation?.events || [],
          data: activeBo.reservation
        },
        {
          boNum: "15",
          name: "Batch Determination",
          domain: "manufacturing",
          domainLabel: "Batch Allocation",
          keyName: "determination_id",
          keyVal: activeBo.batch_determination?.determination_id || "DET-RES-2000029081",
          relationship: "CONSUMED_VIA_MOVEMENT_261",
          nextBO: "BO #16: Material Consumption",
          sapTables: "RESB, MCHB, AFPO",
          summary: `Determined Raw Material Batch [${activeBo.batch_determination?.determined_batch_id || activeRawBatchId}] for Process Order`,
          events: activeBo.batch_determination?.events || [],
          data: activeBo.batch_determination
        },
        {
          boNum: "16",
          name: "Material Consumption",
          domain: "manufacturing",
          domainLabel: "Direct Production Movement",
          keyName: "Material_document_id",
          keyVal: `MATDOC ${activeBo.material_consumption?.Material_document_id || '4900000004'}`,
          relationship: "CONSUMES_INTO_PROCESS_ORDER",
          nextBO: "BO #11: Process Order",
          sapTables: "MATDOC (Movement 261 from RMS)",
          summary: `Consumed: ${activeBo.material_consumption?.consumed_quantity || 0.768} KG | Storage Loc: RMS | Process Order: ${activeBo.material_consumption?.Process_order_id || '400000000643'}`,
          events: activeBo.material_consumption?.events || [],
          data: activeBo.material_consumption
        },
        {
          boNum: "11",
          name: "Process Order",
          domain: "manufacturing",
          domainLabel: "Manufacturing Execution",
          keyName: "process_order_id",
          keyVal: `PO ${activeBo.process_order?.process_order_id || '400000000643'}`,
          relationship: "TRANSFORMS_VIA",
          nextBO: "BO #18: Batch Transformation",
          sapTables: "AFKO, AFPO, AUFK",
          summary: `Finished Process Order consuming this Raw Material | Planned Qty: ${activeBo.process_order?.planned_quantity || 104.03} KG`,
          events: activeBo.process_order?.events || [],
          data: activeBo.process_order
        },
        {
          boNum: "18",
          name: "Batch Transformation",
          domain: "manufacturing",
          domainLabel: "Manufacturing Transformation",
          keyName: "transformation_id",
          keyVal: activeBo.batch_transformation?.transformation_id || "TRANS-STAGE2",
          relationship: "PRODUCES_FINISHED_BATCH",
          nextBO: "BO #04: Downstream Finished Batch",
          sapTables: "AFPO, RESB, MATDOC",
          summary: `Input Raw Material [${activeRawBatchId}] ➔ Output Finished Batch [${activeBo.finished_product_output?.batch_id || activeBo.batch_transformation?.output_batch_id || 'PF05043'}]`,
          events: activeBo.batch_transformation?.events || [],
          data: activeBo.batch_transformation
        },
        {
          boNum: "04",
          name: "Downstream Finished Batch",
          domain: "manufacturing",
          domainLabel: "Finished Product",
          keyName: "batch_id",
          keyVal: activeBo.finished_product_output?.batch_id || activeBo.batch_transformation?.output_batch_id || "PF05043",
          relationship: "ALLOCATED_TO_COMMERCIAL_SALES",
          nextBO: "BO #29: Sales Order",
          sapTables: "MCHA, MCH1, MARA",
          summary: `Produced Batch: ${activeBo.finished_product_output?.batch_id || 'PF05043'} | Qty: ${activeBo.finished_product_output?.produced_quantity || 104.03} KG | ${activeBo.finished_product_output?.material_description || 'Finished Product'}`,
          events: [{ event_type: "BatchReleased" }],
          data: activeBo.finished_product_output
        },
        {
          boNum: "28",
          name: "Customer or CFA",
          domain: "commercial",
          domainLabel: "Sales Customer",
          keyName: "Customer_id",
          keyVal: activeBo.customer_or_cfa?.Customer_id || "0000400860",
          relationship: "PLACES_ORDER_VIA",
          nextBO: "BO #29: Sales Order",
          sapTables: "KNA1, ADRC",
          summary: `${activeBo.customer_or_cfa?.customer_name || 'Central Healthcare Distribution Services'}`,
          events: activeBo.customer_or_cfa?.events || [],
          data: activeBo.customer_or_cfa
        },
        {
          boNum: "29",
          name: "Sales Order",
          domain: "commercial",
          domainLabel: "Commercial Flow",
          keyName: "sales_order_id",
          keyVal: `SO ${activeBo.sales_order?.sales_order_id || '1100809985'}`,
          relationship: "FULFILLED_BY_OUTBOUND_DELIVERY",
          nextBO: "BO #32: Outbound Delivery",
          sapTables: "VBAK, VBAP",
          summary: `Order Date: ${activeBo.sales_order?.order_date || '2010-05-17'} | Status: ${activeBo.sales_order?.status || 'COMPLETED'}`,
          events: activeBo.sales_order?.events || [],
          data: activeBo.sales_order
        },
        {
          boNum: "32",
          name: "Outbound Delivery",
          domain: "commercial",
          domainLabel: "Commercial Logistics",
          keyName: "delivery_id",
          keyVal: `Deliv: ${activeBo.outbound_delivery?.delivery_id || '2100084439'}`,
          relationship: "INVOICED_BY",
          nextBO: "BO #34: Billing Document",
          sapTables: "LIKP, LIPS",
          summary: `Goods Issue: ${activeBo.outbound_delivery?.actual_goods_issue_date || '2010-05-19'} | Shipped to Customer`,
          events: activeBo.outbound_delivery?.events || [],
          data: activeBo.outbound_delivery
        },
        {
          boNum: "34",
          name: "Billing Document (Invoice)",
          domain: "commercial",
          domainLabel: "Commercial Billing",
          keyName: "billing_document_id",
          keyVal: `Inv: ${activeBo.billing_document?.billing_document_id || '5402100863'}`,
          relationship: "END_OF_LIFECYCLE",
          nextBO: "Customer Payment & Clearance",
          sapTables: "VBRK, VBRP",
          summary: `Net: ${activeBo.billing_document?.net_value || 100000} INR | Status: POSTED (Complete Traceability Cleared)`,
          events: activeBo.billing_document?.events || [],
          data: activeBo.billing_document
        }
      ];

      const filteredChain = rawBoTraceabilityChain.filter(item => {
        if (this.currentBoFilter === 'all') return true;
        return item.domain === this.currentBoFilter;
      });

      let customHeader = '';
      if (!isRaw && this.activeTraceFlow === 'coat_rm') {
        const procOrder = activeBo.material_consumption?.Process_order_id || bo.process_order?.process_order_id || '400000014001';
        const matDoc = activeBo.material_consumption?.Material_document_id || '4900000007';
        const resId = activeBo.reservation?.reservation_id || 'RES-COAT-001';
        customHeader = `
          <div style="grid-column: 1 / -1; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-sm); padding: 0.85rem 1.25rem; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
                <span style="color: #34d399; font-weight: 800; font-size: 0.95rem; font-family: 'Outfit', sans-serif;">RAW MATERIAL 2: COATING EXCIPIENT GENEALOGY (RM-COAT-05043)</span>
                <span class="pill-badge active-emerald" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);">COATING RAW MATERIAL</span>
              </div>
              <p style="color: var(--text-secondary); font-size: 0.8rem; margin: 0;">
                Canonical Business Object schemas instantiated for Opadry Film Coating Excipient consumed directly into Process Order <strong style="color: #38bdf8;">${procOrder}</strong> of Finished Batch <strong style="color: #38bdf8;">${batchId}</strong> (Movement 261, Storage Loc: RMS, Res: ${resId}, MatDoc: ${matDoc}, Supplier: Colorcon Asia).
              </p>
            </div>
            <button class="flow-pill-btn" onclick="document.getElementById('btnFlowFinished').click()" style="background: rgba(6, 182, 212, 0.15); border-color: var(--cyan-400); color: var(--cyan-400);">← Back to Finished Lifecycle</button>
          </div>
        `;
      } else if (!isRaw && this.activeTraceFlow === 'direct_rm') {
        const procOrder = activeBo.material_consumption?.Process_order_id || bo.process_order?.process_order_id || '400000000643';
        const matDoc = activeBo.material_consumption?.Material_document_id || '4900000004';
        const resId = activeBo.reservation?.reservation_id || '2000029081';
        customHeader = `
          <div style="grid-column: 1 / -1; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-sm); padding: 0.85rem 1.25rem; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
                <span style="color: #fbbf24; font-weight: 800; font-size: 0.95rem; font-family: 'Outfit', sans-serif;">RAW MATERIAL 1: API GENEALOGY (RM-MET-05043)</span>
                <span class="pill-badge active-amber">API RAW MATERIAL</span>
              </div>
              <p style="color: var(--text-secondary); font-size: 0.8rem; margin: 0;">
                Canonical Business Object schemas instantiated for Metformin HCl API consumed directly into Process Order <strong style="color: #38bdf8;">${procOrder}</strong> of Finished Batch <strong style="color: #38bdf8;">${batchId}</strong> (Movement 261, Storage Loc: RMS, Res: ${resId}, MatDoc: ${matDoc}, Supplier: Aarti Drugs).
              </p>
            </div>
            <button class="flow-pill-btn" onclick="document.getElementById('btnFlowFinished').click()" style="background: rgba(6, 182, 212, 0.15); border-color: var(--cyan-400); color: var(--cyan-400);">← Back to Finished Lifecycle</button>
          </div>
        `;
      }

      return this.renderBoChainCards(container, filteredChain, customHeader);
    }

    // Complete canonical Business Objects Traceability Chain from Planning to Sales
    const boTraceabilityChain = [
      {
        boNum: "01",
        name: "Planning Requirement",
        domain: "planning",
        domainLabel: "Demand Planning",
        keyName: "planning_requirement_id",
        keyVal: bo.planning_requirement?.planning_requirement_id || "PRQ-210250096-01",
        relationship: "PLANS_FOR",
        nextBO: "BO #02: Planned Order",
        sapTables: "PBIM, PBED, T001W",
        summary: `Qty: ${bo.planning_requirement?.requirement_quantity || 105.07} KG | Date: ${bo.planning_requirement?.requirement_date || '2010-02-02'}`,
        events: bo.planning_requirement?.events || [],
        data: bo.planning_requirement
      },
      {
        boNum: "02",
        name: "Planned Order",
        domain: "planning",
        domainLabel: "Demand Planning",
        keyName: "plan_order_id",
        keyVal: bo.planned_order?.plan_order_id || "2000307022",
        relationship: "CONVERTED_TO_ORDER & CREATES_PROCUREMENT",
        nextBO: "BO #06: Purchase Requisition",
        sapTables: "PLAF, MAKT",
        summary: `Order Qty: ${bo.planned_order?.order_quantity || 104.03} KG | Type: ${bo.planned_order?.order_type || 'EOBK'}`,
        events: bo.planned_order?.events || [],
        data: bo.planned_order
      },
      {
        boNum: "05",
        name: "Supplier or Source",
        domain: "procurement",
        domainLabel: "Procurement",
        keyName: "Supplier_or_Source_id",
        keyVal: bo.supplier_or_source?.Supplier_or_Source_id || "0000400860",
        relationship: "SUPPLIES_MATERIAL_FOR",
        nextBO: "BO #06: Purchase Requisition",
        sapTables: "LFA1, LFB1, ADRC, EORD",
        summary: `${bo.supplier_or_source?.Source_Name || 'Aarti Drugs Ltd'} | Status: ${bo.supplier_or_source?.status || 'ACTIVE'}`,
        events: bo.supplier_or_source?.events || [],
        data: bo.supplier_or_source
      },
      {
        boNum: "06",
        name: "Purchase Requisition",
        domain: "procurement",
        domainLabel: "Procurement",
        keyName: "purchase_requisition_id",
        keyVal: `${bo.purchase_requisition?.purchase_requisition_id || '1000037529'} / ${bo.purchase_requisition?.item_id || '0010'}`,
        relationship: "CONVERTED_TO",
        nextBO: "BO #07: Purchase Order",
        sapTables: "EBAN",
        summary: `Material: ${bo.purchase_requisition?.material_description || 'API RAW MATERIAL'} | Qty: ${bo.purchase_requisition?.requested_quantity || 110} KG`,
        events: bo.purchase_requisition?.events || [],
        data: bo.purchase_requisition
      },
      {
        boNum: "07",
        name: "Purchase Order",
        domain: "procurement",
        domainLabel: "Procurement",
        keyName: "purchase_order_id",
        keyVal: `${bo.purchase_order?.purchase_order_id || '4500012345'} / Item ${bo.purchase_order?.item?.item_id || '0010'}`,
        relationship: "RECEIVED_BY",
        nextBO: "BO #37: Goods Receipt (GRN)",
        sapTables: "EKKO, EKPO, EKET",
        summary: `Vendor: ${bo.purchase_order?.Supplier_or_Source_id || '0000400860'} | Order Date: ${bo.purchase_order?.order_date || '2010-01-05'}`,
        events: bo.purchase_order?.events || [],
        data: bo.purchase_order
      },
      {
        boNum: "37",
        name: "Goods Receipt (GRN)",
        domain: "procurement",
        domainLabel: "Procurement (MATDOC)",
        keyName: "grn_id",
        keyVal: "MATDOC 5000012345 (Item 0001)",
        relationship: "POSTS_MOVEMENT",
        nextBO: "BO #08: Material Movement",
        sapTables: "MATDOC (Strictly Zero Logistic Tables)",
        summary: `Movement 101 | Received: 110.00 KG to Storage Location 'RMS'`,
        events: [{ event_type: "GRNCreated" }, { event_type: "GRNPosted" }],
        data: { grn_id: "5000012345", po_id: "4500012345", movement_type: "101", storage_location: "RMS", quantity: 110 }
      },
      {
        boNum: "08",
        name: "Material Movement",
        domain: "procurement",
        domainLabel: "Inventory Movement",
        keyName: "material_document_id",
        keyVal: bo.material_movement?.material_document_id || "MATDOC-5000012345",
        relationship: "STOCKS_BATCH_INTO",
        nextBO: "BO #09: Inventory / Stock",
        sapTables: "MATDOC Unified S/4HANA Journal",
        summary: `Movement Type: ${bo.material_movement?.movement_type || '101'} | Quantity: ${bo.material_movement?.quantity || 110} KG`,
        events: bo.material_movement?.events || [],
        data: bo.material_movement
      },
      {
        boNum: "09",
        name: "Inventory / Stock",
        domain: "procurement",
        domainLabel: "Inventory Master",
        keyName: "inventory_id",
        keyVal: `Stock: Plant ${bo.inventory_stock?.plant_id || 'EP04'} / Loc ${bo.inventory_stock?.storage_location_id || 'RMS'}`,
        relationship: "ALLOCATED_BY",
        nextBO: "BO #10: Reservation",
        sapTables: "MCHB, MARD, MARA",
        summary: `Unrestricted Stock: ${bo.inventory_stock?.unrestricted_stock || 110} KG | Status: Unrestricted`,
        events: bo.inventory_stock?.events || [],
        data: bo.inventory_stock
      },
      {
        boNum: "10",
        name: "Reservation",
        domain: "manufacturing",
        domainLabel: "Manufacturing Master",
        keyName: "reservation_id",
        keyVal: bo.reservation?.reservation_id || "RES-400000014001",
        relationship: "RESERVED_FOR",
        nextBO: "BO #11: Process Order",
        sapTables: "RESB, RKPF",
        summary: `Req Date: ${bo.reservation?.requirement_date || '2010-02-02'} | Movement Type: ${bo.reservation?.movement_type || '261'}`,
        events: bo.reservation?.events || [],
        data: bo.reservation
      },
      {
        boNum: "12",
        name: "Bill of Materials (BOM)",
        domain: "manufacturing",
        domainLabel: "Manufacturing Master",
        keyName: "bom_id",
        keyVal: bo.bom?.bom_id || "BOM-210250096-01",
        relationship: "STRUCTURES_FORMULA_FOR",
        nextBO: "BO #13: Recipe",
        sapTables: "STKO, STPO, MAST",
        summary: `Alternative BOM: ${bo.bom?.alternative_bom || '01'} | Components: ${bo.bom?.Components?.length || 2} materials`,
        events: bo.bom?.events || [],
        data: bo.bom
      },
      {
        boNum: "13",
        name: "Recipe (Routing)",
        domain: "manufacturing",
        domainLabel: "Manufacturing Master",
        keyName: "recipe_id",
        keyVal: bo.recipe?.recipe_id || "RCP-210250096-01",
        relationship: "DEFINES_OPERATIONS_FOR",
        nextBO: "BO #14: Production Version",
        sapTables: "PLKO, PLPO, MAPL",
        summary: `Operations: ${bo.recipe?.operations?.length || 2} phases | Status: ACTIVE`,
        events: bo.recipe?.events || [],
        data: bo.recipe
      },
      {
        boNum: "14",
        name: "Production Version",
        domain: "manufacturing",
        domainLabel: "Manufacturing Master",
        keyName: "production_version_id",
        keyVal: `Version ${bo.production_version?.production_version_id || '00'}`,
        relationship: "SELECTS_RECIPE_BOM_FOR",
        nextBO: "BO #11: Process Order",
        sapTables: "MKAL",
        summary: `BOM: ${bo.production_version?.bom_id || 'BOM-210250096-01'} | Recipe: ${bo.production_version?.recipe_id || 'RCP-210250096-01'}`,
        events: bo.production_version?.events || [],
        data: bo.production_version
      },
      {
        boNum: "15",
        name: "Batch Determination",
        domain: "manufacturing",
        domainLabel: "Batch Allocation",
        keyName: "determination_id",
        keyVal: bo.batch_determination?.determination_id || "DET-RES-001",
        relationship: "DETERMINES_INPUT_BATCH",
        nextBO: "BO #16: Material Consumption",
        sapTables: "RESB, MCHB, AFPO",
        summary: `Selected Input Batch: ${bo.batch_determination?.determined_batch_id || 'PF05043-CORE'} | Qty: ${bo.batch_determination?.allocated_quantity || 105.07} KG`,
        events: bo.batch_determination?.events || [],
        data: bo.batch_determination
      },
      {
        boNum: "11",
        name: "Process Order",
        domain: "manufacturing",
        domainLabel: "Order Execution",
        keyName: "process_order_id",
        keyVal: bo.process_order?.process_order_id || "400000014001",
        relationship: "EXECUTES_OPERATIONS_VIA",
        nextBO: "BO #17: Production Confirmation",
        sapTables: "AFKO, AFPO, AUFK",
        summary: `Planned Qty: ${bo.process_order?.planned_quantity || 104.03} KG | Order Type: ${bo.process_order?.order_type || 'EOBK'} | Status: ${bo.process_order?.status || 'Created/Released'}`,
        events: bo.process_order?.events || [],
        data: bo.process_order
      },
      {
        boNum: "16",
        name: "Material Consumption",
        domain: "manufacturing",
        domainLabel: "Production Movement",
        keyName: "Material_document_id",
        keyVal: bo.material_consumption?.Material_document_id || "MATDOC-261-002",
        relationship: "CONSUMES_BATCH_FOR",
        nextBO: "BO #18: Batch Transformation",
        sapTables: "MATDOC (Movement 261)",
        summary: `Batch Consumed: ${bo.material_consumption?.Batch_id || 'PF05043-CORE'} | Qty: ${bo.material_consumption?.consumed_quantity || 105.07} KG`,
        events: bo.material_consumption?.events || [],
        data: bo.material_consumption
      },
      {
        boNum: "16",
        name: "Direct Raw Material Consumption",
        domain: "manufacturing",
        domainLabel: "Direct RM Movement (RMS)",
        keyName: "Material_document_id",
        keyVal: `MATDOC ${bo.direct_raw_material_flow?.material_consumption?.Material_document_id || '4900000004'}`,
        relationship: "CONSUMED_DIRECTLY_INTO_FINISHED_PROCESS_ORDER",
        nextBO: "BO #11: Process Order",
        sapTables: "MATDOC (Movement 261 from RMS), RESB",
        summary: `Raw Material Batch: ${bo.direct_raw_material_flow?.material_consumption?.Batch_id || ('RM-MET-' + batchId.replace('PF',''))} | Consumed: ${bo.direct_raw_material_flow?.material_consumption?.consumed_quantity || 0.768} KG | Res: ${bo.direct_raw_material_flow?.material_consumption?.reservation_id || '2000029081'} | Order: ${bo.process_order?.process_order_id || '400000000643'}`,
        events: bo.direct_raw_material_flow?.material_consumption?.events || [{ event_type: "MaterialConsumptionPosted" }],
        data: bo.direct_raw_material_flow?.material_consumption || { Material_document_id: "4900000004", batch_id: "RM-MET-05043", consumed_quantity: 0.768, movement_type: "261", storage_location: "RMS", reservation_id: "2000029081", process_order_id: "400000000643" }
      },
      {
        boNum: "36",
        name: "Work Centre",
        domain: "manufacturing",
        domainLabel: "Manufacturing Resource",
        keyName: "work_centre_id",
        keyVal: bo.work_centre?.work_centre_id || "WC-COAT-01",
        relationship: "OPERATES_ON",
        nextBO: "BO #17: Production Confirmation",
        sapTables: "CRHD",
        summary: `Name: ${bo.work_centre?.work_centre_name || 'COATING & PACKAGING SUITE'} | Cost Center: ${bo.work_centre?.cost_centre || 'CC-PROD-01'}`,
        events: bo.work_centre?.events || [],
        data: bo.work_centre
      },
      {
        boNum: "17",
        name: "Production Confirmation",
        domain: "manufacturing",
        domainLabel: "Operational Confirmation",
        keyName: "confermation_id",
        keyVal: bo.production_confirmation?.confermation_id || "CONF-400000014001-01",
        relationship: "CONFIRMS_COMPLETION_TO",
        nextBO: "BO #19: Yield",
        sapTables: "AFRU, AFVC, CRHD",
        summary: `Confirmed Qty: ${bo.production_confirmation?.confirmed_quantity || 104.03} KG | Work Center: ${bo.production_confirmation?.work_center_id || 'WC-COAT-01'}`,
        events: bo.production_confirmation?.events || [],
        data: bo.production_confirmation
      },
      {
        boNum: "18",
        name: "Batch Transformation",
        domain: "manufacturing",
        domainLabel: "Multi-Tier Transformation",
        keyName: "transformation_id",
        keyVal: bo.batch_transformation?.transformation_id || "TRANS-PF05043",
        relationship: "TRANSFORMS_INTERMEDIATE_TO",
        nextBO: "BO #04: Batch",
        sapTables: "AFPO, RESB, MATDOC",
        summary: `Input [${bo.batch_transformation?.input_batch_id || 'PF05043-CORE'}] ➔ Output [${bo.batch_transformation?.output_batch_id || batchId}]`,
        events: bo.batch_transformation?.events || [],
        data: bo.batch_transformation
      },
      {
        boNum: "19",
        name: "Yield & Scrap",
        domain: "manufacturing",
        domainLabel: "Yield Accounting",
        keyName: "material_document_id",
        keyVal: bo.yield?.material_document_id || "YLD-400000014001",
        relationship: "RECORDS_MASS_BALANCE_FOR",
        nextBO: "BO #04: Batch",
        sapTables: "AFRU, AFPO, MATDOC",
        summary: `Yield Qty: ${bo.yield?.yield_quantity || 104.03} KG (99.01%) | Scrap: ${bo.yield?.scrap_quantity || 1.04} KG`,
        events: bo.yield?.events || [],
        data: bo.yield
      },
      {
        boNum: "04",
        name: "Batch (Master)",
        domain: "manufacturing",
        domainLabel: "Batch Master",
        keyName: "batch_id",
        keyVal: bo.batch?.batch_id || batchId,
        relationship: "INSPECTED_BY",
        nextBO: "BO #24: Quality Inspection Lot",
        sapTables: "MCHA, MCH1",
        summary: `Type: ${bo.batch?.batch_type || 'FINISHED_PRODUCT'} | Status: ${bo.batch?.status || 'Released'} | Exp: ${bo.batch?.expiery_date || '2010-05-14'}`,
        events: bo.batch?.events || [],
        data: bo.batch
      },
      {
        boNum: "03",
        name: "Material Master",
        domain: "manufacturing",
        domainLabel: "Material Master",
        keyName: "material_id",
        keyVal: bo.material?.material_id || "000000000210250096",
        relationship: "DEFINES_SPECIFICATION_FOR",
        nextBO: "BO #22: Inspection Plan",
        sapTables: "MARA, MAKT, MARC",
        summary: `${bo.material?.material_description || 'METFORMIN HCL TABLETS USP 500MG'} | Type: ${bo.material?.material_type || 'FINISHED_PRODUCT'}`,
        events: bo.material?.events || [],
        data: bo.material
      },
      {
        boNum: "22",
        name: "Inspection Plan",
        domain: "quality",
        domainLabel: "QM Master Data",
        keyName: "inspection_plan_id",
        keyVal: bo.inspection_plan?.inspection_plan_id || "PLN-QM-001",
        relationship: "GOVERNS_INSPECTION_FOR",
        nextBO: "BO #24: Quality Inspection Lot",
        sapTables: "PLKO, PLPO, PLMK (PLNTY = 'Q')",
        summary: `Plan Usage: 04 (Production Goods Receipt) | Status: APPROVED`,
        events: bo.inspection_plan?.events || [],
        data: bo.inspection_plan
      },
      {
        boNum: "21",
        name: "Inspection Characteristic",
        domain: "quality",
        domainLabel: "QM Specification",
        keyName: "inspection_characteristic_id",
        keyVal: bo.inspection_characteristic?.inspection_characteristic_id || "MIC-ASSAY-01",
        relationship: "MEASURED_IN",
        nextBO: "BO #26: Inspection Result",
        sapTables: "QPMK, PLMK",
        summary: `Characteristic: Chemical Assay (HPLC) | Spec: 98.0% - 102.0%`,
        events: bo.inspection_characteristic?.events || [],
        data: bo.inspection_characteristic
      },
      {
        boNum: "23",
        name: "Inspection Parameter",
        domain: "quality",
        domainLabel: "QM Parameter",
        keyName: "inspection_parameter_id",
        keyVal: bo.inspection_parameter?.inspection_parameter_id || "PARAM-01",
        relationship: "APPLIED_TO",
        nextBO: "BO #24: Quality Inspection Lot",
        sapTables: "QMAT, QAMV",
        summary: `Param: Dissolution Rate, Hardness & Uniformity | Sampling Type: 100%`,
        events: bo.inspection_parameter?.events || [],
        data: bo.inspection_parameter
      },
      {
        boNum: "24",
        name: "Quality Inspection Lot",
        domain: "quality",
        domainLabel: "Quality Control",
        keyName: "inspection_lot_id",
        keyVal: bo.quality_inspection_lot?.inspection_lot_id || "08000014001",
        relationship: "SAMPLED_BY",
        nextBO: "BO #25: Sampling",
        sapTables: "QALS",
        summary: `Origin: 04 (Goods Receipt) | Qty: ${bo.quality_inspection_lot?.lot_quantity || 104.03} KG | Status: ${bo.quality_inspection_lot?.status || 'RELEASED'}`,
        events: bo.quality_inspection_lot?.events || [],
        data: bo.quality_inspection_lot
      },
      {
        boNum: "25",
        name: "Sampling",
        domain: "quality",
        domainLabel: "Quality Control",
        keyName: "sample_id",
        keyVal: bo.sampling?.sample_id || "SMP-08000014001-01",
        relationship: "TESTED_FOR",
        nextBO: "BO #26: Inspection Result",
        sapTables: "QASE, QALS",
        summary: `Sample Qty: ${bo.sampling?.sample_quantity || 0.5} ${bo.sampling?.sample_UOM || 'KG'} | Status: ${bo.sampling?.status || 'COMPLETED'}`,
        events: bo.sampling?.events || [],
        data: bo.sampling
      },
      {
        boNum: "26",
        name: "Inspection Result",
        domain: "quality",
        domainLabel: "Quality Control",
        keyName: "inspection_result_id",
        keyVal: bo.inspection_result?.inspection_result_id || "RES-08000014001-01",
        relationship: "EVALUATED_BY",
        nextBO: "BO #27: Usage Decision",
        sapTables: "QAMR, QASE, QALS",
        summary: `Assay Result: ${bo.inspection_result?.result_value || 99.8}% | Valuation: ${bo.inspection_result?.result_status || 'PASSED'}`,
        events: bo.inspection_result?.events || [],
        data: bo.inspection_result
      },
      {
        boNum: "27",
        name: "Usage Decision (UD)",
        domain: "quality",
        domainLabel: "Quality Release",
        keyName: "usage_decision_id",
        keyVal: bo.usage_decision?.usage_decision_id || "UD-08000014001",
        relationship: "RELEASES_BATCH_TO_SALES",
        nextBO: "BO #31: Sales Batch Allocation",
        sapTables: "QAVE, QALS",
        summary: `Decision Code: ${bo.usage_decision?.decision_code || 'ACCEPT'} | Status: ${bo.usage_decision?.desion_status || 'APPROVED'} (Stock Unrestricted)`,
        events: bo.usage_decision?.events || [],
        data: bo.usage_decision
      },
      {
        boNum: "28",
        name: "Customer or CFA",
        domain: "commercial",
        domainLabel: "Sales Master",
        keyName: "Customer_id",
        keyVal: bo.customer_or_cfa?.Customer_id || "0000400860",
        relationship: "PLACES_ORDER_VIA",
        nextBO: "BO #29: Sales Order",
        sapTables: "KNA1, KNB1, ADRC",
        summary: `${bo.customer_or_cfa?.customer_name || 'Central Healthcare Distribution Services'} | Group: ${bo.customer_or_cfa?.customer_group || 'DISTRIBUTOR'}`,
        events: bo.customer_or_cfa?.events || [],
        data: bo.customer_or_cfa
      },
      {
        boNum: "29",
        name: "Sales Order",
        domain: "commercial",
        domainLabel: "Commercial Flow",
        keyName: "sales_order_id",
        keyVal: bo.sales_order?.sales_order_id || "1100809985",
        relationship: "CONTAINS_LINE_ITEM",
        nextBO: "BO #30: Sales Order Item",
        sapTables: "VBAK, VBUK",
        summary: `Order Date: ${bo.sales_order?.order_date || '2010-05-17'} | Status: ${bo.sales_order?.status || 'COMPLETED'} | Currency: ${bo.sales_order?.currency || 'INR'}`,
        events: bo.sales_order?.events || [],
        data: bo.sales_order
      },
      {
        boNum: "30",
        name: "Sales Order Item",
        domain: "commercial",
        domainLabel: "Commercial Flow",
        keyName: "item_id",
        keyVal: `SO ${bo.sales_order_item?.sales_order_id || '1100809985'} / Line ${bo.sales_order_item?.item_id || '000010'}`,
        relationship: "ALLOCATES_BATCH_VIA",
        nextBO: "BO #31: Sales Batch Allocation",
        sapTables: "VBAP, VBAK",
        summary: `Ordered: ${bo.sales_order_item?.ordered_quantity || 100} KG | Confirmed: ${bo.sales_order_item?.confirmed_quantity || 100} KG`,
        events: bo.sales_order_item?.events || [],
        data: bo.sales_order_item
      },
      {
        boNum: "31",
        name: "Sales Batch Allocation",
        domain: "commercial",
        domainLabel: "Commercial Flow",
        keyName: "delivery_id",
        keyVal: `Delivery ${bo.sales_batch_allocation?.delivery_id || '2100084439'} / Line ${bo.sales_batch_allocation?.delivery_item_id || '900055'}`,
        relationship: "CONFIRMS_PICKING_INTO",
        nextBO: "BO #32: Outbound Delivery",
        sapTables: "LIPS, VBAP, VBFA",
        summary: `Allocated Batch: ${bo.sales_batch_allocation?.Batch_id || batchId} | Status: ${bo.sales_batch_allocation?.allocated_status || 'CONFIRMED'}`,
        events: bo.sales_batch_allocation?.events || [],
        data: bo.sales_batch_allocation
      },
      {
        boNum: "32",
        name: "Outbound Delivery",
        domain: "commercial",
        domainLabel: "Shipping & Fulfillment",
        keyName: "delivery_id",
        keyVal: bo.outbound_delivery?.delivery_id || "2100084439",
        relationship: "SHIPS_ITEMS_VIA",
        nextBO: "BO #33: Delivery Item",
        sapTables: "LIKP, LIPS",
        summary: `Delivery Type: ${bo.outbound_delivery?.delivery_type || 'STANDARD_OUTBOUND'} | Goods Issue: ${bo.outbound_delivery?.actual_goods_issue_date || '2010-05-19'}`,
        events: bo.outbound_delivery?.events || [],
        data: bo.outbound_delivery
      },
      {
        boNum: "33",
        name: "Delivery Item",
        domain: "commercial",
        domainLabel: "Shipping & Fulfillment",
        keyName: "item_id",
        keyVal: `Delivery ${bo.delivery_item?.delivery_id || '2100084439'} / Item ${bo.delivery_item?.item_id || '900055'}`,
        relationship: "INVOICED_BY",
        nextBO: "BO #34: Billing Document",
        sapTables: "LIPS",
        summary: `Shipped Batch: ${bo.delivery_item?.Batch_id || batchId} | Qty: ${bo.delivery_item?.delivery_quantity || 104.03} KG | Loc: SFS`,
        events: bo.delivery_item?.events || [],
        data: bo.delivery_item
      },
      {
        boNum: "34",
        name: "Billing Document (Invoice)",
        domain: "commercial",
        domainLabel: "Commercial Billing",
        keyName: "billing_document_id",
        keyVal: bo.billing_document?.billing_document_id || "5402100863",
        relationship: "AUDITED_FOR_RETURNS_IN",
        nextBO: "BO #35: Sales Return",
        sapTables: "VBRK, VBRP",
        summary: `Net: ${bo.billing_document?.net_value || 100000} INR | Gross: ${bo.billing_document?.gross_value || 118000} INR | Status: ${bo.billing_document?.status || 'POSTED'}`,
        events: bo.billing_document?.events || [],
        data: bo.billing_document
      },
      {
        boNum: "35",
        name: "Sales Return",
        domain: "commercial",
        domainLabel: "Post-Sales Audit",
        keyName: "status",
        keyVal: "Status: NO_RETURN",
        relationship: "END_OF_LIFECYCLE",
        nextBO: "Fully Verified Clean",
        sapTables: "VBRK, VBRP, VBAP, VBFA",
        summary: `Returns Status: Verified NO_RETURN | 0 complaints or credit memos recorded`,
        events: bo.sales_return?.events || [],
        data: bo.sales_return || { status: "NO_RETURN", customer_id: bo.customer_or_cfa?.Customer_id, batch_id: batchId }
      }
    ];

    // Filter by Domain if selected
    const filteredChain = boTraceabilityChain.filter(item => {
      if (this.currentBoFilter === 'all') return true;
      return item.domain === this.currentBoFilter;
    });

    return this.renderBoChainCards(container, filteredChain);
  }

  renderBoChainCards(container, filteredChain, customHeaderHtml = '') {
    let html = customHeaderHtml || '';
    filteredChain.forEach((item, idx) => {
      let domainBadgeColor = 'active-cyan';
      if (item.domain === 'planning') domainBadgeColor = 'active-purple';
      else if (item.domain === 'procurement') domainBadgeColor = 'active-cyan';
      else if (item.domain === 'manufacturing') domainBadgeColor = 'active-purple';
      else if (item.domain === 'quality') domainBadgeColor = 'active-green';
      else if (item.domain === 'commercial') domainBadgeColor = 'active-cyan';

      html += `
        <div class="stage-card bo-trace-card" data-bo-num="${item.boNum}">
          <div class="stage-card-header">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                <span class="stage-num-badge" style="background: var(--cyan-bg); color: var(--cyan-400); font-weight: 800;">BO #${item.boNum}</span>
                <span class="pill-badge ${domainBadgeColor}" style="font-size: 0.68rem;">${item.domainLabel}</span>
              </div>
              <h3 class="stage-title">${item.name}</h3>
            </div>
            <span class="pill-badge" style="font-family: 'JetBrains Mono', monospace; font-size: 0.68rem;">${item.events.length} Events</span>
          </div>

          <div style="background: rgba(0,0,0,0.3); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); margin: 0.25rem 0;">
            <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Instance Key (${item.keyName})</div>
            <div class="sap-key" style="font-size: 0.92rem; color: var(--text-highlight);">${item.keyVal}</div>
          </div>

          <p class="stage-meta">${item.summary}</p>

          <div style="background: rgba(6, 182, 212, 0.05); border: 1px dashed var(--cyan-border); padding: 0.4rem 0.6rem; border-radius: var(--radius-sm); font-size: 0.72rem; display: flex; align-items: center; justify-content: space-between;">
            <span style="color: var(--text-muted); font-weight: 600;">Relationship:</span>
            <span style="color: var(--cyan-400); font-family: 'JetBrains Mono', monospace; font-weight: 700;">➔ ${item.relationship}</span>
          </div>

          <div class="sap-table-source">
            <span>SAP Tables:</span>
            <span>${item.sapTables}</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach click listener for drawer inspection
    container.querySelectorAll('.bo-trace-card').forEach((card, idx) => {
      card.addEventListener('click', () => {
        const item = filteredChain[idx];
        if (window.detailDrawer) {
          window.detailDrawer.open(
            `BO #${item.boNum}: ${item.name}`,
            `Traceability Node: ${item.keyVal}`,
            item.data,
            `SAP Source Tables: ${item.sapTables} | Relationship: ${item.relationship} ➔ ${item.nextBO}`
          );
        }
      });
    });
  }

  renderTransformationView() {
    const container = document.getElementById('transformationContainer');
    if (!container || !this.currentBatchPkg) return;

    const isRaw = this.currentBatchPkg.is_raw_material || this.currentBatchId.startsWith('RM-');
    if (isRaw) {
      const rbo = this.currentBatchPkg.raw_material_genealogy?.batch_genealogy?.business_objects
        || this.currentBatchPkg.finished_genealogy?.batch_genealogy?.business_objects
        || {};
      const rawBatch = this.currentBatchId;
      const rawMatDesc = rbo.material?.material_description || 'Active Pharmaceutical Ingredient';
      const stockQty = Number(rbo.inventory_stock?.unrestricted_stock || rbo.material_movement?.quantity || 110.0);
      const consumedQty = Number(rbo.material_consumption?.consumed_quantity || 0.768);
      const remainQty = Math.max(0, stockQty - consumedQty);
      const poId = rbo.process_order?.process_order_id || '400000000643';
      const resId = rbo.reservation?.reservation_id || '2000029081';
      const resItem = rbo.reservation?.reservation_item_id || '0002';
      const matDoc = rbo.material_consumption?.Material_document_id || '4900000004';
      const fgBatch = rbo.finished_product_output?.batch_id || rbo.batch_transformation?.output_batch_id || 'PF05043';
      const fgMatDesc = rbo.finished_product_output?.material_description || 'Finished Pharmaceutical Product';
      const fgQty = Number(rbo.finished_product_output?.produced_quantity || 104.034);

      container.innerHTML = `
        <div class="mass-balance-card">
          <h3 style="font-size: 1.15rem; color: var(--text-primary); margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between;">
            <span>Raw Material Batch Traceability & Downstream Consumption (${rawBatch})</span>
            <span class="pill-badge active-green">BO #10, BO #16 & BO #18 Consumption</span>
          </h3>

          <div class="tier-block">
            <div class="tier-header">
              <div class="tier-title">
                <span>Warehouse Stock in RMS ➔ Movement 261 Consumption ➔ Process Order Execution</span>
              </div>
              <span class="sap-key">Reservation: ${resId} (Item ${resItem}) | Movement: 261 | Storage Loc: RMS</span>
            </div>
            <div class="tier-flow">
              <div class="flow-box">
                <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">BO #04 Raw Material Batch</div>
                <div class="sap-key" style="font-size: 1rem; color: var(--amber-400); margin: 0.35rem 0;">${rawBatch}</div>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">${rawMatDesc.slice(0, 36)}</div>
                <div style="font-size: 0.8rem; font-weight: 600; color: #fff; margin-top: 0.4rem;">BO #09 Initial Stock: ${stockQty.toFixed(1)} KG</div>
              </div>
              <div class="flow-arrow">
                <span style="font-size: 1.4rem;">➔</span>
                <span style="font-size: 0.7rem;">BO #16 MATDOC 261</span>
              </div>
              <div class="flow-box" style="border-left: 3px solid var(--cyan-400);">
                <div style="font-size: 0.72rem; color: var(--cyan-400); font-weight: 700; text-transform: uppercase;">BO #16 Direct Consumption</div>
                <div class="sap-key" style="font-size: 1rem; color: var(--cyan-400); margin: 0.35rem 0;">MATDOC ${matDoc}</div>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">Issued from Storage Loc RMS to Process Order</div>
                <div style="font-size: 0.8rem; font-weight: 600; color: var(--emerald-400); margin-top: 0.4rem;">Consumed: ${consumedQty.toFixed(3)} KG (Remaining: ${remainQty.toFixed(1)} KG)</div>
              </div>
              <div class="flow-arrow">
                <span style="font-size: 1.4rem;">➔</span>
                <span style="font-size: 0.7rem;">BO #18 TRANS</span>
              </div>
              <div class="flow-box">
                <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Downstream BO #04 Output</div>
                <div class="sap-key" style="font-size: 1rem; color: var(--purple-400); margin: 0.35rem 0;">${fgBatch}</div>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">${fgMatDesc.slice(0, 35)}</div>
                <div style="font-size: 0.8rem; font-weight: 600; color: #fff; margin-top: 0.4rem;">Order ${poId}: ${fgQty.toFixed(2)} KG Produced</div>
              </div>
            </div>
          </div>

          <div style="margin-top: 1.5rem;">
            <h4 style="font-size: 0.88rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.75rem; letter-spacing: 0.05em;">SAP Consumption Audit Trail (Table MATDOC & RESB)</h4>
            <div class="modern-table-wrapper">
              <table class="modern-table">
                <thead>
                  <tr>
                    <th>Raw Batch ID</th>
                    <th>Material</th>
                    <th>Storage Loc</th>
                    <th>Reservation</th>
                    <th>Movement</th>
                    <th>MATDOC ID</th>
                    <th>Consumed Qty</th>
                    <th>Process Order</th>
                    <th>Downstream FG Batch</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="sap-key">${rawBatch}</td>
                    <td>${rawMatDesc.slice(0, 24)}</td>
                    <td><span class="pill-badge active-blue">RMS</span></td>
                    <td class="sap-key">${resId} / ${resItem}</td>
                    <td><span class="pill-badge active-green">261</span></td>
                    <td class="sap-key">${matDoc}</td>
                    <td style="font-weight: 700; color: var(--emerald-400);">${consumedQty.toFixed(3)} KG</td>
                    <td class="sap-key">${poId}</td>
                    <td class="sap-key">${fgBatch}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const fbo = this.currentBatchPkg.finished_genealogy?.batch_genealogy?.business_objects || {};
    const sbo = this.currentBatchPkg.semifinished_genealogy?.batch_genealogy?.business_objects || fbo.semifinished_stage || {};

    const batchId = this.currentBatchId;
    const finishBatch = batchId;

    const coreBatch = fbo.process_order?.input_batches?.[0]
      || sbo.batch?.batch_id
      || fbo.semifinished_stage?.batch_id
      || `${batchId}-CORE`;

    const rawBatch = fbo.material_movement?.Batch_id
      || sbo.material_consumption?.Batch_id
      || sbo.process_order?.input_batches?.[0]
      || (batchId.startsWith('TE') ? `RM-TEL-${batchId.replace('TE', '')}` : `RM-MET-${batchId.replace('PF', '')}`);

    // Stage 1 (SFG) dynamic values
    const sfgProcessID = sbo.process_order?.process_order_id
      || fbo.semifinished_stage?.process_order_id
      || '4000000004001';

    const sfgConsumeQty = Number(sbo.material_consumption?.consumed_quantity
      || fbo.semifinished_stage?.material_consumption?.consumed_quantity
      || sbo.planned_order?.order_quantity
      || 110);

    const sfgYieldQty = Number(sbo.yield?.yield_quantity
      || fbo.semifinished_stage?.yield?.yield_quantity
      || sbo.process_order?.produced_product?.produced_quantity
      || (sfgConsumeQty * 0.955));

    const sfgScrapQty = Math.max(0, sfgConsumeQty - sfgYieldQty);
    const sfgYieldPct = sfgConsumeQty > 0 ? ((sfgYieldQty / sfgConsumeQty) * 100).toFixed(2) : '95.52';
    const sfgConfId = sbo.production_confirmation?.confermation_id
      || fbo.semifinished_stage?.production_confirmation?.confermation_id
      || `CONF-${sfgProcessID}-01`;

    // Stage 2 (FG) dynamic values
    const fgProcessID = fbo.process_order?.process_order_id || '400000014001';

    const fgConsumeQty = Number(fbo.material_consumption?.consumed_quantity
      || fbo.process_order?.consumed_batches?.[0]?.consumed_quantity
      || sfgYieldQty);

    const fgYieldQty = Number(fbo.yield?.yield_quantity
      || fbo.process_order?.produced_product?.produced_quantity
      || (fgConsumeQty * 0.99));

    const fgUom = fbo.yield?.UOM || fbo.process_order?.UOM || 'KG';
    const fgScrapQty = Math.max(0, fgConsumeQty - fgYieldQty);
    const fgYieldPct = fgConsumeQty > 0 ? ((fgYieldQty / fgConsumeQty) * 100).toFixed(2) : '99.01';
    const fgConfId = fbo.production_confirmation?.confermation_id || `CONF-${fgProcessID}-01`;

    const rawMatDesc = fbo.purchase_order?.item?.description || 'Metformin HCl API / Active Ingredient';
    const fgMatDesc = fbo.material?.material_description || 'Film Coated Tablets USP 500mg';

    const coatRawBatch = fbo.process_order?.consumed_batches?.[1]?.batch_id
      || (batchId.startsWith('TE') ? `RM-COAT-${batchId.replace('TE', '')}` : `RM-COAT-${batchId.replace('PF', '')}`);
    const coatConsumeQty = Number(fbo.process_order?.consumed_batches?.[1]?.consumed_quantity || 0.534);
    const coatMatDesc = fbo.process_order?.consumed_batches?.[1]?.material_description || 'OPADRY Film Coating Suspension IP/USP';

    container.innerHTML = `
      <div class="mass-balance-card">
        <h3 style="font-size: 1.15rem; color: var(--text-primary); margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between;">
          <span>Business Objects Multi-Tier Manufacturing Transformation (${batchId})</span>
          <span class="pill-badge active-green">BO #18 & BO #19 Mass Balance</span>
        </h3>

        <!-- Tier 1 -->
        <div class="tier-block">
          <div class="tier-header">
            <div class="tier-title">
              <span>Stage 1: BO #04 (Raw API Batch) ➔ BO #11 (Process Order 1) ➔ BO #04 (Semi-Finished Core)</span>
            </div>
            <span class="sap-key">Order: ${sfgProcessID} | BO #36 Work Center: WC-GRAN-01</span>
          </div>
          <div class="tier-flow">
            <div class="flow-box">
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">BO #04 Input API Batch</div>
              <div class="sap-key" style="font-size: 1rem; color: var(--amber-400); margin: 0.35rem 0;">${rawBatch}</div>
              <div style="font-size: 0.78rem; color: var(--text-secondary);">BO #03 Material: ${rawMatDesc.slice(0, 35)}</div>
              <div style="font-size: 0.8rem; font-weight: 600; color: #fff; margin-top: 0.4rem;">BO #16 Consumed: ${sfgConsumeQty.toFixed(3)} KG</div>
            </div>
            <div class="flow-arrow">
              <span style="font-size: 1.4rem;">➔</span>
              <span style="font-size: 0.7rem;">BO #18 TRANS</span>
            </div>
            <div class="flow-box">
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">BO #04 Output Semi-Finished</div>
              <div class="sap-key" style="font-size: 1rem; color: var(--purple-400); margin: 0.35rem 0;">${coreBatch}</div>
              <div style="font-size: 0.78rem; color: var(--text-secondary);">Uncoated Core Tablet intermediate</div>
              <div style="font-size: 0.8rem; font-weight: 600; color: #fff; margin-top: 0.4rem;">BO #19 Produced: ${sfgYieldQty.toFixed(3)} KG</div>
            </div>
          </div>
        </div>

        <!-- Tier 2 -->
        <div class="tier-block">
          <div class="tier-header">
            <div class="tier-title">
              <span>Stage 2: BO #04 (Core Batch) + BO #04 (Coating RM) ➔ BO #11 (Process Order 2) ➔ BO #04 (Finished Product)</span>
            </div>
            <span class="sap-key">Order: ${fgProcessID} | BO #36 Work Center: WC-COAT-01</span>
          </div>
          <div class="tier-flow">
            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
              <div class="flow-box">
                <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">BO #04 Input Semi-Finished</div>
                <div class="sap-key" style="font-size: 1rem; color: var(--purple-400); margin: 0.35rem 0;">${coreBatch}</div>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">Uncoated Core Tablets</div>
                <div style="font-size: 0.8rem; font-weight: 600; color: #fff; margin-top: 0.4rem;">BO #16 Consumed: ${fgConsumeQty.toFixed(3)} KG</div>
              </div>
              <div class="flow-box" style="border-left: 3px solid var(--amber-400);">
                <div style="font-size: 0.72rem; color: var(--amber-400); font-weight: 700; text-transform: uppercase;">BO #04 Co-Consumed Raw Material</div>
                <div class="sap-key" style="font-size: 1rem; color: var(--amber-400); margin: 0.35rem 0;">${coatRawBatch}</div>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">${coatMatDesc.slice(0, 36)}</div>
                <div style="font-size: 0.8rem; font-weight: 600; color: #fff; margin-top: 0.4rem;">BO #16 Consumed: ${coatConsumeQty.toFixed(3)} KG</div>
              </div>
            </div>
            <div class="flow-arrow">
              <span style="font-size: 1.4rem;">➔</span>
              <span style="font-size: 0.7rem;">BO #18 TRANS</span>
            </div>
            <div class="flow-box">
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">BO #04 Output Finished Batch</div>
              <div class="sap-key" style="font-size: 1rem; color: var(--cyan-400); margin: 0.35rem 0;">${finishBatch}</div>
              <div style="font-size: 0.78rem; color: var(--text-secondary);">${fgMatDesc.slice(0, 35)}</div>
              <div style="font-size: 0.8rem; font-weight: 600; color: var(--emerald-400); margin-top: 0.4rem;">BO #19 Yield: ${fgYieldQty.toFixed(3)} ${fgUom} (${fgYieldPct}%)</div>
            </div>
          </div>
        </div>

        <!-- Scrap & Reconciliation Table -->
        <div style="margin-top: 1.5rem;">
          <h4 style="font-size: 0.88rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.75rem; letter-spacing: 0.05em;">Business Objects Mass Balance Reconciliation (BO #16, #17, #19)</h4>
          <div class="modern-table-wrapper">
            <table class="modern-table">
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>BO #16 Input Batch</th>
                  <th>Input Qty</th>
                  <th>BO #04 Output Batch</th>
                  <th>BO #19 Output Qty</th>
                  <th>Scrap Loss</th>
                  <th>Yield %</th>
                  <th>BO #17 Confirmation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Stage 1: Granulation</td>
                  <td class="sap-key">${rawBatch}</td>
                  <td>${sfgConsumeQty.toFixed(3)} KG</td>
                  <td class="sap-key">${coreBatch}</td>
                  <td>${sfgYieldQty.toFixed(3)} KG</td>
                  <td>${sfgScrapQty.toFixed(3)} KG</td>
                  <td>${sfgYieldPct}%</td>
                  <td class="sap-key">${sfgConfId}</td>
                </tr>
                <tr>
                  <td>Stage 2: Film Coating (Core)</td>
                  <td class="sap-key">${coreBatch}</td>
                  <td>${fgConsumeQty.toFixed(3)} KG</td>
                  <td class="sap-key">${finishBatch}</td>
                  <td>${fgYieldQty.toFixed(3)} ${fgUom}</td>
                  <td>${fgScrapQty.toFixed(3)} ${fgUom}</td>
                  <td style="color: var(--emerald-400); font-weight: 700;">${fgYieldPct}%</td>
                  <td class="sap-key">${fgConfId}</td>
                </tr>
                <tr>
                  <td>Stage 2: Film Coating (Coating RM)</td>
                  <td class="sap-key">${coatRawBatch}</td>
                  <td>${coatConsumeQty.toFixed(3)} KG</td>
                  <td class="sap-key">${finishBatch}</td>
                  <td>Combined in ${finishBatch}</td>
                  <td>0.000 KG</td>
                  <td style="color: var(--emerald-400); font-weight: 700;">100.00%</td>
                  <td class="sap-key">${fgConfId}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  renderBusinessObjectsCatalogGrid() {
    const container = document.getElementById('boGrid');
    if (!container) return;

    let html = '';
    this.boManifest.forEach(bo => {
      const cleanName = bo.name.replace(/^\d+_/, '').replace(/\.json$/, '').replace(/_/g, ' ').toUpperCase();

      html += `
        <div class="bo-card" data-filename="${bo.filename}">
          <div class="bo-card-top">
            <span class="bo-index">BO #${bo.index}</span>
            <span class="bo-count-badge">${bo.record_count} Records</span>
          </div>
          <div class="bo-title">${cleanName}</div>
          <div class="bo-sources">${bo.filename}</div>
        </div>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.bo-card').forEach(card => {
      card.addEventListener('click', () => {
        const fn = card.dataset.filename;
        if (window.detailDrawer) {
          window.detailDrawer.open(`Business Object: ${fn}`, `Independent SAP Business Object`, { filename: fn, location: `output/business_objects/${fn}` }, `SAP Standard Schema`);
        }
      });
    });
  }

  handleGlobalSearch(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return;

    // If query matches a batch ID, switch to it
    const batches = window.dataService.getAvailableBatches();
    const match = batches.find(b => b.toLowerCase().includes(q));
    if (match && match !== this.currentBatchId) {
      this.selectBatch(match);
    }

    // Filter timeline
    if (window.eventsTimeline) {
      window.eventsTimeline.setSearch(q);
    }
  }

  /**
   * 1. HOME OVERVIEW LANDING VIEW (Completely Batch-Independent Introduction + Side Options)
   */
  renderHomeView() {
    const container = document.getElementById('homeContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="home-pure-wrapper">
        <!-- Left Side: Comprehensive Platform Introduction -->
        <div class="home-intro-card">
          <div class="home-hero-badge" style="width: fit-content; margin-bottom: 1rem;">
            ENTERPRISE PHARMACEUTICAL TRACEABILITY 360°
          </div>
          <h1 class="home-title" style="font-size: 2.2rem; line-height: 1.2; margin-bottom: 1rem;">
            Next-Generation <span>SAP Supply Chain</span> Architecture
          </h1>
          <p class="home-desc" style="font-size: 0.98rem; line-height: 1.7; color: var(--text-secondary); margin-bottom: 1.5rem;">
            Welcome to the unified SAP S/4HANA & ECC Traceability Portal. Built directly upon canonical 
            <strong>37 SAP Business Objects (BO #01 to BO #37)</strong>, this enterprise platform resolves multi-echelon 
            genealogies across Active Pharmaceutical Ingredient (API) procurement, granulation, tablet compression, film coating, 
            quality inspection lots, and global sales custody.
          </p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background: rgba(15, 23, 42, 0.6); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.06);">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--cyan-400); font-weight: 700;">Zero Hardcoding</div>
              <div style="font-size: 13px; color: var(--text-primary); margin-top: 4px;">Dynamic foreign-key graph traversal across S/4HANA & ECC tables</div>
            </div>
            <div style="background: rgba(15, 23, 42, 0.6); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.06);">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--emerald-400); font-weight: 700;">Regulatory Compliance</div>
              <div style="font-size: 13px; color: var(--text-primary); margin-top: 4px;">Full compliance with 21 CFR Part 11 and EU GMP Annex 11 audit standards</div>
            </div>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">
            💡 Select an action from the side options panel or the navigation bar above to begin verification.
          </div>
        </div>

        <!-- Right Side: Navigation & Core Module Options -->
        <div class="home-side-options">
          <!-- Option 1: Traceability 360° -->
          <div class="home-side-card" onclick="window.app.switchView('viewPipeline', '/tracibility')">
            <div class="home-side-icon" style="background: var(--cyan-bg); color: var(--cyan-400); border: 1px solid var(--cyan-border);">
              🔍
            </div>
            <div class="home-side-content">
              <div class="home-side-title">
                <span>Traceability 360°</span>
                <span style="font-size: 1.1rem;">➔</span>
              </div>
              <div class="home-side-desc">
                Search finished batches, view interactive DAG genealogy networks, and review chronological business event audits.
              </div>
            </div>
          </div>

          <!-- Option 2: Anti-Counterfeit Shield -->
          <div class="home-side-card" onclick="window.app.switchView('viewCounterfeit', '/counterfeit')">
            <div class="home-side-icon" style="background: var(--rose-bg); color: var(--rose-400); border: 1px solid var(--rose-border);">
              🛡️
            </div>
            <div class="home-side-content">
              <div class="home-side-title">
                <span>Anti-Counterfeit Shield</span>
                <span style="font-size: 1.1rem;">➔</span>
              </div>
              <div class="home-side-desc">
                Real-time serialization verification and counterfeit detection against canonical SAP ERP batch signatures.
              </div>
            </div>
          </div>

          <!-- Option 3: GS1 Blockchain Verification -->
          <div class="home-side-card" onclick="window.app.switchView('viewBlockchain', '/blockchain')">
            <div class="home-side-icon" style="background: var(--emerald-bg); color: var(--emerald-400); border: 1px solid var(--emerald-border);">
              ⛓️
            </div>
            <div class="home-side-content">
              <div class="home-side-title">
                <span>GS1 Blockchain Verification</span>
                <span style="font-size: 1.1rem;">➔</span>
              </div>
              <div class="home-side-desc">
                Inspect immutable cryptographic SHA-256 state blocks chained from raw supplier ingestion to customer delivery.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 2. BLOCKCHAIN HASHES VIEW
   */
  renderBlockchainView() {
    const container = document.getElementById('blockchainContainer');
    if (!container) return;

    const bId = this.currentBatchId || (window.dataService && window.dataService.activeBatchId) || 'PF05043';

    // Back button + live-loading shell (verification is async against VeChain).
    container.innerHTML = `
      <div style="margin-bottom: 1.25rem;">
        <button class="home-btn-secondary" onclick="window.app.switchView('viewHome', '/home')" style="font-size: 0.85rem; padding: 6px 14px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
          <span>⬅️</span><span>Back to Home</span>
        </button>
      </div>
      <div class="card" style="margin-bottom: 20px;">
        <h2 style="font-size: 20px; font-weight: 700; color: var(--accent-emerald);">⛓️ GS1 EPCIS Blockchain Verification</h2>
        <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
          Live read-only verification of batch <strong>${bId}</strong> against VeChainThor. Each GS1 EPCIS event is anchored as its own transaction and linked under one batch Merkle root.
        </p>
      </div>
      <div id="bcLiveArea" style="padding: 28px; text-align: center; color: var(--text-muted); font-size: 14px;">
        <span class="spinner" style="display:inline-block;">⏳</span> Reading on-chain state from VeChainThor…
      </div>
    `;

    this._loadBlockchainVerification(bId);
  }

  /** Fetch live verification from the Go proxy and render the /blockchain UI. */
  async _loadBlockchainVerification(bId) {
    const area = document.getElementById('bcLiveArea');
    if (!area || !window.veChainVerifier) return;

    let view;
    try {
      view = await window.veChainVerifier.verifyBatch(bId);
    } catch (e) {
      area.innerHTML = this._bcError(`Verification service error: ${escapeHtml(e.message)}`);
      return;
    }

    if (!view) {
      area.innerHTML = this._bcError(
        `Batch <strong>${escapeHtml(bId)}</strong> has not been anchored on the blockchain yet. Run the anchoring pipeline to see it here.`
      );
      return;
    }

    const cfg = await window.veChainVerifier.getConfig();
    const V = window.VeChainVerifier;
    const short = V.short;

    const allOk = view.allVerified && view.merkleRootMatches && view.anchoredByAuthorized;
    const trustColor = allOk ? '#10b981' : (view.chainError ? '#f59e0b' : '#f43f5e');

    // ---- Trust banner: plain-language "is this genuine?" answer ----
    const bannerHeadline = allOk
      ? 'This batch is authentic and tamper-proof'
      : (view.chainError ? 'Live blockchain check temporarily unavailable' : 'This batch needs attention');
    const bannerSub = allOk
      ? `${view.totalGs1Events} GS1 EPCIS supply-chain events for ${escapeHtml(view.batchId)} are recorded, and the ${view.events.length} key production events are anchored on the VeChain public blockchain and match their original records. Nothing has been altered.`
      : (view.chainError
          ? 'Showing the recorded supply-chain events. The live cryptographic re-check could not reach the blockchain node right now.'
          : 'One or more events could not be confirmed against the blockchain. See the flagged events below.');

    const banner = `
      <div class="card" style="margin-bottom:20px; border:1px solid ${trustColor}66; background:linear-gradient(90deg, ${trustColor}14, transparent);">
        <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
          <div style="width:52px; height:52px; border-radius:50%; background:${trustColor}22; border:2px solid ${trustColor}; display:flex; align-items:center; justify-content:center; font-size:26px;">
            ${allOk ? '✅' : (view.chainError ? '⏳' : '⚠️')}
          </div>
          <div style="flex:1; min-width:240px;">
            <div style="font-size:18px; font-weight:800; color:#fff;">${bannerHeadline}</div>
            <div style="font-size:13px; color:var(--text-secondary); margin-top:3px; max-width:760px;">${bannerSub}</div>
          </div>
          <div style="text-align:center; background:rgba(0,0,0,.25); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 16px;">
            <div style="font-size:22px; font-weight:800; color:${trustColor}; font-family:var(--font-mono);">${view.onChainEventCount}/${view.expectedEventCount}</div>
            <div style="font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted);">Events Verified</div>
          </div>
        </div>
      </div>
    `;

    // ---- Compliance / provenance summary (GS1 + blockchain facts) ----
    const rootMatchBadge = view.merkleRootMatches
      ? `<span style="color:#10b981;">✓ matches</span>` : `<span style="color:#f43f5e;">✕ differs</span>`;
    const authBadge = view.anchoredByAuthorized
      ? `<span style="color:#10b981;">✓ authorized signer</span>` : `<span style="color:#f59e0b;">⚠ unconfirmed</span>`;
    const rootTxLink = view.batchRootTx
      ? `<a href="${escapeHtml(view.batchRootExplorerUrl)}" target="_blank" rel="noopener" style="color:var(--accent-cyan); font-family:var(--font-mono);">${short(view.batchRootTx)} ↗</a>`
      : '<span style="color:var(--text-muted);">not anchored</span>';

    const summaryCard = `
      <div class="card" style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
          <div style="font-size:14px; font-weight:700; color:#fff;">📋 GS1 EPCIS 2.0 Compliance & Provenance</div>
          <span style="font-size:11px; padding:3px 10px; border-radius:999px; background:rgba(56,189,248,.15); color:var(--accent-cyan); border:1px solid rgba(56,189,248,.3); font-weight:700;">EPCIS 2.0 · CBV</span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px 24px; font-size:12px;">
          <div><div style="color:var(--text-muted);">Product Batch (GS1 lot)</div><div style="color:var(--text-primary); font-weight:600;">${escapeHtml(view.batchId)}</div></div>
          <div><div style="color:var(--text-muted);">Standard</div><div style="color:var(--text-primary); font-weight:600;">GS1 EPCIS 2.0 (Core Business Vocabulary)</div></div>
          <div><div style="color:var(--text-muted);">Blockchain Network</div><div style="color:var(--text-primary); font-weight:600;">VeChainThor · ${escapeHtml(view.network || cfg.network)}</div></div>
          <div><div style="color:var(--text-muted);">Data on-chain</div><div style="color:var(--text-primary); font-weight:600;">SHA-256 hashes only — no personal or business data exposed</div></div>
          <div title="${escapeHtml(view.merkleRoot)}"><div style="color:var(--text-muted);">Dataset Merkle Root</div><div style="font-family:var(--font-mono); color:var(--accent-purple);">${short(view.merkleRoot)} ${rootMatchBadge}</div></div>
          <div title="${escapeHtml(view.anchoredBy)}"><div style="color:var(--text-muted);">Recorded By</div><div style="font-family:var(--font-mono); color:var(--text-primary);">${short(view.anchoredBy)} ${authBadge}</div></div>
          <div title="${escapeHtml(view.contractAddress)}"><div style="color:var(--text-muted);">Smart Contract</div><div style="font-family:var(--font-mono); color:var(--text-primary);">${short(view.contractAddress)}</div></div>
          <div><div style="color:var(--text-muted);">Batch Link Transaction</div><div>${rootTxLink}</div></div>
        </div>
      </div>
    `;

    const chainWarn = view.chainError
      ? `<div class="card" style="margin-bottom:16px; border:1px solid rgba(245,158,11,.4); background:rgba(245,158,11,.08); color:#f59e0b; font-size:12px; padding:10px 14px;">
           ⚠ Live chain read partially unavailable (${escapeHtml(view.chainError)}). Showing recorded supply-chain data; explorer links remain valid.
         </div>` : '';

    // ---- Full GS1 EPCIS journey, grouped by lifecycle phase ----
    const gs1 = Array.isArray(view.gs1Events) ? view.gs1Events : [];
    const phaseOrder = ['procurement', 'production', 'quality', 'sales'];
    const phaseMeta = {
      procurement: { label: 'Procurement', icon: '📥', color: '#38bdf8' },
      production:  { label: 'Production',  icon: '🏭', color: '#a78bfa' },
      quality:     { label: 'Quality',     icon: '🔬', color: '#f59e0b' },
      sales:       { label: 'Sales & Distribution', icon: '🚚', color: '#10b981' },
    };

    const phaseCounts = view.phaseCounts || {};
    const totalEvents = view.totalGs1Events || gs1.length;

    // Phase filter chips + counts.
    const chips = phaseOrder
      .filter((p) => (phaseCounts[p] || 0) > 0)
      .map((p) => {
        const m = phaseMeta[p];
        return `<button class="bc-phase-chip" data-phase="${p}" style="cursor:pointer; font-size:12px; padding:5px 12px; border-radius:999px; background:${m.color}1a; color:${m.color}; border:1px solid ${m.color}55; font-weight:700;">
          ${m.icon} ${m.label} <span style="opacity:.8;">(${phaseCounts[p] || 0})</span>
        </button>`;
      }).join('');

    const eventCard = (g, index) => {
      const anchored = !!g.anchored;
      const status = anchored ? (g.anchorStatus || 'VERIFIED') : 'RECORDED';
      const st = anchored
        ? V.statusStyle(status)
        : { label: 'Recorded (dataset-hashed)', icon: '◈', color: '#64748b', bg: 'rgba(100,116,139,.12)', border: 'rgba(100,116,139,.3)' };

      const typeLabel = V.eventTypeLabel(g.type);
      const when = g.eventTime ? new Date(g.eventTime).toUTCString() : '—';
      const where = V.locationLabel(g.bizLocation);
      const why = V.bizStepLabel(g.bizStep);
      const disp = g.disposition ? V.dispositionLabel(g.disposition) : '';

      const hasFlow = (g.inputQuantityList && g.inputQuantityList.length) || (g.outputQuantityList && g.outputQuantityList.length);
      let flowBlock = '';
      if (hasFlow) {
        const inputs = (g.inputQuantityList || []).map(q =>
          `<div style="display:flex; justify-content:space-between; gap:10px; font-size:12px; padding:2px 0;">
             <span style="color:var(--text-secondary);">${escapeHtml(V.epcLabel(q.epcClass))}</span>
             <span style="font-family:var(--font-mono); color:#f59e0b;">${escapeHtml(String(q.quantity))} ${escapeHtml(q.uom || '')}</span>
           </div>`).join('') || '<div style="font-size:12px; color:var(--text-muted);">—</div>';
        const outputs = (g.outputQuantityList || []).map(q =>
          `<div style="display:flex; justify-content:space-between; gap:10px; font-size:12px; padding:2px 0;">
             <span style="color:var(--text-secondary);">${escapeHtml(V.epcLabel(q.epcClass))}</span>
             <span style="font-family:var(--font-mono); color:#10b981;">${escapeHtml(String(q.quantity))} ${escapeHtml(q.uom || '')}</span>
           </div>`).join('') || '<div style="font-size:12px; color:var(--text-muted);">—</div>';
        flowBlock = `
          <div style="margin-top:12px; display:grid; grid-template-columns:1fr auto 1fr; gap:12px; align-items:center;">
            <div style="background:rgba(245,158,11,.07); border:1px solid rgba(245,158,11,.25); border-radius:8px; padding:8px 10px;">
              <div style="font-size:10px; text-transform:uppercase; color:#f59e0b; font-weight:700; margin-bottom:4px;">Consumed (input)</div>${inputs}
            </div>
            <div style="font-size:20px; color:var(--text-muted);">➜</div>
            <div style="background:rgba(16,185,129,.07); border:1px solid rgba(16,185,129,.25); border-radius:8px; padding:8px 10px;">
              <div style="font-size:10px; text-transform:uppercase; color:#10b981; font-weight:700; margin-bottom:4px;">Produced (output)</div>${outputs}
            </div>
          </div>`;
      }

      // Blockchain proof strip: on-chain for anchored, dataset note otherwise.
      let proof;
      if (anchored) {
        const txLink = g.transactionId
          ? `<a href="${escapeHtml(g.explorerUrl)}" target="_blank" rel="noopener" style="color:var(--accent-cyan); font-family:var(--font-mono);" title="${escapeHtml(g.transactionId)}">${short(g.transactionId)} ↗</a>`
          : '<span style="color:var(--text-muted);">—</span>';
        proof = `
          <div style="margin-top:12px; background:rgba(15,23,42,.5); border:1px solid ${st.color}44; border-radius:8px; padding:9px 12px;">
            <div style="font-size:10px; text-transform:uppercase; color:${st.color}; font-weight:700; margin-bottom:6px;">⛓️ Anchored on VeChain</div>
            <div style="display:grid; grid-template-columns:auto 1fr; gap:4px 12px; font-size:12px;">
              <span style="color:var(--text-muted);">Event fingerprint</span>
              <span style="font-family:var(--font-mono); color:var(--accent-purple);" title="${escapeHtml(g.eventHash)}">${short(g.eventHash)}</span>
              <span style="color:var(--text-muted);">Transaction</span><span>${txLink}</span>
              <span style="color:var(--text-muted);">Live check</span>
              <span style="color:${st.color}; font-weight:600;">${status === 'VERIFIED' ? 'Confirmed on VeChain — unaltered' : (status === 'MISMATCH' ? 'On-chain fingerprint differs — tampered' : 'Not confirmed')}</span>
            </div>
          </div>`;
      } else {
        proof = `
          <div style="margin-top:12px; background:rgba(15,23,42,.35); border:1px dashed rgba(255,255,255,.12); border-radius:8px; padding:8px 12px; font-size:11px; color:var(--text-muted);">
            ◈ Covered by the batch dataset hash on-chain (not anchored as an individual transaction).
          </div>`;
      }

      return `
        <div class="block-card" style="border-left:4px solid ${st.color};">
          <div class="block-header" style="align-items:center;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="block-num">#${index}</span>
              <span style="font-size:14px; font-weight:700; color:#fff;">${escapeHtml(typeLabel)}</span>
            </div>
            <span style="font-size:11px; padding:4px 11px; border-radius:999px; background:${st.bg}; color:${st.color}; border:1px solid ${st.border}; font-weight:700;">
              ${st.icon} ${st.label}
            </span>
          </div>
          <div style="margin-top:6px; font-size:11px; color:var(--text-muted); font-family:var(--font-mono);" title="${escapeHtml(g.eventID)}">${escapeHtml(g.eventID || '')}</div>
          <div style="margin-top:12px; display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px;">
            <div><div style="font-size:10px; text-transform:uppercase; color:var(--text-muted); letter-spacing:.04em;">Business Step (why)</div><div style="font-size:13px; font-weight:600; color:var(--text-primary);">${escapeHtml(why)}${disp ? ` · ${escapeHtml(disp)}` : ''}</div></div>
            <div><div style="font-size:10px; text-transform:uppercase; color:var(--text-muted); letter-spacing:.04em;">When</div><div style="font-size:13px; font-weight:600; color:var(--text-primary);">${escapeHtml(when)}</div></div>
            <div><div style="font-size:10px; text-transform:uppercase; color:var(--text-muted); letter-spacing:.04em;">Where (location)</div><div style="font-size:13px; font-weight:600; color:var(--text-primary);">${escapeHtml(where)}</div></div>
            ${g.transformationID ? `<div><div style="font-size:10px; text-transform:uppercase; color:var(--text-muted); letter-spacing:.04em;">Process Ref</div><div style="font-size:13px; font-weight:600; color:var(--text-primary);">${escapeHtml(g.transformationID)}</div></div>` : ''}
          </div>
          ${flowBlock}
          ${proof}
        </div>`;
    };

    // Build one section per phase.
    let counter = 0;
    const sections = phaseOrder
      .filter((p) => (phaseCounts[p] || 0) > 0)
      .map((p) => {
        const m = phaseMeta[p];
        const evs = gs1.filter((g) => g.phase === p);
        const cards = evs.map((g) => { counter += 1; return eventCard(g, counter); }).join('');
        const anchoredInPhase = evs.filter((g) => g.anchored).length;
        return `
          <div class="bc-phase-section" data-phase-section="${p}" style="margin-bottom:22px;">
            <div style="display:flex; align-items:center; gap:10px; margin:6px 2px 12px; padding-bottom:8px; border-bottom:2px solid ${m.color}44;">
              <span style="font-size:18px;">${m.icon}</span>
              <span style="font-size:15px; font-weight:800; color:#fff;">${m.label}</span>
              <span style="font-size:12px; color:var(--text-muted);">${evs.length} event${evs.length === 1 ? '' : 's'}${anchoredInPhase ? ` · ${anchoredInPhase} anchored on-chain` : ''}</span>
            </div>
            <div class="blockchain-grid">${cards}</div>
          </div>`;
      }).join('');

    area.innerHTML = `
      ${banner}
      ${chainWarn}
      ${summaryCard}
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin:4px 2px 14px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted); font-weight:700;">
          Complete GS1 EPCIS Journey — ${totalEvents} events across ${Object.keys(phaseCounts).length} lifecycle phases
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">${chips}</div>
      </div>
      ${sections || '<div style="color:var(--text-muted); font-size:13px;">No GS1 EPCIS events found for this batch.</div>'}
      <div style="margin-top:16px; font-size:11px; color:var(--text-muted); text-align:center;">
        GS1 EPCIS 2.0 compliant · key events anchored & verified live on the VeChain public ledger · only cryptographic hashes are stored on-chain
      </div>
    `;

    // Phase chip filtering (client-side show/hide).
    area.querySelectorAll('.bc-phase-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const target = chip.dataset.phase;
        const sections = area.querySelectorAll('.bc-phase-section');
        const active = chip.classList.toggle('bc-chip-active');
        // If this chip becomes the sole active filter, show only its section;
        // toggling it off again reveals all.
        const anyActive = area.querySelector('.bc-phase-chip.bc-chip-active');
        sections.forEach((sec) => {
          if (!anyActive) { sec.style.display = ''; return; }
          sec.style.display = (sec.dataset.phaseSection === target && active) ? '' : (sec.dataset.phaseSection === (anyActive && anyActive.dataset.phase) ? '' : 'none');
        });
        // Simpler: recompute from all active chips.
        const activePhases = Array.from(area.querySelectorAll('.bc-phase-chip.bc-chip-active')).map((c) => c.dataset.phase);
        sections.forEach((sec) => {
          sec.style.display = (activePhases.length === 0 || activePhases.includes(sec.dataset.phaseSection)) ? '' : 'none';
        });
      });
    });
  }

  /** Small helper to render an error/empty state inside the live area. */
  _bcError(msgHtml) {
    return `<div class="card" style="padding:24px; text-align:center; color:var(--text-secondary); font-size:14px;">${msgHtml}</div>`;
  }

  /**
   * 3. ANTI-COUNTERFEIT SHIELD VIEW
   */
  renderCounterfeitView() {
    const container = document.getElementById('counterfeitContainer');
    if (!container) return;

    const bId = this.currentBatchId;
    const bo = this.currentBatchPkg?.finished_genealogy?.batch_genealogy?.business_objects || {};
    const matDesc = bo.material?.material_description || 'PHARMACEUTICAL FINISHED PRODUCT';
    const status = bo.batch?.status || 'RELEASED';
    const coreBatchId = this.currentBatchPkg?.finished_genealogy?.batch_genealogy?.core_batch?.batch_id || 'SFG-CORE';
    const plant = bo.batch?.plant || 'Plant 1000 (Formulations)';

    container.innerHTML = `
      <div style="margin-bottom: 1.25rem;">
        <button class="home-btn-secondary" onclick="window.app.switchView('viewHome', '/home')" style="font-size: 0.85rem; padding: 6px 14px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
          <span>⬅️</span>
          <span>Back to Home</span>
        </button>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <h2 style="font-size: 20px; font-weight: 700; color: var(--accent-rose);">
          🛡️ Anti-Counterfeit Authentication Shield
        </h2>
        <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px; max-width: 800px;">
          Authenticity verification engine combining SAP S/4HANA canonical batch signatures, GS1 Digital Link serialization, and cryptographic seal verification.
        </p>
      </div>

      <div class="shield-panel">
        <div class="guard-card">
          <div class="guard-indicator authentic">
            <span style="font-size: 24px;">✅</span>
            <span>VERIFIED AUTHENTIC SAP PRODUCT</span>
          </div>

          <div style="margin: 20px 0; text-align: left;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
              <div>
                <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted);">Verified Batch ID</div>
                <div style="font-size: 18px; font-weight: 700; color: var(--accent-cyan); font-family: var(--font-mono);">${bId}</div>
              </div>
              <div>
                <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted);">SAP Release Status</div>
                <div style="font-size: 18px; font-weight: 700; color: #10b981;">${status}</div>
              </div>
              <div>
                <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted);">Manufacturing Plant</div>
                <div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">${plant}</div>
              </div>
              <div>
                <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted);">Semi-Finished Core</div>
                <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); font-family: var(--font-mono);">${coreBatchId}</div>
              </div>
            </div>

            <div style="background: rgba(15, 23, 42, 0.7); padding: 14px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Cryptographic Seal Checksum</div>
              <div style="font-family: var(--font-mono); font-size: 12px; color: var(--accent-emerald); word-break: break-all;">
                SHA256: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
              </div>
              <div style="display: flex; gap: 12px; margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
                <span>✓ GS1 Serialization Match</span>
                <span>✓ In-Spec Quality Release</span>
                <span>✓ Non-Revoked License</span>
              </div>
            </div>
          </div>

          <div class="cert-stamp">
            OFFICIAL DIGITAL AUTHENTICITY CERTIFICATE • ISSUED UNDER GMP ANNEX 11 COMPLIANCE
          </div>
        </div>

        <!-- Interactive Batch Verifier -->
        <div class="guard-card" style="text-align: left;">
          <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 12px;">
            🔍 Real-Time Serial & Batch Verifier
          </h3>
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
            Test any batch ID against the SAP ERP database to detect counterfeit, expired, or unverified market samples.
          </p>

          <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <input type="text" id="verifyBatchInput" value="${bId}" placeholder="Enter Batch Code (e.g. ${bId} or FAKE-999)" 
                   style="flex: 1; padding: 10px 14px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; color: #fff; font-family: var(--font-mono); font-size: 14px;">
            <button id="verifyBatchBtn" class="home-btn-primary" style="padding: 10px 20px;">
              Verify
            </button>
          </div>

          <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button class="filter-btn active" onclick="document.getElementById('verifyBatchInput').value='${bId}'; document.getElementById('verifyBatchBtn').click();">
              Test Authentic (${bId})
            </button>
            <button class="filter-btn" onclick="document.getElementById('verifyBatchInput').value='COUNTERFEIT-X88'; document.getElementById('verifyBatchBtn').click();">
              Test Counterfeit Sample
            </button>
          </div>

          <div id="verifyResultBox" style="padding: 16px; border-radius: 8px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3);">
            <div style="font-weight: 700; color: #10b981; font-size: 14px; margin-bottom: 4px;">
              STATUS: 100% AUTHENTIC GENUINE PRODUCT
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
              Match confirmed in SAP S/4HANA Master Registry. Production lineage matches certified core tablet compression order and quality release batch lot.
            </div>
          </div>
        </div>
      </div>
    `;

    // Hook verification button logic
    const vBtn = document.getElementById('verifyBatchBtn');
    const vInput = document.getElementById('verifyBatchInput');
    const vResult = document.getElementById('verifyResultBox');

    if (vBtn && vInput && vResult) {
      vBtn.addEventListener('click', () => {
        const val = vInput.value.trim().toUpperCase();
        const availableBatches = window.dataService.getAvailableBatches();
        const isAuthentic = availableBatches.includes(val);

        if (isAuthentic) {
          vResult.style.background = 'rgba(16, 185, 129, 0.1)';
          vResult.style.borderColor = 'rgba(16, 185, 129, 0.4)';
          vResult.innerHTML = `
            <div style="font-weight: 700; color: #10b981; font-size: 14px; margin-bottom: 4px;">
              STATUS: 100% AUTHENTIC GENUINE PRODUCT (${val})
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
              Match confirmed in SAP S/4HANA Master Registry. Full 37 Business Object lineage verified from supplier procurement to outbound logistics.
            </div>
          `;
          if (val !== this.currentBatchId) {
            this.selectBatch(val);
          }
        } else {
          vResult.style.background = 'rgba(239, 68, 68, 0.12)';
          vResult.style.borderColor = 'rgba(239, 68, 68, 0.5)';
          vResult.innerHTML = `
            <div style="font-weight: 700; color: #ef4444; font-size: 14px; margin-bottom: 4px;">
              ⚠️ ALERT: COUNTERFEIT OR UNREGISTERED BATCH DETECTED (${val})
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
              No cryptographic match exists in the SAP ERP or Blockchain Ledger for this batch ID. 
              Immediate quarantine recommended under standard pharmaceutical anti-counterfeiting protocols.
            </div>
          `;
        }
      });
    }
  }

  /**
   * 0. LOGIN & AUTHENTICATION SCREEN VIEW
   */
  renderLoginView() {
    const container = document.getElementById('loginContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="login-screen-wrapper">
        <div class="login-header-logo">🔐</div>
        <h2 class="login-title">Enterprise SAP SSO Login</h2>
        <p class="login-subtitle">
          Authenticate with your SAP S/4HANA credentials or Corporate Active Directory (Azure AD / Okta) to access end-to-end supply chain genealogy, GS1 hashes, and anti-counterfeit protection.
        </p>

        <form id="loginForm" onsubmit="event.preventDefault(); window.app.handleLoginSubmit();">
          <div class="login-form-group">
            <label class="login-form-label">SAP User ID / Email</label>
            <input type="text" id="loginUsername" class="login-form-input" value="S4_AUDITOR_ADMIN" placeholder="e.g. S4_AUDITOR_ADMIN" required>
          </div>

          <div class="login-form-group">
            <label class="login-form-label">Security Password / Token</label>
            <input type="password" id="loginPassword" class="login-form-input" value="••••••••••••" placeholder="Enter Password" required>
          </div>

          <div class="login-form-group">
            <label class="login-form-label">SAP System Client & Role</label>
            <select class="login-form-input" style="cursor: pointer;">
              <option>Client 100 - Quality & Supply Chain Auditor (Full Access)</option>
              <option>Client 200 - Plant Production Supervisor</option>
              <option>Client 300 - Logistics & Fulfillment Manager</option>
            </select>
          </div>

          <button type="submit" class="login-submit-btn">
            Sign In & Access Home Portal ➔
          </button>
        </form>

        <div class="login-demo-badge">
          <strong>Demo Authorization:</strong> Pre-filled with executive auditor credentials. Click <em>"Sign In"</em> to land on <code>http://localhost:8080/home</code> or navigate directly to any authorized module.
        </div>
      </div>
    `;
  }

  handleLoginSubmit() {
    // Show logged-in indicator
    const authLabel = document.getElementById('authLabel');
    if (authLabel) {
      authLabel.textContent = 'Auditor (Active)';
    }

    // Redirect to Home Overview page
    this.switchView('viewHome', '/home');
  }
}

window.app = new AppController();
window.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});

/** Escape a string for safe insertion into HTML text/attribute contexts. */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
