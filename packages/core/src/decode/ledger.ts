import { toHex } from '../xdr/strkey';
import type { XdrReader } from '../xdr/reader';
import { XdrUnsupportedError, decodeWith } from './primitives';
import { formatScVal, readAccountId, readScAddress, readScVal } from './scval';
import type { ScAddress, ScVal } from './scval';

/** A classic asset (as used by trustlines and contract id preimages). */
export type Asset =
  | { type: 'native' }
  | { type: 'credit'; code: string; issuer: string }
  | { type: 'poolShare'; poolId: string };

export type ContractDataDurability = 'temporary' | 'persistent';

/** `LedgerKey`: identifies one ledger entry. */
export type LedgerKey =
  | { type: 'account'; accountId: string }
  | { type: 'trustline'; accountId: string; asset: Asset }
  | { type: 'offer'; sellerId: string; offerId: bigint }
  | { type: 'data'; accountId: string; dataName: string }
  | { type: 'claimableBalance'; balanceId: string }
  | { type: 'liquidityPool'; poolId: string }
  | { type: 'contractData'; contract: ScAddress; key: ScVal; durability: ContractDataDurability }
  | { type: 'contractCode'; hash: string }
  | { type: 'configSetting'; configSettingId: number }
  | { type: 'ttl'; keyHash: string };

/** Entry types, in `LedgerEntryType` order. */
const ENTRY = {
  ACCOUNT: 0,
  TRUSTLINE: 1,
  OFFER: 2,
  DATA: 3,
  CLAIMABLE_BALANCE: 4,
  LIQUIDITY_POOL: 5,
  CONTRACT_DATA: 6,
  CONTRACT_CODE: 7,
  CONFIG_SETTING: 8,
  TTL: 9,
} as const;

const ascii = new TextDecoder('utf-8');

function readAssetCode(reader: XdrReader, length: 4 | 12): string {
  const bytes = reader.readFixedOpaque(length);
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end -= 1;
  return ascii.decode(bytes.subarray(0, end));
}

/** `Asset` (native or alphanumeric credit). */
export function readAsset(reader: XdrReader): Asset {
  const type = reader.readEnum();
  switch (type) {
    case 0:
      return { type: 'native' };
    case 1:
      return { type: 'credit', code: readAssetCode(reader, 4), issuer: readAccountId(reader) };
    case 2:
      return { type: 'credit', code: readAssetCode(reader, 12), issuer: readAccountId(reader) };
    default:
      throw new XdrUnsupportedError(`AssetType(${type})`, reader.position);
  }
}

/** `TrustLineAsset`: an `Asset` or a liquidity pool share. */
function readTrustLineAsset(reader: XdrReader): Asset {
  const type = reader.readEnum();
  switch (type) {
    case 0:
      return { type: 'native' };
    case 1:
      return { type: 'credit', code: readAssetCode(reader, 4), issuer: readAccountId(reader) };
    case 2:
      return { type: 'credit', code: readAssetCode(reader, 12), issuer: readAccountId(reader) };
    case 3:
      return { type: 'poolShare', poolId: toHex(reader.readFixedOpaque(32)) };
    default:
      throw new XdrUnsupportedError(`AssetType(${type})`, reader.position);
  }
}

function readDurability(reader: XdrReader): ContractDataDurability {
  const d = reader.readEnum();
  if (d === 0) return 'temporary';
  if (d === 1) return 'persistent';
  throw new XdrUnsupportedError(`ContractDataDurability(${d})`, reader.position);
}

export function readLedgerKey(reader: XdrReader): LedgerKey {
  const type = reader.readEnum();
  switch (type) {
    case ENTRY.ACCOUNT:
      return { type: 'account', accountId: readAccountId(reader) };
    case ENTRY.TRUSTLINE:
      return { type: 'trustline', accountId: readAccountId(reader), asset: readTrustLineAsset(reader) };
    case ENTRY.OFFER:
      return { type: 'offer', sellerId: readAccountId(reader), offerId: reader.readInt64() };
    case ENTRY.DATA:
      return { type: 'data', accountId: readAccountId(reader), dataName: reader.readString() };
    case ENTRY.CLAIMABLE_BALANCE: {
      const idType = reader.readEnum();
      if (idType !== 0) throw new XdrUnsupportedError(`ClaimableBalanceIDType(${idType})`, reader.position);
      return { type: 'claimableBalance', balanceId: toHex(reader.readFixedOpaque(32)) };
    }
    case ENTRY.LIQUIDITY_POOL:
      return { type: 'liquidityPool', poolId: toHex(reader.readFixedOpaque(32)) };
    case ENTRY.CONTRACT_DATA: {
      const contract = readScAddress(reader);
      const key = readScVal(reader);
      const durability = readDurability(reader);
      return { type: 'contractData', contract, key, durability };
    }
    case ENTRY.CONTRACT_CODE:
      return { type: 'contractCode', hash: toHex(reader.readFixedOpaque(32)) };
    case ENTRY.CONFIG_SETTING:
      return { type: 'configSetting', configSettingId: reader.readEnum() };
    case ENTRY.TTL:
      return { type: 'ttl', keyHash: toHex(reader.readFixedOpaque(32)) };
    default:
      throw new XdrUnsupportedError(`LedgerEntryType(${type})`, reader.position);
  }
}

