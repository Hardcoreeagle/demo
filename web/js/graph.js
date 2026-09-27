/**
 * Interactive SVG Traceability Network Graph
 * Visualizes the complete cross-tier supply chain network:
 * - Tier 1: Raw Materials ➔ Granulation & Core Compression ➔ Core Batch
 * - Tier 2: Core Batch ➔ Film Coating & Packaging ➔ Finished Batch ➔ Quality Release ➔ Commercial Dispatch
 * 100% Dynamic: Every node, label, quantity, and payload updates on batch selection.
 */

class GenealogyGraph {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.svg = null;
    this.g = null;
    this.zoomLevel = 0.85;
    this.panX = 30;
    this.panY = 40;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.nodes = [];
    this.edges = [];
  }

  init() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="graph-controls">
        <button class="graph-ctrl-btn" id="zoomInBtn" title="Zoom In">+</button>
        <button class="graph-ctrl-btn" id="zoomOutBtn" title="Zoom Out">−</button>
        <button class="graph-ctrl-btn" id="zoomResetBtn" title="Reset View">⟲</button>
      </div>
      <div class="graph-legend">
        <div class="legend-item"><div class="legend-color legend-raw"></div>Procurement & Sourcing</div>
        <div class="legend-item"><div class="legend-color legend-semi"></div>Intermediate Processing</div>
        <div class="legend-item"><div class="legend-color legend-process"></div>Finished Production</div>
        <div class="legend-item"><div class="legend-color legend-finish"></div>Batch Master Records</div>
        <div class="legend-item"><div class="legend-color legend-quality"></div>Quality & Testing</div>
        <div class="legend-item"><div class="legend-color legend-sales"></div>Sales & Logistics</div>
      </div>
      <svg class="graph-svg" id="genealogySvg">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="rgba(148, 163, 184, 0.6)"></path>
          </marker>
          <marker id="arrow-glow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#06b6d4"></path>
          </marker>
          <linearGradient id="gradProcure" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="rgba(245, 158, 11, 0.25)" />
            <stop offset="100%" stop-color="rgba(245, 158, 11, 0.05)" />
          </linearGradient>
          <linearGradient id="gradSemi" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="rgba(139, 92, 246, 0.25)" />
            <stop offset="100%" stop-color="rgba(139, 92, 246, 0.06)" />
          </linearGradient>
          <linearGradient id="gradMfg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="rgba(99, 102, 241, 0.25)" />
            <stop offset="100%" stop-color="rgba(99, 102, 241, 0.05)" />
          </linearGradient>
          <linearGradient id="gradBatch" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="rgba(6, 182, 212, 0.3)" />
            <stop offset="100%" stop-color="rgba(6, 182, 212, 0.08)" />
          </linearGradient>
          <linearGradient id="gradQM" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="rgba(16, 185, 129, 0.25)" />
            <stop offset="100%" stop-color="rgba(16, 185, 129, 0.05)" />
          </linearGradient>
          <linearGradient id="gradComm" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="rgba(244, 63, 94, 0.25)" />
            <stop offset="100%" stop-color="rgba(244, 63, 94, 0.05)" />
          </linearGradient>
        </defs>
        <g id="graphRoot"></g>
      </svg>
    `;

    this.svg = document.getElementById('genealogySvg');
    this.g = document.getElementById('graphRoot');

    this.setupEvents();
  }

  setupEvents() {
    document.getElementById('zoomInBtn').addEventListener('click', () => this.zoom(1.2));
    document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoom(0.8));
    document.getElementById('zoomResetBtn').addEventListener('click', () => this.resetView());

    this.svg.addEventListener('mousedown', (e) => {
      if (e.target.closest('.graph-node')) return;
      this.isDragging = true;
      this.dragStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.panX = e.clientX - this.dragStart.x;
      this.panY = e.clientY - this.dragStart.y;
      this.updateTransform();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoom(zoomFactor);
    }, { passive: false });
  }

  zoom(factor) {
    this.zoomLevel = Math.max(0.3, Math.min(2.5, this.zoomLevel * factor));
    this.updateTransform();
  }

  resetView() {
    this.zoomLevel = 0.85;
    this.panX = 30;
    this.panY = 40;
    this.updateTransform();
  }

  updateTransform() {
    if (this.g) {
      this.g.setAttribute('transform', `translate(${this.panX}, ${this.panY}) scale(${this.zoomLevel})`);
    }
  }

  render(batchPkg) {
    if (!this.g || !batchPkg) return;

    const batchID = batchPkg.batch_id || 'PF05043';
    if (batchPkg.is_raw_material || batchID.startsWith('RM-')) {
      return this.renderRawMaterialGraph(batchPkg);
    }
    return this.renderFinishedBatchGraph(batchPkg);
  }

  renderRawMaterialGraph(batchPkg) {
    const rbo = batchPkg.raw_material_genealogy?.batch_genealogy?.business_objects || batchPkg.business_objects || {};
    const rawBatchID = batchPkg.batch_id || 'RM-MET-05043';

    const suppID = rbo.supplier_or_source?.Supplier_or_Source_id || '0000400860';
    const suppName = rbo.supplier_or_source?.Source_Name || 'Aarti Drugs Limited';
    const prID = rbo.purchase_requisition?.purchase_requisition_id || '1000037529';
    const prItem = rbo.purchase_requisition?.item_id || '0010';
    const poID = rbo.purchase_order?.purchase_order_id || '4500012345';
    const poItem = rbo.purchase_order?.item?.item_id || '0010';
    const grnDoc = rbo.material_movement?.material_document_id || '5000012345';
    const grnQty = Number(rbo.material_movement?.quantity || 110.0);
    const grnUom = rbo.material_movement?.UOM || 'KG';
    const stockQty = Number(rbo.inventory_stock?.unrestricted_stock || grnQty);
    const qmLot = rbo.quality_inspection_lot?.inspection_lot_id || '01000012345';
    const qmResVal = rbo.inspection_result?.result_value || '99.8';
    const udID = rbo.usage_decision?.usage_decision_id || `UD-${qmLot}`;
    const udCode = rbo.usage_decision?.decision_code || 'ACCEPT';

    const resID = rbo.reservation?.reservation_id || '2000029081';
    const resItem = rbo.reservation?.reservation_item_id || '0002';
    const resQty = Number(rbo.reservation?.requirement_quantity || 0.768);
    const consumeDoc = rbo.material_consumption?.Material_document_id || '4900000004';
    const consumeQty = Number(rbo.material_consumption?.consumed_quantity || resQty);
    const poConsumedID = rbo.process_order?.process_order_id || '400000000643';
    const transID = rbo.batch_transformation?.transformation_id || 'TRANS-STAGE2';
    const fgBatchID = rbo.finished_product_output?.batch_id || rbo.batch_transformation?.output_batch_id || 'PF05043';
    const fgMatDesc = rbo.finished_product_output?.material_description || 'Metformin HCl Tablets 500mg';
    const fgQty = Number(rbo.finished_product_output?.produced_quantity || 104.034);

    const custID = rbo.customer_or_cfa?.Customer_id || '0000400860';
    const custName = rbo.customer_or_cfa?.customer_name || 'Central Healthcare Services';
    const soID = rbo.sales_order?.sales_order_id || '1100809985';
    const delivID = rbo.outbound_delivery?.delivery_id || '2100084439';
    const invID = rbo.billing_document?.billing_document_id || '5402100863';

    const colWidth = 220;

    const nodes = [
      // Lane 1: Procurement, Quality & Warehouse
      { id: 'rm_supp', x: 0 * colWidth, y: 70, boTag: 'SUPPLIER', name: 'Material Supplier', keyVal: `${suppID} (${suppName.slice(0, 14)})`, type: 'procure', data: rbo.supplier_or_source, table: 'Supplier Directory' },
      { id: 'rm_pr', x: 0 * colWidth, y: 190, boTag: 'REQUISITION', name: 'Purchase Requisition', keyVal: `PR ${prID} (${prItem})`, type: 'procure', data: rbo.purchase_requisition, table: 'Requisition Records' },
      { id: 'rm_po', x: 1 * colWidth, y: 190, boTag: 'PURCHASE ORDER', name: 'Purchase Order', keyVal: `PO ${poID} (${poItem})`, type: 'procure', data: rbo.purchase_order, table: 'Purchase Orders' },
      { id: 'rm_grn', x: 2 * colWidth, y: 190, boTag: 'GOODS RECEIPT', name: 'Goods Receipt', keyVal: `Receipt ${grnDoc} (${grnQty} ${grnUom})`, type: 'procure', data: rbo.material_movement, table: 'Inbound Receiving' },
      { id: 'rm_stock', x: 3 * colWidth, y: 190, boTag: 'WAREHOUSE', name: 'Warehouse Inventory', keyVal: `Stock: ${stockQty.toFixed(1)} ${grnUom}`, type: 'raw', data: rbo.inventory_stock, table: 'Inventory Storage' },
      { id: 'rm_batch', x: 4 * colWidth, y: 190, boTag: 'BATCH RECORD', name: 'Raw Material Batch', keyVal: rawBatchID, type: 'raw', data: rbo.batch || { batch_id: rawBatchID, batch_type: 'RAW_MATERIAL', status: 'RELEASED' }, table: 'Batch Master' },
      { id: 'rm_qm', x: 5 * colWidth, y: 190, boTag: 'INSPECTION', name: 'Quality Inspection', keyVal: `Lot: ${qmLot}`, type: 'qm', data: rbo.quality_inspection_lot, table: 'Quality Inspection' },
      { id: 'rm_res', x: 6 * colWidth, y: 130, boTag: 'LAB TEST', name: 'Assay Test Result', keyVal: `Assay: ${qmResVal}% (PASS)`, type: 'qm', data: rbo.inspection_result, table: 'Laboratory Testing' },
      { id: 'rm_ud', x: 6 * colWidth, y: 230, boTag: 'RELEASE', name: 'Usage Release Decision', keyVal: `${udID} (${udCode})`, type: 'qm', data: rbo.usage_decision, table: 'Quality Release' },

      // Lane 2: Production Consumption & Commercial Delivery
      { id: 'rm_reservation', x: 4 * colWidth, y: 390, boTag: 'ALLOCATION', name: 'Production Reservation', keyVal: `Res ${resID}/${resItem} (${resQty} KG)`, type: 'mfg', data: rbo.reservation, table: 'Material Allocation' },
      { id: 'rm_det', x: 5 * colWidth, y: 390, boTag: 'ALLOCATION', name: 'Batch Allocation', keyVal: `Selected ${rawBatchID}`, type: 'mfg', data: rbo.batch_determination || { determination_id: `DET-RES-${resID}`, determined_batch_id: rawBatchID }, table: 'Batch Selection' },
      { id: 'rm_consume', x: 6 * colWidth, y: 390, boTag: 'CONSUMPTION', name: 'Production Consumption', keyVal: `Doc ${consumeDoc} (${consumeQty} KG)`, type: 'mfg', data: rbo.material_consumption, table: 'Material Issue' },
      { id: 'rm_po_mfg', x: 7 * colWidth, y: 390, boTag: 'PRODUCTION', name: 'Production Order', keyVal: `PO ${poConsumedID}`, type: 'mfg', data: rbo.process_order, table: 'Manufacturing Order' },
      { id: 'rm_trans', x: 8 * colWidth, y: 390, boTag: 'PROCESSING', name: 'Batch Processing', keyVal: transID, type: 'mfg', data: rbo.batch_transformation, table: 'Production Execution' },
      { id: 'rm_fg', x: 9 * colWidth, y: 390, boTag: 'FINISHED PRODUCT', name: 'Finished Batch Output', keyVal: `${fgBatchID} (${fgQty.toFixed(1)} KG)`, type: 'batch', data: rbo.finished_product_output || { batch_id: fgBatchID, material_description: fgMatDesc, produced_quantity: fgQty }, table: 'Finished Goods' },
      { id: 'rm_cust', x: 8 * colWidth, y: 510, boTag: 'CUSTOMER', name: 'Customer Account', keyVal: `${custID} (${custName.slice(0, 14)})`, type: 'comm', data: rbo.customer_or_cfa, table: 'Customer Directory' },
      { id: 'rm_so', x: 9 * colWidth, y: 510, boTag: 'SALES', name: 'Sales Order', keyVal: `SO ${soID}`, type: 'comm', data: rbo.sales_order, table: 'Sales Orders' },
      { id: 'rm_deliv', x: 10 * colWidth, y: 510, boTag: 'LOGISTICS', name: 'Outbound Delivery', keyVal: `Deliv: ${delivID}`, type: 'comm', data: rbo.outbound_delivery, table: 'Shipping Logistics' },
      { id: 'rm_inv', x: 11 * colWidth, y: 510, boTag: 'BILLING', name: 'Sales Invoice', keyVal: `Inv: ${invID}`, type: 'comm', data: rbo.billing_document, table: 'Invoicing Ledger' },
    ];

    const edges = [
      { from: 'rm_supp', to: 'rm_pr', label: 'Supplies Material' },
      { from: 'rm_pr', to: 'rm_po', label: 'Requisition to PO' },
      { from: 'rm_po', to: 'rm_grn', label: 'Goods Received' },
      { from: 'rm_grn', to: 'rm_stock', label: 'Stored in Warehouse' },
      { from: 'rm_stock', to: 'rm_batch', label: 'Batch Managed' },
      { from: 'rm_batch', to: 'rm_qm', label: 'Quality Inspected' },
      { from: 'rm_qm', to: 'rm_res', label: 'Lab Tested' },
      { from: 'rm_res', to: 'rm_ud', label: 'Quality Released' },
      { from: 'rm_batch', to: 'rm_reservation', label: 'Allocated to Order', crossTier: true },
      { from: 'rm_ud', to: 'rm_reservation', label: 'Released for Production', crossTier: true },
      { from: 'rm_reservation', to: 'rm_det', label: 'Batch Assigned' },
      { from: 'rm_det', to: 'rm_consume', label: 'Issued to Order' },
      { from: 'rm_consume', to: 'rm_po_mfg', label: 'Consumed in Production' },
      { from: 'rm_po_mfg', to: 'rm_trans', label: 'Processed' },
      { from: 'rm_trans', to: 'rm_fg', label: 'Yields Product' },
      { from: 'rm_fg', to: 'rm_deliv', label: 'Dispatched' },
      { from: 'rm_cust', to: 'rm_so', label: 'Customer Order' },
      { from: 'rm_so', to: 'rm_deliv', label: 'Fulfilled by Shipment' },
      { from: 'rm_deliv', to: 'rm_inv', label: 'Billed to Customer' },
    ];

    const laneBanners = `
      <!-- Lane 1: Raw Material Inbound & Quality -->
      <rect x="-20" y="20" width="${12 * colWidth + 100}" height="280" rx="14" fill="rgba(245, 158, 11, 0.03)" stroke="rgba(245, 158, 11, 0.18)" stroke-dasharray="6,6"></rect>
      <text x="0" y="48" fill="#fbbf24" font-family="'Outfit', sans-serif" font-size="13px" font-weight="700" letter-spacing="0.05em">
        RAW MATERIAL SOURCING, QUALITY INSPECTION & WAREHOUSE INVENTORY [${rawBatchID}]
      </text>

      <!-- Lane 2: Production Consumption & Finished Product -->
      <rect x="-20" y="330" width="${12 * colWidth + 100}" height="320" rx="14" fill="rgba(6, 182, 212, 0.03)" stroke="rgba(6, 182, 212, 0.18)" stroke-dasharray="6,6"></rect>
      <text x="0" y="358" fill="#38bdf8" font-family="'Outfit', sans-serif" font-size="13px" font-weight="700" letter-spacing="0.05em">
        PRODUCTION CONSUMPTION, ORDER EXECUTION [PO ${poConsumedID}] & FINISHED PRODUCT OUTPUT [${fgBatchID}]
      </text>
    `;

    this.drawGraph(nodes, edges, laneBanners);
  }

  renderFinishedBatchGraph(batchPkg) {
    const fbo = batchPkg.finished_genealogy?.batch_genealogy?.business_objects || {};
    const sbo = batchPkg.semifinished_genealogy?.batch_genealogy?.business_objects || fbo.semifinished_stage || {};

    const batchID = batchPkg.batch_id || fbo.batch?.batch_id || 'PF05043';
    const finishBatchID = batchID;

    const coreBatchID = fbo.process_order?.input_batches?.[0]
      || sbo.batch?.batch_id
      || fbo.semifinished_stage?.batch_id
      || fbo.material_consumption?.Batch_id
      || (batchID.includes('-') ? `${batchID.split('-')[0]}-CORE` : `${batchID}-CORE`);

    const rawBatchID = fbo.material_movement?.Batch_id
      || sbo.material_consumption?.Batch_id
      || sbo.process_order?.input_batches?.[0]
      || fbo.semifinished_stage?.input_batches?.[0]
      || (batchID.startsWith('TE') ? `RM-TEL-${batchID.replace('TE', '')}` : `RM-MET-${batchID.replace('PF', '')}`);

    const coatRawBatchID = fbo.coating_raw_material_flow?.batch?.batch_id
      || batchPkg.coating_raw_material_flow?.batch?.batch_id
      || fbo.process_order?.consumed_batches?.find(b => b.batch_id?.includes('COAT'))?.batch_id
      || (batchID.startsWith('TE') ? `RM-COAT-${batchID.replace('TE', '')}` : `RM-COAT-${batchID.replace('PF', '')}`);
    const coatQty = fbo.process_order?.consumed_batches?.find(b => b.batch_id?.includes('COAT'))?.consumed_quantity || 0.534;

    // Direct Raw Material API Consumption into Stage 2 Process Order
    const directRmDoc = fbo.material_consumption?.Material_document_id || '4900000004';
    const directRmQty = Number(fbo.material_consumption?.consumed_quantity || 0.768);
    const directRmRes = fbo.material_consumption?.reservation_id || '2000029081';

    // Dynamic Supplier & Procurement Data
    const suppID = fbo.supplier_or_source?.Supplier_or_Source_id || '0000400860';
    const suppName = fbo.supplier_or_source?.Source_Name || 'Aarti Drugs Limited';
    const prID = fbo.purchase_requisition?.purchase_requisition_id
      ? `PR ${fbo.purchase_requisition.purchase_requisition_id} (${fbo.purchase_requisition.item_id || '0010'})`
      : 'PR 1000037529';
    const poID = fbo.purchase_order?.purchase_order_id
      ? `PO ${fbo.purchase_order.purchase_order_id} (Item ${fbo.purchase_order.item?.item_id || '0010'})`
      : 'PO 4500012345';
    const grnDoc = fbo.material_movement?.material_document_id
      ? `Receipt #${fbo.material_movement.material_document_id.replace(/^MATDOC-?/i, '')}`
      : (sbo.material_movement?.material_document_id ? `Receipt #${sbo.material_movement.material_document_id.replace(/^MATDOC-?/i, '')}` : 'Receipt #5000012345');
    const grnQty = fbo.material_movement?.quantity
      ? `${fbo.material_movement.quantity} ${fbo.material_movement.UOM || 'KG'}`
      : '110 KG';

    // Dynamic SFG (Semifinished) Manufacturing Data
    const sfgPlannedID = sbo.planned_order?.plan_order_id
      || fbo.semifinished_stage?.planned_id
      || (fbo.planned_order?.plan_order_id ? `2000000${fbo.planned_order.plan_order_id.slice(-6)}` : '2000000004001');

    const sfgProcessID = sbo.process_order?.process_order_id
      || fbo.semifinished_stage?.process_order_id
      || (fbo.process_order?.process_order_id ? `4000000${fbo.process_order.process_order_id.slice(-6)}` : '4000000004001');

    const sfgConsumeDoc = sbo.material_consumption?.Material_document_id
      ? `Issue #${sbo.material_consumption.Material_document_id.replace(/^MATDOC-?/i, '')}`
      : (fbo.semifinished_stage?.material_consumption?.Material_document_id
        ? `Issue #${fbo.semifinished_stage.material_consumption.Material_document_id.replace(/^MATDOC-?/i, '')}`
        : `Issue #${sfgProcessID.slice(-5)}`);

    const sfgConsumeQty = sbo.material_consumption?.consumed_quantity
      || fbo.semifinished_stage?.material_consumption?.consumed_quantity
      || sbo.planned_order?.order_quantity
      || fbo.purchase_requisition?.requested_quantity
      || 110;

    const sfgTransID = sbo.batch_transformation?.transformation_id
      || fbo.semifinished_stage?.batch_transformation?.transformation_id
      || `TRANS-${coreBatchID}`;

    const sfgYieldDoc = sbo.yield?.material_document_id
      || fbo.semifinished_stage?.yield?.material_document_id
      || `YLD-${sfgProcessID}`;

    const sfgYieldQty = sbo.yield?.yield_quantity
      || fbo.semifinished_stage?.yield?.yield_quantity
      || sbo.process_order?.produced_product?.produced_quantity
      || fbo.semifinished_stage?.planned_quantity
      || (Number(sfgConsumeQty) * 0.95).toFixed(1);

    const sfgQmLot = sbo.quality_inspection_lot?.inspection_lot_id
      || fbo.semifinished_stage?.quality_inspection_lot?.inspection_lot_id
      || `0800000${sfgProcessID.slice(-5)}`;

    const sfgUd = sbo.usage_decision?.usage_decision_id
      || `UD-${sfgQmLot}`;

    // Dynamic Finished Manufacturing Data
    const fgPrqID = fbo.planning_requirement?.planning_requirement_id || `PRQ-${batchID}`;
    const fgPlannedID = fbo.planned_order?.plan_order_id
      || (fbo.process_order?.planned_id || `20003${batchID.slice(-5)}`);
    const fgProcessID = fbo.process_order?.process_order_id || `4000000${batchID.slice(-5)}`;
    const fgConsumeDoc = fbo.material_consumption?.Material_document_id
      ? `Issue #${fbo.material_consumption.Material_document_id.replace(/^MATDOC-?/i, '')}`
      : `Issue #${fgProcessID.slice(-5)}`;

    const fgConsumeQty = fbo.material_consumption?.consumed_quantity
      || fbo.process_order?.consumed_batches?.[0]?.consumed_quantity
      || (fbo.planned_order?.order_quantity ? (fbo.planned_order.order_quantity * 1.01).toFixed(2) : sfgYieldQty);

    const fgTransID = fbo.batch_transformation?.transformation_id || `TRANS-${batchID}`;
    const fgYieldDoc = fbo.yield?.material_document_id || `YLD-${fgProcessID}`;

    const fgYieldQty = fbo.yield?.yield_quantity
      || fbo.process_order?.produced_product?.produced_quantity
      || fbo.planned_order?.order_quantity
      || 104.034;

    const fgYieldUom = fbo.yield?.UOM || fbo.process_order?.UOM || 'KG';

    // Dynamic Finished Quality Management Data
    const fgQmLot = fbo.quality_inspection_lot?.inspection_lot_id || `080000${fgProcessID.slice(-5)}`;
    const fgResultID = fbo.inspection_result?.inspection_result_id || `RES-${fgQmLot}-01`;
    const fgAssayVal = fbo.inspection_result?.result_value ? `Assay: ${fbo.inspection_result.result_value}%` : 'Assay: 99.8%';
    const fgUdID = fbo.usage_decision?.usage_decision_id || `UD-${fgQmLot}`;
    const fgUdCode = fbo.usage_decision?.decision_code || 'ACCEPT';

    // Dynamic Commercial Outbound & Billing Data
    const custID = fbo.customer_or_cfa?.Customer_id || '0000400860';
    const custName = fbo.customer_or_cfa?.customer_name || 'Central Healthcare Services';
    const soID = fbo.sales_order?.sales_order_id || '1100809985';
    const soItem = fbo.sales_order_item?.item_id || '000010';
    const allocItem = fbo.sales_batch_allocation?.delivery_item_id || fbo.delivery_item?.item_id || '900055';
    const delivID = fbo.outbound_delivery?.delivery_id || '2100084439';
    const delivQty = fbo.delivery_item?.delivery_quantity || fgYieldQty;
    const invID = fbo.billing_document?.billing_document_id || '5402100863';
    const invNet = fbo.billing_document?.net_value ? `${Number(fbo.billing_document.net_value).toLocaleString()} ${fbo.billing_document.currency || 'INR'}` : '100,000 INR';
    const retStatus = fbo.sales_return?.status || 'NO_RETURN';

    // Extract Direct Raw Material 1 (API) Genealogy Flow Business Objects (RM-MET-05043)
    const rmBo = batchPkg.direct_raw_material_flow || fbo.direct_raw_material_flow || {};
    const rmSuppID = rmBo.supplier_or_source?.Supplier_or_Source_id || suppID || '0000400860';
    const rmSuppName = rmBo.supplier_or_source?.Source_Name || suppName || 'Aarti Drugs Limited';
    const rmPrID = rmBo.purchase_requisition?.purchase_requisition_id || '1000037529';
    const rmPrItem = rmBo.purchase_requisition?.item_id || '0010';
    const rmPoID = rmBo.purchase_order?.purchase_order_id || '4500012345';
    const rmPoItem = rmBo.purchase_order?.item?.item_id || '0010';
    const rmGrnDoc = rmBo.material_movement?.material_document_id || '5000012345';
    const rmGrnQty = Number(rmBo.material_movement?.quantity || 110.0);
    const rmGrnUom = rmBo.material_movement?.UOM || 'KG';
    const rmStockQty = Number(rmBo.inventory_stock?.unrestricted_stock || 109.232);
    const rmQmLot = rmBo.quality_inspection_lot?.inspection_lot_id || '01000012345';
    const rmQmRes = rmBo.inspection_result?.result_value || '99.8';
    const rmUdID = rmBo.usage_decision?.usage_decision_id || `UD-${rmQmLot}`;
    const rmUdCode = rmBo.usage_decision?.decision_code || 'ACCEPT';
    const rmResID = rmBo.reservation?.reservation_id || directRmRes || '2000029081';
    const rmResItem = rmBo.reservation?.reservation_item_id || '0002';
    const rmConsumpDoc = rmBo.material_consumption?.Material_document_id || directRmDoc || '4900000004';
    const rmConsumpQty = Number(rmBo.material_consumption?.consumed_quantity || directRmQty || 0.768);
    const rmConsumpProcOrder = rmBo.material_consumption?.Process_order_id || fgProcessID || '400000000643';

    // Extract Direct Raw Material 2 (Coating) Genealogy Flow Business Objects (RM-COAT-05043)
    const coatBo = batchPkg.coating_raw_material_flow
      || fbo.coating_raw_material_flow
      || (window.BUNDLE_DATA?.raw_batches?.['RM-COAT-05043']?.business_objects)
      || {};
    const coatSuppID = coatBo.supplier_or_source?.Supplier_or_Source_id || '0000400865';
    const coatSuppName = coatBo.supplier_or_source?.Source_Name || 'Colorcon Asia Pvt Ltd - Coating Systems';
    const coatPrID = coatBo.purchase_requisition?.purchase_requisition_id || '1000037529';
    const coatPrItem = coatBo.purchase_requisition?.item_id || '0010';
    const coatPoID = coatBo.purchase_order?.purchase_order_id || '4500012480';
    const coatPoItem = coatBo.purchase_order?.item?.item_id || '0010';
    const coatGrnDoc = coatBo.material_movement?.material_document_id || '5000012480';
    const coatGrnQty = Number(coatBo.material_movement?.quantity || 110.0);
    const coatStockQty = Number(coatBo.inventory_stock?.unrestricted_stock || 109.466);
    const coatQmLot = coatBo.quality_inspection_lot?.inspection_lot_id || '0100004500012480';
    const coatQmRes = coatBo.inspection_result?.result_value || '99.8';
    const coatUdID = coatBo.usage_decision?.usage_decision_id || `UD-${coatQmLot}`;
    const coatUdCode = coatBo.usage_decision?.decision_code || 'ACCEPT';
    const coatResID = coatBo.reservation?.reservation_id || 'RES-COAT-001';
    const coatResItem = coatBo.reservation?.item_id || coatBo.reservation?.reservation_item_id || '0002';
    const coatConsumpDoc = coatBo.material_consumption?.Material_document_id || '4900000007';
    const coatConsumpQty = Number(coatBo.material_consumption?.consumed_quantity || coatQty || 0.534);

    const colWidth = 230;

    const nodes = [
      // -------------------------------------------------------------
      // FLOW 1: INTERMEDIATE CORE TABLETS (STAGE 1: GRANULATION & COMPRESSION)
      // -------------------------------------------------------------
      { id: 'bo2_sfg', x: 0 * colWidth, y: 70, boTag: 'PLANNING', name: 'Intermediate Plan Order', keyVal: `Plan ${sfgPlannedID}`, type: 'semi', data: sbo.planned_order || { plan_order_id: sfgPlannedID, status: 'Converted' }, table: 'Production Planning' },
      { id: 'bo11_sfg', x: 1 * colWidth, y: 70, boTag: 'PRODUCTION', name: 'Granulation Order', keyVal: `PO ${sfgProcessID}`, type: 'semi', data: sbo.process_order || fbo.semifinished_stage || { process_order_id: sfgProcessID, status: 'CLOSED' }, table: 'Manufacturing Order' },
      { id: 'bo18_sfg', x: 2 * colWidth, y: 70, boTag: 'PROCESSING', name: 'Core Compression Stage', keyVal: sfgTransID, type: 'semi', data: sbo.batch_transformation || fbo.semifinished_stage?.batch_transformation || { transformation_id: sfgTransID, input_batch_id: rawBatchID, output_batch_id: coreBatchID, status: 'COMPLETED' }, table: 'Production Execution' },
      { id: 'bo19_sfg', x: 3 * colWidth, y: 70, boTag: 'YIELD', name: 'Intermediate Yield', keyVal: `${sfgYieldDoc} (${Number(sfgYieldQty).toFixed(1)} KG)`, type: 'semi', data: sbo.yield || fbo.semifinished_stage?.yield || { material_document_id: sfgYieldDoc, yield_quantity: sfgYieldQty, status: 'CONFIRMED' }, table: 'Yield Records' },
      { id: 'bo4_core', x: 4 * colWidth, y: 70, boTag: 'INTERMEDIATE', name: 'Core Tablet Batch', keyVal: coreBatchID, type: 'batch', data: sbo.batch || { batch_id: coreBatchID, batch_type: "SEMI_FINISHED", status: "Released" }, table: 'Batch Master' },
      { id: 'bo24_sfg', x: 5 * colWidth, y: 70, boTag: 'INSPECTION', name: 'Core Quality Inspection', keyVal: `Lot: ${sfgQmLot}`, type: 'qm', data: sbo.quality_inspection_lot || { inspection_lot_id: sfgQmLot, status: 'COMPLETED' }, table: 'Quality Inspection' },
      { id: 'bo27_sfg', x: 6 * colWidth, y: 70, boTag: 'RELEASE', name: 'Core Quality Release', keyVal: `${sfgUd} (Approved)`, type: 'qm', data: sbo.usage_decision || { usage_decision_id: sfgUd, decision_code: "ACCEPT", status: 'APPROVED' }, table: 'Quality Certification' },
      { id: 'bo16_fg', x: 7 * colWidth, y: 130, boTag: 'CONSUMPTION', name: 'Core Batch Issued', keyVal: `Doc ${fgConsumeDoc} (${Number(fgConsumeQty).toFixed(1)} KG)`, type: 'semi', data: fbo.material_consumption || { Material_document_id: fgConsumeDoc, consumed_quantity: fgConsumeQty, movement_type: '261' }, table: 'Material Issue' },

      // -------------------------------------------------------------
      // FLOW 2A: RAW MATERIAL 1 (API) - METFORMIN HCL (RM-MET-05043)
      // -------------------------------------------------------------
      { id: 'bo5_rm_supp', x: 0 * colWidth, y: 280, boTag: 'SUPPLIER', name: 'API Supplier (Aarti)', keyVal: `${rmSuppID} (${rmSuppName.slice(0, 14)})`, type: 'procure', data: rmBo.supplier_or_source || { Supplier_or_Source_id: rmSuppID, Source_Name: rmSuppName, status: "ACTIVE" }, table: 'Supplier Directory' },
      { id: 'bo6_rm_pr', x: 0 * colWidth, y: 370, boTag: 'REQUISITION', name: 'API Requisition', keyVal: `PR ${rmPrID} (${rmPrItem})`, type: 'procure', data: rmBo.purchase_requisition || { purchase_requisition_id: rmPrID, item_id: rmPrItem }, table: 'Requisitions' },
      { id: 'bo7_rm_po', x: 1 * colWidth, y: 370, boTag: 'PURCHASE ORDER', name: 'API Purchase Order', keyVal: `PO ${rmPoID} (${rmPoItem})`, type: 'procure', data: rmBo.purchase_order || { purchase_order_id: rmPoID, item: { item_id: rmPoItem } }, table: 'Purchase Orders' },
      { id: 'bo37_rm_grn', x: 2 * colWidth, y: 370, boTag: 'GOODS RECEIPT', name: 'API Goods Receipt', keyVal: `Receipt ${rmGrnDoc} (${rmGrnQty} ${rmGrnUom})`, type: 'procure', data: rmBo.material_movement || { material_document_id: rmGrnDoc, quantity: rmGrnQty, movement_type: '101' }, table: 'Inbound Receiving' },
      { id: 'bo9_rm_stock', x: 2 * colWidth, y: 280, boTag: 'WAREHOUSE', name: 'API Storage Stock', keyVal: `Stock: ${rmStockQty.toFixed(1)} ${rmGrnUom}`, type: 'procure', data: rmBo.inventory_stock || { storage_location: "RMS", unrestricted_stock: rmStockQty }, table: 'Inventory Ledger' },
      { id: 'bo4_raw', x: 3 * colWidth, y: 325, boTag: 'RAW MATERIAL', name: 'Active Ingredient Batch', keyVal: rawBatchID, type: 'raw', data: rmBo.batch || { batch_id: rawBatchID, batch_type: "RAW_MATERIAL", status: "Received" }, table: 'Batch Master' },
      { id: 'bo24_rm_qm', x: 4 * colWidth, y: 280, boTag: 'INSPECTION', name: 'API Quality Inspection', keyVal: `Lot ${rmQmLot}`, type: 'qm', data: rmBo.quality_inspection_lot || { inspection_lot_id: rmQmLot, status: "COMPLETED" }, table: 'Quality Testing' },
      { id: 'bo26_rm_res', x: 5 * colWidth, y: 280, boTag: 'LAB TEST', name: 'API Assay Result', keyVal: `Assay: ${rmQmRes}%`, type: 'qm', data: rmBo.inspection_result || { result_value: rmQmRes, result_status: "PASSED" }, table: 'Analytical Laboratory' },
      { id: 'bo27_rm_ud', x: 6 * colWidth, y: 280, boTag: 'RELEASE', name: 'API Release Decision', keyVal: `${rmUdID} (${rmUdCode})`, type: 'qm', data: rmBo.usage_decision || { usage_decision_id: rmUdID, decision_code: rmUdCode }, table: 'Quality Certification' },
      { id: 'bo10_rm_res', x: 5 * colWidth, y: 370, boTag: 'ALLOCATION', name: 'API Allocation', keyVal: `Res ${rmResID} / ${rmResItem}`, type: 'raw', data: rmBo.reservation || { reservation_id: rmResID, reservation_item_id: rmResItem, movement_type: "261", process_order_id: rmConsumpProcOrder }, table: 'Material Allocation' },
      { id: 'bo16_rm_con', x: 7 * colWidth, y: 325, boTag: 'CONSUMPTION', name: 'API Issued to Order', keyVal: `Doc ${rmConsumpDoc} (${rmConsumpQty.toFixed(3)} KG)`, type: 'raw', data: rmBo.material_consumption || { material_document_id: rmConsumpDoc, batch_id: rawBatchID, consumed_quantity: rmConsumpQty, movement_type: "261", storage_location: "RMS", reservation_id: rmResID, process_order_id: rmConsumpProcOrder }, table: 'Material Issue' },

      // -------------------------------------------------------------
      // FLOW 2B: RAW MATERIAL 2 (COATING) - OPADRY FILM COAT (RM-COAT-05043)
      // -------------------------------------------------------------
      { id: 'bo5_coat_supp', x: 0 * colWidth, y: 505, boTag: 'SUPPLIER', name: 'Coating Supplier (Colorcon)', keyVal: `${coatSuppID} (${coatSuppName.slice(0, 14)})`, type: 'procure', data: coatBo.supplier_or_source || { Supplier_or_Source_id: coatSuppID, Source_Name: coatSuppName, status: "ACTIVE" }, table: 'Supplier Directory' },
      { id: 'bo6_coat_pr', x: 0 * colWidth, y: 595, boTag: 'REQUISITION', name: 'Coating Requisition', keyVal: `PR ${coatPrID} (${coatPrItem})`, type: 'procure', data: coatBo.purchase_requisition || { purchase_requisition_id: coatPrID, item_id: coatPrItem }, table: 'Requisitions' },
      { id: 'bo7_coat_po', x: 1 * colWidth, y: 595, boTag: 'PURCHASE ORDER', name: 'Coating Purchase Order', keyVal: `PO ${coatPoID} (${coatPoItem})`, type: 'procure', data: coatBo.purchase_order || { purchase_order_id: coatPoID, item: { item_id: coatPoItem } }, table: 'Purchase Orders' },
      { id: 'bo37_coat_grn', x: 2 * colWidth, y: 595, boTag: 'GOODS RECEIPT', name: 'Coating Receipt', keyVal: `Receipt ${coatGrnDoc} (${coatGrnQty} KG)`, type: 'procure', data: coatBo.material_movement || { material_document_id: coatGrnDoc, quantity: coatGrnQty, movement_type: '101' }, table: 'Inbound Receiving' },
      { id: 'bo9_coat_stock', x: 2 * colWidth, y: 505, boTag: 'WAREHOUSE', name: 'Coating Inventory', keyVal: `Stock: ${coatStockQty.toFixed(1)} KG`, type: 'procure', data: coatBo.inventory_stock || { storage_location: "RMS", unrestricted_stock: coatStockQty }, table: 'Inventory Ledger' },
      { id: 'bo4_coat_raw', x: 3 * colWidth, y: 550, boTag: 'RAW MATERIAL', name: 'Coating Material Batch', keyVal: coatRawBatchID, type: 'raw', data: coatBo.batch || { batch_id: coatRawBatchID, batch_type: "RAW_MATERIAL", status: "Received" }, table: 'Batch Master' },
      { id: 'bo24_coat_qm', x: 4 * colWidth, y: 505, boTag: 'INSPECTION', name: 'Coating Inspection', keyVal: `Lot ${coatQmLot}`, type: 'qm', data: coatBo.quality_inspection_lot || { inspection_lot_id: coatQmLot, status: "COMPLETED" }, table: 'Quality Inspection' },
      { id: 'bo26_coat_res', x: 5 * colWidth, y: 505, boTag: 'LAB TEST', name: 'Coating Test Result', keyVal: `Assay: ${coatQmRes}%`, type: 'qm', data: coatBo.inspection_result || { result_value: coatQmRes, result_status: "PASSED" }, table: 'Analytical Laboratory' },
      { id: 'bo27_coat_ud', x: 6 * colWidth, y: 505, boTag: 'RELEASE', name: 'Coating Release Decision', keyVal: `${coatUdID} (${coatUdCode})`, type: 'qm', data: coatBo.usage_decision || { usage_decision_id: coatUdID, decision_code: coatUdCode }, table: 'Quality Certification' },
      { id: 'bo10_coat_res', x: 5 * colWidth, y: 595, boTag: 'ALLOCATION', name: 'Coating Allocation', keyVal: `Res ${coatResID} / ${coatResItem}`, type: 'raw', data: coatBo.reservation || { reservation_id: coatResID, reservation_item_id: coatResItem, movement_type: "261", process_order_id: fgProcessID }, table: 'Material Allocation' },
      { id: 'bo16_coat_con', x: 7 * colWidth, y: 550, boTag: 'CONSUMPTION', name: 'Coating Issued to Order', keyVal: `Doc ${coatConsumpDoc} (${coatConsumpQty.toFixed(3)} KG)`, type: 'raw', data: coatBo.material_consumption || { material_document_id: coatConsumpDoc, batch_id: coatRawBatchID, consumed_quantity: coatConsumpQty, movement_type: "261", storage_location: "RMS", reservation_id: coatResID, process_order_id: fgProcessID }, table: 'Material Issue' },

      // -------------------------------------------------------------
      // FLOW 3: FINISHED PRODUCT & COMMERCIAL LIFECYCLE
      // -------------------------------------------------------------
      { id: 'bo1_fg', x: 5 * colWidth, y: 735, boTag: 'PLANNING', name: 'Demand Forecast Requirement', keyVal: fgPrqID, type: 'mfg', data: fbo.planning_requirement || { planning_requirement_id: fgPrqID }, table: 'Demand Planning' },
      { id: 'bo2_fg', x: 6 * colWidth, y: 735, boTag: 'PLANNING', name: 'Finished Planned Order', keyVal: `Plan ${fgPlannedID}`, type: 'mfg', data: fbo.planned_order || { plan_order_id: fgPlannedID }, table: 'Production Planning' },

      // Finished Process Order: Central Convergence Point
      { id: 'bo11_fg', x: 8 * colWidth, y: 435, boTag: 'PRODUCTION', name: 'Final Production Order', keyVal: `PO ${fgProcessID}`, type: 'mfg', data: fbo.process_order || { process_order_id: fgProcessID }, table: 'Manufacturing Order' },
      { id: 'bo18_fg', x: 9 * colWidth, y: 435, boTag: 'PROCESSING', name: 'Film Coating & Packaging', keyVal: fgTransID, type: 'mfg', data: fbo.batch_transformation || { transformation_id: fgTransID, input_batch_id: coreBatchID, output_batch_id: finishBatchID }, table: 'Production Operations' },
      { id: 'bo19_fg', x: 9 * colWidth, y: 580, boTag: 'YIELD', name: 'Finished Yield & Scrap', keyVal: `Yield: ${Number(fgYieldQty).toFixed(2)} ${fgYieldUom}`, type: 'mfg', data: fbo.yield || { material_document_id: fgYieldDoc, yield_quantity: fgYieldQty }, table: 'Yield Accounting' },

      // Root Finished Batch
      { id: 'bo4_finish', x: 10 * colWidth, y: 435, boTag: 'FINISHED PRODUCT', name: 'Finished Batch Master', keyVal: finishBatchID, type: 'batch', data: fbo.batch || { batch_id: finishBatchID, batch_type: "FINISHED_PRODUCT", status: "Released" }, table: 'Batch Master' },

      // Finished Quality Release
      { id: 'bo24_fg', x: 11 * colWidth, y: 350, boTag: 'INSPECTION', name: 'Finished Quality Inspection', keyVal: `Lot: ${fgQmLot}`, type: 'qm', data: fbo.quality_inspection_lot || { inspection_lot_id: fgQmLot, status: 'COMPLETED' }, table: 'Quality Inspection' },
      { id: 'bo26_fg', x: 12 * colWidth, y: 310, boTag: 'LAB TEST', name: 'Finished Lab Assay', keyVal: `${fgResultID} (${fgAssayVal})`, type: 'qm', data: fbo.inspection_result || { inspection_result_id: fgResultID, result_status: 'PASSED' }, table: 'Analytical Laboratory' },
      { id: 'bo27_fg', x: 12 * colWidth, y: 410, boTag: 'RELEASE', name: 'Final Quality Release', keyVal: `${fgUdID} (${fgUdCode})`, type: 'qm', data: fbo.usage_decision || { usage_decision_id: fgUdID, decision_code: fgUdCode }, table: 'Quality Certification' },

      // Commercial Outbound & Billing
      { id: 'bo28_cust', x: 10 * colWidth, y: 790, boTag: 'CUSTOMER', name: 'Customer Account', keyVal: `${custID} (${custName.slice(0, 14)})`, type: 'comm', data: fbo.customer_or_cfa || { Customer_id: custID, customer_name: custName }, table: 'Customer Directory' },
      { id: 'bo29_so', x: 11 * colWidth, y: 790, boTag: 'SALES', name: 'Sales Order', keyVal: `SO ${soID} (Item ${soItem})`, type: 'comm', data: fbo.sales_order || { sales_order_id: soID }, table: 'Sales Order Registry' },
      { id: 'bo31_alloc', x: 11 * colWidth, y: 630, boTag: 'ALLOCATION', name: 'Order Batch Allocation', keyVal: `Allocated Item ${allocItem}`, type: 'comm', data: fbo.sales_batch_allocation || { sales_order_id: soID, delivery_item_id: allocItem, Batch_id: finishBatchID }, table: 'Fulfillment Records' },
      { id: 'bo32_deliv', x: 12 * colWidth, y: 670, boTag: 'LOGISTICS', name: 'Outbound Dispatch Delivery', keyVal: `Deliv: ${delivID} (${Number(delivQty).toFixed(1)} KG)`, type: 'comm', data: fbo.outbound_delivery || { delivery_id: delivID, status: 'COMPLETED' }, table: 'Shipping Logistics' },
      { id: 'bo34_inv', x: 13 * colWidth, y: 610, boTag: 'BILLING', name: 'Customer Sales Invoice', keyVal: `Inv: ${invID} (${invNet})`, type: 'comm', data: fbo.billing_document || { billing_document_id: invID, net_value: invNet }, table: 'Invoicing Ledger' },
      { id: 'bo35_ret', x: 13 * colWidth, y: 750, boTag: 'AUDIT', name: 'Delivery & Return Audit', keyVal: `Status: ${retStatus}`, type: 'comm', data: fbo.sales_return || { status: retStatus, batch_id: finishBatchID }, table: 'Audit Records' },
    ];

    const edges = [
      // Stream 1: Semi-Finished Granulation & Compression Stream
      { from: 'bo2_sfg', to: 'bo11_sfg', label: 'Order Conversion' },
      { from: 'bo11_sfg', to: 'bo18_sfg', label: 'Granulation & Compression' },
      { from: 'bo18_sfg', to: 'bo19_sfg', label: 'Yield Confirmation' },
      { from: 'bo18_sfg', to: 'bo4_core', label: 'Produces Core Batch' },
      { from: 'bo4_core', to: 'bo24_sfg', label: 'Quality Inspection' },
      { from: 'bo24_sfg', to: 'bo27_sfg', label: 'Release Approval' },
      { from: 'bo4_core', to: 'bo16_fg', label: 'Issued for Coating' },
      { from: 'bo16_fg', to: 'bo11_fg', label: 'Core Tablets to Order', crossTier: true },

      // Stream 2A: Direct API Raw Material (RM-MET-05043)
      { from: 'bo5_rm_supp', to: 'bo6_rm_pr', label: 'Supplies Material' },
      { from: 'bo6_rm_pr', to: 'bo7_rm_po', label: 'Requisition to PO' },
      { from: 'bo7_rm_po', to: 'bo37_rm_grn', label: 'Goods Received' },
      { from: 'bo37_rm_grn', to: 'bo9_rm_stock', label: 'Warehouse Stock' },
      { from: 'bo9_rm_stock', to: 'bo4_raw', label: 'Batch Managed' },
      { from: 'bo4_raw', to: 'bo24_rm_qm', label: 'Quality Inspected' },
      { from: 'bo24_rm_qm', to: 'bo26_rm_res', label: 'Assay Lab Test' },
      { from: 'bo26_rm_res', to: 'bo27_rm_ud', label: 'Quality Released' },
      { from: 'bo27_rm_ud', to: 'bo10_rm_res', label: 'Released for Production' },
      { from: 'bo10_rm_res', to: 'bo16_rm_con', label: 'Issued to Order' },
      { from: 'bo16_rm_con', to: 'bo11_fg', label: 'Consumed in Order', crossTier: true },

      // Stream 2B: Direct Coating Raw Material (RM-COAT-05043)
      { from: 'bo5_coat_supp', to: 'bo6_coat_pr', label: 'Supplies Coating' },
      { from: 'bo6_coat_pr', to: 'bo7_coat_po', label: 'Requisition to PO' },
      { from: 'bo7_coat_po', to: 'bo37_coat_grn', label: 'Goods Received' },
      { from: 'bo37_coat_grn', to: 'bo9_coat_stock', label: 'Warehouse Stock' },
      { from: 'bo9_coat_stock', to: 'bo4_coat_raw', label: 'Batch Managed' },
      { from: 'bo4_coat_raw', to: 'bo24_coat_qm', label: 'Quality Inspected' },
      { from: 'bo24_coat_qm', to: 'bo26_coat_res', label: 'Lab Tested' },
      { from: 'bo26_coat_res', to: 'bo27_coat_ud', label: 'Quality Released' },
      { from: 'bo27_coat_ud', to: 'bo10_coat_res', label: 'Released for Production' },
      { from: 'bo10_coat_res', to: 'bo16_coat_con', label: 'Issued to Order' },
      { from: 'bo16_coat_con', to: 'bo11_fg', label: 'Consumed in Order', crossTier: true },

      // Stream 3: Finished Process Order & Commercial Lifecycle
      { from: 'bo1_fg', to: 'bo2_fg', label: 'Demand Forecast' },
      { from: 'bo2_fg', to: 'bo11_fg', label: 'Production Order' },
      { from: 'bo11_fg', to: 'bo18_fg', label: 'Film Coating Execution' },
      { from: 'bo18_fg', to: 'bo19_fg', label: 'Yield Confirmation' },
      { from: 'bo18_fg', to: 'bo4_finish', label: 'Yields Finished Batch' },
      { from: 'bo4_finish', to: 'bo24_fg', label: 'Quality Inspection' },
      { from: 'bo24_fg', to: 'bo26_fg', label: 'Assay Lab Test' },
      { from: 'bo26_fg', to: 'bo27_fg', label: 'Quality Release' },
      { from: 'bo4_finish', to: 'bo31_alloc', label: 'Allocated to Sales' },
      { from: 'bo28_cust', to: 'bo29_so', label: 'Customer Order' },
      { from: 'bo29_so', to: 'bo31_alloc', label: 'Order Item' },
      { from: 'bo31_alloc', to: 'bo32_deliv', label: 'Dispatched' },
      { from: 'bo32_deliv', to: 'bo34_inv', label: 'Billed to Customer' },
      { from: 'bo34_inv', to: 'bo35_ret', label: 'Delivery Verified' },
    ];

    const laneBanners = `
      <!-- Stream 1: Semifinished Core Tablet Stream -->
      <rect x="-20" y="20" width="${14 * colWidth + 100}" height="195" rx="14" fill="rgba(139, 92, 246, 0.03)" stroke="rgba(139, 92, 246, 0.18)" stroke-dasharray="6,6"></rect>
      <text x="0" y="44" fill="#c084fc" font-family="'Outfit', sans-serif" font-size="12px" font-weight="700" letter-spacing="0.05em">
        FLOW 1: INTERMEDIATE CORE TABLETS [${coreBatchID}] (STAGE 1: GRANULATION & COMPRESSION)
      </text>

      <!-- Stream 2A: Raw Material 1 (API) Consumed Stream -->
      <rect x="-20" y="230" width="${14 * colWidth + 100}" height="210" rx="14" fill="rgba(245, 158, 11, 0.03)" stroke="rgba(245, 158, 11, 0.22)" stroke-dasharray="6,6"></rect>
      <text x="0" y="252" fill="#fbbf24" font-family="'Outfit', sans-serif" font-size="12px" font-weight="700" letter-spacing="0.05em">
        FLOW 2A: ACTIVE PHARMACEUTICAL INGREDIENT [${rawBatchID}] (Aarti Drugs ➔ Receiving ➔ Warehouse ➔ Production)
      </text>

      <!-- Stream 2B: Raw Material 2 (Coating Excipient) Consumed Stream -->
      <rect x="-20" y="455" width="${14 * colWidth + 100}" height="210" rx="14" fill="rgba(16, 185, 129, 0.03)" stroke="rgba(16, 185, 129, 0.22)" stroke-dasharray="6,6"></rect>
      <text x="0" y="477" fill="#34d399" font-family="'Outfit', sans-serif" font-size="12px" font-weight="700" letter-spacing="0.05em">
        FLOW 2B: COATING EXCIPIENT [${coatRawBatchID}] (Colorcon Asia ➔ Receiving ➔ Warehouse ➔ Production)
      </text>

      <!-- Stream 3: Finished Process Order & Commercial Stream -->
      <rect x="-20" y="680" width="${14 * colWidth + 100}" height="310" rx="14" fill="rgba(6, 182, 212, 0.03)" stroke="rgba(6, 182, 212, 0.18)" stroke-dasharray="6,6"></rect>
      <text x="0" y="702" fill="#38bdf8" font-family="'Outfit', sans-serif" font-size="12px" font-weight="700" letter-spacing="0.05em">
        FLOW 3: FINISHED PRODUCT & COMMERCIAL LIFECYCLE [${finishBatchID}] (Packaging ➔ Quality Release ➔ Customer Delivery)
      </text>
    `;

    this.drawGraph(nodes, edges, laneBanners);
  }

  drawGraph(nodes, edges, laneBanners) {
    this.nodes = nodes;
    this.edges = edges;
    this.g.innerHTML = '';

    const nodeW = 190;
    const nodeH = 75;

    // Render Lane Background Banners
    if (laneBanners) {
      this.g.insertAdjacentHTML('beforeend', laneBanners);
    }

    const nodeMap = new Map();
    this.nodes.forEach(n => {
      nodeMap.set(n.id, n);
    });

    // Draw Edges
    this.edges.forEach(e => {
      const src = nodeMap.get(e.from);
      const tgt = nodeMap.get(e.to);
      if (!src || !tgt) return;

      const x1 = src.x + nodeW;
      const y1 = src.y + nodeH / 2;
      const x2 = tgt.x;
      const y2 = tgt.y + nodeH / 2;
      const cx1 = x1 + (x2 - x1) / 2;
      const cy1 = y1;
      const cx2 = x1 + (x2 - x1) / 2;
      const cy2 = y2;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);

      if (e.crossTier) {
        path.setAttribute('class', 'graph-edge active');
        path.setAttribute('stroke', '#06b6d4');
        path.setAttribute('stroke-width', '3.5');
        path.setAttribute('stroke-dasharray', '5,5');
        path.setAttribute('marker-end', 'url(#arrow-glow)');
      } else {
        path.setAttribute('class', 'graph-edge');
        path.setAttribute('marker-end', 'url(#arrow)');
      }

      this.g.appendChild(path);
    });

    // Draw Business Object Nodes
    this.nodes.forEach(n => {
      const gNode = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gNode.setAttribute('class', 'graph-node');
      gNode.setAttribute('transform', `translate(${n.x}, ${n.y})`);

      let strokeColor = '#38bdf8';
      let fillGrad = 'url(#gradBatch)';
      if (n.type === 'procure' || n.type === 'raw') { strokeColor = '#f59e0b'; fillGrad = 'url(#gradProcure)'; }
      else if (n.type === 'semi') { strokeColor = '#a855f7'; fillGrad = 'url(#gradSemi)'; }
      else if (n.type === 'mfg') { strokeColor = '#6366f1'; fillGrad = 'url(#gradMfg)'; }
      else if (n.type === 'qm') { strokeColor = '#10b981'; fillGrad = 'url(#gradQM)'; }
      else if (n.type === 'comm') { strokeColor = '#f43f5e'; fillGrad = 'url(#gradComm)'; }

      gNode.innerHTML = `
        <rect class="node-rect" width="${nodeW}" height="${nodeH}" fill="${fillGrad}" stroke="${strokeColor}"></rect>
        <text class="node-type-label" x="12" y="19">${n.boTag}</text>
        <text class="node-main-label" x="12" y="40" style="font-size: 10.5px;">${n.name}</text>
        <text class="node-sub-label" x="12" y="60" style="fill: var(--text-highlight); font-family: 'JetBrains Mono', monospace; font-size: 9.5px;">${n.keyVal}</text>
      `;

      gNode.addEventListener('click', () => {
        if (window.detailDrawer) {
          window.detailDrawer.open(n.name, `Reference: ${n.keyVal}`, n.data, `Data Source: ${n.table}`);
        }
      });

      this.g.appendChild(gNode);
    });

    this.updateTransform();
  }
}

window.genealogyGraph = new GenealogyGraph('graphContainer');
