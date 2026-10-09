/**
 * Minimal XDR writer: just enough to build the ledger keys that
 * `getLedgerEntries` expects. Transactions are never built here.
 */
export class XdrWriter {
  private chunks: Uint8Array[] = [];

  writeInt32(value: number): this {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setInt32(0, value, false);
    this.chunks.push(b);
    return this;
  }

  writeUint32(value: number): this {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, value, false);
    this.chunks.push(b);
    return this;
  }

  /** Fixed-length opaque data, zero-padded to a 4-byte boundary. */
  writeFixedOpaque(bytes: Uint8Array): this {
    const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
    padded.set(bytes);
    this.chunks.push(padded);
    return this;
  }

  toBytes(): Uint8Array {
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of this.chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }
}
