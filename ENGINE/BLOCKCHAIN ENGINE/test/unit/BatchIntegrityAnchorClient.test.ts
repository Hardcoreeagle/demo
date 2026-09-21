import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  VeChainThorAnchorClient,
  AnchorClientError,
} from '../../src/vechain/BatchIntegrityAnchorClient';

/**
 * Adapter unit tests: construction, parameter validation, fee-delegation
 * config. No EPCIS. No Thor node.
 */
describe('VeChainThorAnchorClient - unit', () => {
  const addr = '0x1111111111111111111111111111111111111111';

  async function client(overrides?: Record<string, unknown>) {
    const [signer] = await ethers.getSigners();
    return new VeChainThorAnchorClient({
      rpcUrl: 'http://unused',
      contractAddress: addr,
      signer: signer as unknown as never,
      waitForFinality: false,
      ...overrides,
    });
  }

  it('rejects a non-address contract', async () => {
    const [signer] = await ethers.getSigners();
    expect(
      () =>
        new VeChainThorAnchorClient({
          rpcUrl: 'http://unused',
          contractAddress: 'not-an-address',
          signer: signer as unknown as never,
        })
    ).to.throw(AnchorClientError, /Invalid contract address/);
  });

  it('rejects fee delegation enabled without a sponsor URL', async () => {
    const [signer] = await ethers.getSigners();
    expect(
      () =>
        new VeChainThorAnchorClient({
          rpcUrl: 'http://unused',
          contractAddress: addr,
          signer: signer as unknown as never,
          feeDelegationEnabled: true,
        })
    ).to.throw(AnchorClientError, /FEE_DELEGATION_URL/);
  });

  it('reports VET/VTHO fee-delegation as adapter-level only', async () => {
    const c = await client({
      feeDelegationEnabled: true,
      feeDelegationUrl: 'http://sponsor.local',
    });
    const info = c.getFeeDelegationInfo();
    expect(info.enabled).to.equal(true);
    expect(info.url).to.equal('http://sponsor.local');
    expect(info.model).to.include('sponsored');
  });

  it('rejects malformed batchKey on query', async () => {
    const c = await client();
    await expect(c.getLatestAnchor('0x1234')).to.be.rejectedWith(
      AnchorClientError,
      /batchKey must be a 32-byte hex string/
    );
  });

  it('rejects zero eventCount before any transaction', async () => {
    const c = await client();
    const z = '0x' + '11'.repeat(32);
    await expect(c.anchorBatch(z, z, z, 0n)).to.be.rejectedWith(
      AnchorClientError,
      /eventCount must be > 0/
    );
  });

  it('rejects zero bytes32 commitments before any transaction', async () => {
    const c = await client();
    const z = ethers.ZeroHash;
    const ok = '0x' + '11'.repeat(32);
    await expect(c.anchorBatch(z, ok, ok, 1n)).to.be.rejectedWith(
      AnchorClientError,
      /must be non-zero/
    );
  });
});
