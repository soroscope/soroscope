/**
 * Minimal XDR (RFC 4506) binary reader — just enough to decode Stellar
 * transaction results and `ScError` values without pulling in the full Stellar
 * SDK.
 *
 * XDR is big-endian and 4-byte aligned: every variable-length field is padded
 * with zero bytes up to the next multiple of four. Enums and signed integers
 * are 32-bit two's-complement; hypers are 64-bit (read as `bigint`).
 *
 * The reader is intentionally read-only and throws `RangeError` on truncated
 * input; callers in `src/decode` translate that into an `XdrDecodeError`.
 */
export class XdrReader {
  private readonly view: DataView;
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  /** Number of unread bytes remaining. */
  get remaining(): number {
    return this.bytes.byteLength - this.offset;
  }

  /** Current read cursor (byte offset from the start). */
  get position(): number {
    return this.offset;
  }

  private ensure(n: number): void {
    if (this.offset + n > this.bytes.byteLength) {
      throw new RangeError(
        `XdrReader: unexpected end of input (need ${n} byte(s) at offset ${this.offset}, have ${this.remaining})`,
      );
    }
  }

  /** Reads a signed 32-bit integer. */
  readInt32(): number {
    this.ensure(4);
    const value = this.view.getInt32(this.offset, false);
    this.offset += 4;
    return value;
  }

  /** Reads an unsigned 32-bit integer. */
  readUint32(): number {
    this.ensure(4);
    const value = this.view.getUint32(this.offset, false);
    this.offset += 4;
    return value;
  }

  /** Reads a signed 64-bit integer (`hyper`) as a bigint. */
  readInt64(): bigint {
    this.ensure(8);
    const value = this.view.getBigInt64(this.offset, false);
    this.offset += 8;
    return value;
  }

  /** Reads an unsigned 64-bit integer (`unsigned hyper`) as a bigint. */
  readUint64(): bigint {
    this.ensure(8);
    const value = this.view.getBigUint64(this.offset, false);
    this.offset += 8;
    return value;
  }

  /**
   * Reads an XDR enum discriminant (a signed 32-bit integer).
   * Identical wire format to {@link readInt32}; named for intent at call sites.
   */
  readEnum(): number {
    return this.readInt32();
  }

  /** Reads an XDR boolean (a 32-bit `0` or `1`). */
  readBool(): boolean {
    const value = this.readUint32();
    if (value !== 0 && value !== 1) {
      throw new RangeError(`XdrReader: invalid boolean discriminant ${value}`);
    }
    return value === 1;
  }

  /** Reads a length-prefix / array count (an unsigned 32-bit integer). */
  readLength(): number {
    return this.readUint32();
  }

  /**
   * Reads `length` raw bytes of fixed-size opaque data, consuming the
   * trailing zero-padding up to the next 4-byte boundary.
   */
  readFixedOpaque(length: number): Uint8Array {
    this.ensure(length);
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    this.skipPadding(length);
    return slice;
  }

  /** Reads variable-length opaque data (a 32-bit length prefix, then bytes + padding). */
  readVarOpaque(): Uint8Array {
    const length = this.readLength();
    return this.readFixedOpaque(length);
  }

  /** Reads a variable-length XDR string as UTF-8. */
  readString(): string {
    const bytes = this.readVarOpaque();
    return new TextDecoder().decode(bytes);
  }

  private skipPadding(length: number): void {
    const padding = (4 - (length % 4)) % 4;
    this.ensure(padding);
    this.offset += padding;
  }
}
