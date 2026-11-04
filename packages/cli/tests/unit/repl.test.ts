import { describe, expect, it } from 'vitest';
import { parseReplLine } from '../../src/commands/dev';

describe('soroscope dev: parseReplLine', () => {
  it('parses a call with named arguments, JSON values and bare text', () => {
    expect(parseReplLine('mint to=me amount=1000')).toEqual({
      kind: 'call',
      fn: 'mint',
      args: { to: 'me', amount: 1000 },
      commit: true,
    });
    expect(parseReplLine('  put key=k val="42"  ')).toEqual({ kind: 'call', fn: 'put', args: { key: 'k', val: '42' }, commit: true });
  });

  it('keeps quoted strings and bracketed JSON together', () => {
    expect(parseReplLine(`set note='two words' list=[1, 2] cfg={"a": [1, {"b": 2}]}`)).toEqual({
      kind: 'call',
      fn: 'set',
      args: { note: 'two words', list: [1, 2], cfg: { a: [1, { b: 2 }] } },
      commit: true,
    });
  });

  it('treats a leading ? as simulate-only', () => {
    expect(parseReplLine('?balance who=me')).toEqual({ kind: 'call', fn: 'balance', args: { who: 'me' }, commit: false });
  });

  it('parses dot commands and empty lines', () => {
    expect(parseReplLine('.advance 10')).toEqual({ kind: 'command', name: 'advance', rest: ['10'] });
    expect(parseReplLine('.gen out.ts')).toEqual({ kind: 'command', name: 'gen', rest: ['out.ts'] });
    expect(parseReplLine('   ')).toEqual({ kind: 'empty' });
  });

  it('rejects malformed input with a reason', () => {
    expect(() => parseReplLine('mint 1000')).toThrow(/name=value/);
    expect(() => parseReplLine('mint to="me')).toThrow(/Unbalanced/);
    expect(() => parseReplLine('9lives')).toThrow(/not a function name/);
  });
});
