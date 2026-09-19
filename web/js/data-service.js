/**
 * SAP Traceability 360° - Data Service Layer
 * Supports seamless dual-mode:
 * 1. HTTP Server Mode (fetches directly from /output/ endpoints or Go API)
 * 2. Standalone File Mode (uses window.BUNDLE_DATA from data-bundle.js)
 */

class DataService {
  constructor() {
    this.isHttp = window.location.protocol.startsWith('http');
    this.bundle = window.BUNDLE_DATA || null;
    this.cache = new Map();
    this.activeBatchId = 'PF05043'; // Default primary batch
  }

  async init() {
    console.log(`[DataService] Initializing. Mode: ${this.isHttp ? 'HTTP Server' : 'Standalone Bundled'}`);
    return true;
  }

  getAvailableBatches() {
    if (this.bundle && this.bundle.finished_batches) {
      return Object.keys(this.bundle.finished_batches);
    }
    return ['PF05043'];
  }

  getAvailableRawBatches() {
    if (this.bundle && this.bundle.raw_batches) {
      return Object.keys(this.bundle.raw_batches);
    }
    return ['RM-MET-05043', 'RM-COAT-05043'];
  }

  async getRawMaterialGenealogyPackage(batchId) {
    const key = `raw_batch_pkg_${batchId}`;
    if (this.cache.has(key)) return this.cache.get(key);

    if (this.isHttp) {
      try {
        const [rmGen, bo, evts, rels, res] = await Promise.all([
          fetch(`/output/raw_material_genealogy/${batchId}/raw_material_genealogy.json`).then(r => r.ok ? r.json() : null),
          fetch(`/output/raw_material_genealogy/${batchId}/business_objects.json`).then(r => r.ok ? r.json() : null),
          fetch(`/output/raw_material_genealogy/${batchId}/events.json`).then(r => r.ok ? r.json() : null),
          fetch(`/output/raw_material_genealogy/${batchId}/relationships.json`).then(r => r.ok ? r.json() : null),
          fetch(`/output/raw_material_genealogy/${batchId}/resolution.json`).then(r => r.ok ? r.json() : null),
        ]);

        if (rmGen) {
          const pkg = {
            batch_id: batchId,
            is_raw_material: true,
            finished_genealogy: rmGen,
            raw_material_genealogy: rmGen,
            business_objects: bo || rmGen.batch_genealogy?.business_objects,
            events: evts,
            relationships: rels,
            resolution: res,
          };
          this.cache.set(key, pkg);
          return pkg;
        }
      } catch (e) {
        console.warn(`[DataService] HTTP fetch failed for raw batch ${batchId}, falling back to bundle:`, e);
      }
    }

    if (this.bundle && this.bundle.raw_batches && this.bundle.raw_batches[batchId]) {
      const bPkg = this.bundle.raw_batches[batchId];
      const pkg = {
        batch_id: batchId,
        is_raw_material: true,
        finished_genealogy: bPkg.raw_material_genealogy,
        raw_material_genealogy: bPkg.raw_material_genealogy,
        business_objects: bPkg.business_objects,
        events: bPkg.events,
        relationships: bPkg.relationships,
        resolution: bPkg.resolution,
      };
      this.cache.set(key, pkg);
      return pkg;
    }

    throw new Error(`Data not available for raw material batch ${batchId}`);
  }

  async getBatchGenealogyPackage(batchId) {
    if (batchId && batchId.startsWith('RM-')) {
      return this.getRawMaterialGenealogyPackage(batchId);
    }

    const key = `batch_pkg_${batchId}`;
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Try HTTP fetch if online
    if (this.isHttp) {
      try {
        const [fg, sfg, sbg, evts, rels, res] = await Promise.all([
          fetch(`/output/finished_batch_genealogy/${batchId}/finished_batch_genealogy.json`).then(r => r.ok ? r.json() : null),
          fetch(`/output/finished_batch_genealogy/${batchId}/semifinished_batch_genealogy.json`).then(r => r.ok ? r.json() : null),
          fetch(`/output/finished_batch_genealogy/${batchId}/sub_batches_genealogy.json`).then(r => r.ok ? r.json() : null),
          fetch(`/output/finished_batch_genealogy/${batchId}/events.json`).then(r => r.ok ? r.json() : null),
          fetch(`/output/finished_batch_genealogy/${batchId}/relationships.json`).then(r => r.ok ? r.json() : null),
          fetch(`/output/finished_batch_genealogy/${batchId}/resolution.json`).then(r => r.ok ? r.json() : null),
        ]);

        if (fg) {
          const pkg = {
            batch_id: batchId,
            finished_genealogy: fg,
            semifinished_genealogy: sfg,
            direct_raw_material_flow: fg.batch_genealogy?.business_objects?.direct_raw_material_flow,
            coating_raw_material_flow: fg.batch_genealogy?.business_objects?.coating_raw_material_flow,
            sub_batches_genealogy: sbg,
            events: evts,
            relationships: rels,
            resolution: res,
          };
          this.cache.set(key, pkg);
          return pkg;
        }
      } catch (e) {
        console.warn(`[DataService] HTTP fetch failed for ${batchId}, falling back to bundle:`, e);
      }
    }

    // Bundled fallback
    if (this.bundle && this.bundle.finished_batches && this.bundle.finished_batches[batchId]) {
      const pkg = this.bundle.finished_batches[batchId];
      this.cache.set(key, pkg);
      return pkg;
    }

    throw new Error(`Data not available for batch ${batchId}`);
  }

