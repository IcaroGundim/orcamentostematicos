import { describe, expect, it } from 'vitest';
import { escapeCsvCell } from './export-utils';

describe('escapeCsvCell', () => {
  it.each(['=1+1', '+SUM(1)', '-cmd', '@SUM(1)', '\t=1+1', '  =1+1'])(
    'neutraliza texto que uma planilha poderia executar: %s',
    (value) => expect(escapeCsvCell(value)).toBe(`'${value}`),
  );

  it('preserva números e o escape de delimitadores', () => {
    expect(escapeCsvCell(-42)).toBe('-42');
    expect(escapeCsvCell('texto; "citado"')).toBe('"texto; ""citado"""');
    expect(escapeCsvCell('=1;2')).toBe('"\'=1;2"');
  });
});
