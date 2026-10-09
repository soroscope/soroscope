import { describe, expect, it } from 'vitest';
import { status } from '../../src';

describe('scaffold', () => {
  it('says honestly that it is not implemented', () => {
    expect(status).toBe('scaffold');
  });
});