  async getRelationshipCatalog() {
    if (this.cache.has('catalog')) return this.cache.get('catalog');

    if (this.isHttp) {
      try {
        const res = await fetch('/output/relationship_catalog.json');
        if (res.ok) {
          const cat = await res.json();
          this.cache.set('catalog', cat);
          return cat;
        }
      } catch (e) {}
    }

    if (this.bundle && this.bundle.relationship_catalog) {
      this.cache.set('catalog', this.bundle.relationship_catalog);
      return this.bundle.relationship_catalog;
    }

    return [];
  }

  async getAllBusinessEvents() {
    if (this.cache.has('all_events')) return this.cache.get('all_events');

    if (this.isHttp) {
      try {
        const res = await fetch('/output/business_events.json');
        if (res.ok) {
          const evts = await res.json();
          this.cache.set('all_events', evts);
          return evts;
        }
      } catch (e) {}
    }

    if (this.bundle && this.bundle.business_events) {
      this.cache.set('all_events', this.bundle.business_events);
      return this.bundle.business_events;
    }

    return [];
  }

  async getBusinessObjectsManifest() {
    if (this.bundle && this.bundle.business_objects_list) {
      return this.bundle.business_objects_list;
    }

    return [
      { index: "01", name: "01_planning_requirement.json", filename: "01_planning_requirement.json", record_count: 12 },
      { index: "02", name: "02_planned_order.json", filename: "02_planned_order.json", record_count: 21 },
      { index: "03", name: "03_material.json", filename: "03_material.json", record_count: 12 },
      { index: "04", name: "04_batch.json", filename: "04_batch.json", record_count: 59 },
      { index: "05", name: "05_supplier_or_source.json", filename: "05_supplier_or_source.json", record_count: 10 },
      { index: "06", name: "06_purchase_requisition.json", filename: "06_purchase_requisition.json", record_count: 10 },
      { index: "07", name: "07_purchase_order.json", filename: "07_purchase_order.json", record_count: 10 },
      { index: "08", name: "08_material_movement.json", filename: "08_material_movement.json", record_count: 10 },
      { index: "09", name: "09_inventory_stock.json", filename: "09_inventory_stock.json", record_count: 10 },
      { index: "10", name: "10_reservation.json", filename: "10_reservation.json", record_count: 10 },
      { index: "11", name: "11_process_order.json", filename: "11_process_order.json", record_count: 21 },
      { index: "12", name: "12_bom.json", filename: "12_bom.json", record_count: 11 },
      { index: "13", name: "13_recipe.json", filename: "13_recipe.json", record_count: 11 },
      { index: "14", name: "14_production_version.json", filename: "14_production_version.json", record_count: 10 },
      { index: "15", name: "15_batch_determination.json", filename: "15_batch_determination.json", record_count: 10 },
      { index: "16", name: "16_material_consumption.json", filename: "16_material_consumption.json", record_count: 10 },
      { index: "17", name: "17_production_confirmation.json", filename: "17_production_confirmation.json", record_count: 11 },
      { index: "18", name: "18_batch_transformation.json", filename: "18_batch_transformation.json", record_count: 11 },
      { index: "19", name: "19_yield.json", filename: "19_yield.json", record_count: 21 },
      { index: "21", name: "21_inspection_characteristic.json", filename: "21_inspection_characteristic.json", record_count: 10 },
      { index: "22", name: "22_inspection_plan.json", filename: "22_inspection_plan.json", record_count: 10 },
      { index: "23", name: "23_inspection_parameter.json", filename: "23_inspection_parameter.json", record_count: 10 },
      { index: "24", name: "24_quality_inspection_lot.json", filename: "24_quality_inspection_lot.json", record_count: 11 },
      { index: "25", name: "25_sampling.json", filename: "25_sampling.json", record_count: 10 },
      { index: "26", name: "26_inspection_result.json", filename: "26_inspection_result.json", record_count: 12 },
      { index: "27", name: "27_usage_decision.json", filename: "27_usage_decision.json", record_count: 11 },
      { index: "28", name: "28_customer_or_cfa.json", filename: "28_customer_or_cfa.json", record_count: 10 },
      { index: "29", name: "29_sales_order.json", filename: "29_sales_order.json", record_count: 10 },
      { index: "30", name: "30_sales_order_item.json", filename: "30_sales_order_item.json", record_count: 10 },
      { index: "31", name: "31_sales_batch_allocation.json", filename: "31_sales_batch_allocation.json", record_count: 10 },
      { index: "32", name: "32_outbound_delivery.json", filename: "32_outbound_delivery.json", record_count: 10 },
      { index: "33", name: "33_delivery_item.json", filename: "33_delivery_item.json", record_count: 10 },
      { index: "34", name: "34_billing_document.json", filename: "34_billing_document.json", record_count: 10 },
      { index: "35", name: "35_sales_return.json", filename: "35_sales_return.json", record_count: 10 },
      { index: "36", name: "36_work_centre.json", filename: "36_work_centre.json", record_count: 10 },
      { index: "37", name: "37_goods_receipt_grn.json", filename: "37_goods_receipt_grn.json", record_count: 10 }
    ];
  }
}

window.dataService = new DataService();
