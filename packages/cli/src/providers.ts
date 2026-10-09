import { publicProviderUrls } from '@soroscope/core';
import type { NetworkId } from '@soroscope/core';
import { CliError, ExitCode } from './exit';

export interface ProviderSelection {
  network: NetworkId | 'custom';
  urls: string[];
}

export interface GlobalOptions {
  network?: string;
  rpc?: string[];
}

function parseNetwork(value: string): NetworkId {
  if (value === 'testnet' || value === 'mainnet') return value;
  throw new CliError(
    `Unknown network "${value}". Use testnet or mainnet, or pass --rpc <url> for another network.`,
    ExitCode.Usage,
  );
}

function validateUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('scheme');
    return raw;
  } catch {
    throw new CliError(`"${raw}" is not a valid http(s) URL.`, ExitCode.Usage);
  }
}

/**
 * Decide which providers a command talks to: `--rpc` flags win, then
 * `SOROSCOPE_RPC_URLS` (comma separated), then the verified public providers
 * for `--network` (or `SOROSCOPE_NETWORK`, default testnet).
 */
export function resolveProviders(
  options: GlobalOptions,
  env: NodeJS.ProcessEnv = process.env,
): ProviderSelection {
  const explicit = options.rpc !== undefined && options.rpc.length > 0 ? options.rpc : undefined;
  const fromEnv =
    env['SOROSCOPE_RPC_URLS'] === undefined || env['SOROSCOPE_RPC_URLS'] === ''
      ? undefined
      : env['SOROSCOPE_RPC_URLS'].split(',').map((s) => s.trim()).filter(Boolean);
  const urls = explicit ?? fromEnv;

  if (urls !== undefined) {
    return { network: 'custom', urls: urls.map(validateUrl) };
  }
  const network = parseNetwork(options.network ?? env['SOROSCOPE_NETWORK'] ?? 'testnet');
  return { network, urls: publicProviderUrls(network) };
}
