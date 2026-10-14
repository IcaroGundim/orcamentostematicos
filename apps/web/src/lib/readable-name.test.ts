import { describe, expect, it } from 'vitest';
import { readableName, withoutCode } from './readable-name';

describe('readableName', () => {
  it('passa para caixa normal e leva a sigla do fim para parênteses', () => {
    expect(readableName('SECRETARIA DE ESTADO DE EDUCAÇÃO E ESPORTE - SEE')).toBe(
      'Secretaria de Estado de Educação e Esporte (SEE)',
    );
  });

  it('mantém siglas conhecidas no meio do nome', () => {
    expect(readableName('GESTÃO DA FOLHA DE PAGAMENTO DO FUNDEB')).toBe('Gestão da Folha de Pagamento do FUNDEB');
  });

  it('não rebaixa a primeira palavra mesmo quando é preposição', () => {
    expect(readableName('DE OLHO NA ESCOLA')).toBe('De Olho na Escola');
  });

  it('desfaz a hifenização herdada do QDD', () => {
    expect(readableName('SECRETARIA DE DESENVOLVI - MENTO')).toBe('Secretaria de Desenvolvimento');
  });

  it('não mexe em texto já em caixa mista', () => {
    expect(readableName('Fonte não catalogada')).toBe('Fonte não catalogada');
  });

  it('tolera vazio', () => {
    expect(readableName('')).toBe('');
    expect(readableName(undefined)).toBe('');
  });

  it('tira o código do rótulo agregado', () => {
    expect(withoutCode('20010000 — MANUTENÇÃO')).toBe('MANUTENÇÃO');
    expect(withoutCode('Sem código')).toBe('Sem código');
  });
});

describe('readableName — quebras do cadastro', () => {
  it('junta palavras partidas', () => {
    expect(readableName('SECRETARIA EXTRAORDINÁRIA DE ESPOR- TE E LAZER - SEEL')).toBe(
      'Secretaria Extraordinária de Esporte e Lazer (SEEL)',
    );
    expect(readableName('SECRETARIA DE ESTADO DO MEIO AMBIEN TE SEMA')).toBe(
      'Secretaria de Estado do Meio Ambiente SEMA',
    );
  });
});
