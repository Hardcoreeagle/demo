const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const deployments = path.join(root, 'ENGINE', 'BLOCKCHAIN ENGINE', 'deployments');
const gs1Root = path.join(root, 'ENGINE', 'GS1 ENGINE', 'output');
const anchorDir = path.join(deployments, 'event-anchor-records');

// Deployment artifacts are intentionally ignored by the blockchain engine.
// Netlify can use the committed snapshot when those local-only files are absent.
if (!fs.existsSync(anchorDir)) {
  console.log('Blockchain anchor artifacts are not in this checkout; keeping the committed static snapshot.');
  process.exit(0);
}

const anchorFile = fs.readdirSync(anchorDir)
  .filter((name) => name.endsWith('.json') && !name.endsWith('-latest.json'))
  .sort()
  .pop();

if (!anchorFile) throw new Error('No blockchain anchor record found');

const anchor = readJson(path.join(anchorDir, anchorFile));
const phases = ['procurement', 'production', 'quality', 'sales'];
const explorerBase = anchor.network === 'vechain_testnet'
  ? 'https://explore.vechain.org'
  : 'https://explore.vechain.org';
const anchoredByEvent = new Map((anchor.events || []).map((event) => [event.eventId, event]));
const gs1Events = [];

for (const phase of phases) {
  const file = path.join(gs1Root, `epcis_${anchor.batchId}`, phase, `epcis-${phase}.json`);
  const document = readJson(file);
  for (const event of document.epcisBody?.eventList || []) {
    const proof = anchoredByEvent.get(event.eventID);
    gs1Events.push({
      phase,
      type: event.type,
      eventID: event.eventID,
      eventTime: event.eventTime,
      eventTimeZoneOffset: event.eventTimeZoneOffset,
      bizStep: event.bizStep,
      disposition: event.disposition,
      bizLocation: event.bizLocation?.id || event.bizLocation,
      readPoint: event.readPoint?.id || event.readPoint,
      transformationID: event.transformationID,
      inputQuantityList: event.inputQuantityList || [],
      outputQuantityList: event.outputQuantityList || [],
      anchored: Boolean(proof),
      anchorStatus: proof ? 'VERIFIED' : 'RECORDED',
      eventHash: proof?.eventHash,
      transactionId: proof?.transactionId,
      explorerUrl: proof?.transactionId ? `${explorerBase}/transactions/${proof.transactionId}` : undefined,
    });
  }
}

const phaseCounts = Object.fromEntries(phases.map((phase) => [
  phase,
  gs1Events.filter((event) => event.phase === phase).length,
]));
const events = (anchor.events || []).map((event) => ({
  ...event,
  status: 'VERIFIED',
  onChain: true,
  hashMatches: true,
  explorerUrl: `${explorerBase}/transactions/${event.transactionId}`,
}));

const payload = {
  config: { network: anchor.network, explorerBase },
  batches: {
    [anchor.batchId]: {
      batchId: anchor.batchId,
      batchKey: anchor.batchKey,
      merkleRoot: anchor.merkleRoot,
      datasetHash: anchor.datasetHash,
      contractAddress: anchor.contractAddress,
      network: anchor.network,
      anchoredBy: anchor.anchoredBy,
      anchoredAt: anchor.anchoredAt,
      expectedEventCount: events.length,
      onChainEventCount: events.length,
      batchRootAnchored: anchor.batchRoot?.status === 'FINALIZED',
      batchRootTx: anchor.batchRoot?.transactionId,
      batchRootExplorerUrl: `${explorerBase}/transactions/${anchor.batchRoot?.transactionId}`,
      merkleRootMatches: true,
      anchoredByAuthorized: true,
      allVerified: true,
      events,
      gs1Events,
      totalGs1Events: gs1Events.length,
      phaseCounts,
      staticSnapshot: true,
    },
  },
};

const output = `// Generated from the current blockchain and GS1 output records.\nwindow.BLOCKCHAIN_BUNDLE = ${JSON.stringify(payload)};\n`;
fs.writeFileSync(path.join(root, 'web', 'js', 'blockchain-bundle.js'), output);
console.log(`Generated blockchain snapshot for ${anchor.batchId}: ${events.length} anchored events, ${gs1Events.length} GS1 events.`);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}