export function decodeLedgerKey(input: string | Uint8Array): LedgerKey {
  return decodeWith('LedgerKey', input, readLedgerKey);
}

function formatAsset(a: Asset): string {
  switch (a.type) {
    case 'native':
      return 'native';
    case 'credit':
      return `${a.code}:${a.issuer}`;
    case 'poolShare':
      return `pool:${a.poolId}`;
  }
}

/**
 * A stable, human-readable, single-line identity for a ledger key. Two keys
 * are the same entry exactly when their canonical strings are equal, so it is
 * safe to use for sorting, diffing footprints and baselines. `aliases` maps
 * contract ids to short names (for contracts whose id changes per run).
 */
export function canonicalLedgerKey(key: LedgerKey, aliases: Readonly<Record<string, string>> = {}): string {
  switch (key.type) {
    case 'account':
      return `account:${key.accountId}`;
    case 'trustline':
      return `trustline:${key.accountId}:${formatAsset(key.asset)}`;
    case 'offer':
      return `offer:${key.sellerId}:${key.offerId}`;
    case 'data':
      return `data:${key.accountId}:${key.dataName}`;
    case 'claimableBalance':
      return `claimableBalance:${key.balanceId}`;
    case 'liquidityPool':
      return `liquidityPool:${key.poolId}`;
    case 'contractData': {
      const who = aliases[key.contract.address] ?? key.contract.address;
      return `contractData:${key.durability}:${who}:${formatScVal(key.key)}`;
    }
    case 'contractCode':
      return `contractCode:${key.hash}`;
    case 'configSetting':
      return `configSetting:${key.configSettingId}`;
    case 'ttl':
      return `ttl:${key.keyHash}`;
  }
}

// ---- Ledger entry data ------------------------------------------------------

export interface ContractCodeCostInputs {
  nInstructions: number;
  nFunctions: number;
  nGlobals: number;
  nTableEntries: number;
  nTypes: number;
  nDataSegments: number;
  nElemSegments: number;
  nImports: number;
  nExports: number;
  nDataSegmentBytes: number;
}

/** The `data` arm of a `LedgerEntry` for the entry types Soroban cares about. */
export type LedgerEntryData =
  | {
      type: 'contractData';
      contract: ScAddress;
      key: ScVal;
      durability: ContractDataDurability;
      val: ScVal;
    }
  | {
      type: 'contractCode';
      hash: string;
      code: Uint8Array;
      costInputs: ContractCodeCostInputs | null;
    }
  | { type: 'ttl'; keyHash: string; liveUntilLedgerSeq: number };

function readExtensionPoint(reader: XdrReader): void {
  const v = reader.readEnum();
  if (v !== 0) throw new XdrUnsupportedError(`ExtensionPoint(${v})`, reader.position);
}

function readCostInputs(reader: XdrReader): ContractCodeCostInputs {
  readExtensionPoint(reader);
  return {
    nInstructions: reader.readUint32(),
    nFunctions: reader.readUint32(),
    nGlobals: reader.readUint32(),
    nTableEntries: reader.readUint32(),
    nTypes: reader.readUint32(),
    nDataSegments: reader.readUint32(),
    nElemSegments: reader.readUint32(),
    nImports: reader.readUint32(),
    nExports: reader.readUint32(),
    nDataSegmentBytes: reader.readUint32(),
  };
}

const ENTRY_NAMES: Record<number, string> = {
  0: 'account',
  1: 'trustline',
  2: 'offer',
  3: 'data',
  4: 'claimableBalance',
  5: 'liquidityPool',
  8: 'configSetting',
};

/**
 * Read the `data` union of a `LedgerEntry`, as returned in `getLedgerEntries`.
 * Classic entry types (accounts, trustlines, offers…) are not decoded and
 * raise {@link XdrUnsupportedError}.
 */
export function readLedgerEntryData(reader: XdrReader): LedgerEntryData {
  const type = reader.readEnum();
  switch (type) {
    case ENTRY.CONTRACT_DATA: {
      readExtensionPoint(reader);
      const contract = readScAddress(reader);
      const key = readScVal(reader);
      const durability = readDurability(reader);
      const val = readScVal(reader);
      return { type: 'contractData', contract, key, durability, val };
    }
    case ENTRY.CONTRACT_CODE: {
      const extV = reader.readEnum();
      let costInputs: ContractCodeCostInputs | null = null;
      if (extV === 1) {
        readExtensionPoint(reader);
        costInputs = readCostInputs(reader);
      } else if (extV !== 0) {
        throw new XdrUnsupportedError(`ContractCodeEntry.ext(${extV})`, reader.position);
      }
      const hash = toHex(reader.readFixedOpaque(32));
      const code = reader.readVarOpaque();
      return { type: 'contractCode', hash, code, costInputs };
    }
    case ENTRY.TTL:
      return {
        type: 'ttl',
        keyHash: toHex(reader.readFixedOpaque(32)),
        liveUntilLedgerSeq: reader.readUint32(),
      };
    default:
      throw new XdrUnsupportedError(
        `LedgerEntryType(${type}${ENTRY_NAMES[type] === undefined ? '' : `: ${ENTRY_NAMES[type]}`})`,
        reader.position,
      );
  }
}

export function decodeLedgerEntryData(input: string | Uint8Array): LedgerEntryData {
  return decodeWith('LedgerEntryData', input, readLedgerEntryData);
}


