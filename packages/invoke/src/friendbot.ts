/**
 * Friendbot faucet URLs by network passphrase. Not every RPC provider reports a
 * `friendbotUrl` from `getNetwork` (some omit it), so it is not read from there.
 */
const FRIENDBOT: Readonly<Record<string, string>> = {
  'Test SDF Network ; September 2015': 'https://friendbot.stellar.org',
  'Test SDF Future Network ; October 2022': 'https://friendbot-futurenet.stellar.org',
};

/**
 * The friendbot URL for a network, or undefined for networks without one (mainnet).
 */
export function friendbotUrlFor(networkPassphrase: string): string | undefined {
  return FRIENDBOT[networkPassphrase];
}

/**
 * Fund a testnet or futurenet account from the network's friendbot.
 * Friendbot is a faucet for test networks only; it does not exist on mainnet.
 * Transient connection failures are retried; an explicit refusal is not.
 * @throws {Error} If the faucet refuses or stays unreachable.
 */
export async function fundWithFriendbot(
  friendbotUrl: string,
  address: string,
  attempts = 4,
): Promise<void> {
  const url = new URL(friendbotUrl);
  url.searchParams.set('addr', address);
  let lastError: unknown;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
      if (res.ok) return;
      const body = (await res.text()).slice(0, 200);
      // A refusal (bad request, already funded) will not change on retry; a server error might.
      if (res.status < 500) throw new Error(`Friendbot refused to fund ${address}: HTTP ${res.status} ${body}`);
      lastError = new Error(`Friendbot error: HTTP ${res.status} ${body}`);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Friendbot refused')) throw err;
      lastError = err;
    }
    if (i < attempts) await new Promise((r) => setTimeout(r, 3_000 * i));
  }
  throw new Error(
    `Friendbot at ${friendbotUrl} could not be reached after ${attempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
