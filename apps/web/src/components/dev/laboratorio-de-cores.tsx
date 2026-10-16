'use client';

/**
 * Laboratório de cores — ferramenta de desenvolvimento.
 *
 * Escreve os quatro tokens da marca direto no `<html>`, então recolore o APP
 * REAL enquanto se navega por ele: não é maquete, é a tela de verdade com a cor
 * proposta. Junto mostra os contrastes que decidem se a cor é usável, para a
 * escolha não depender de alguém lembrar de medir depois.
 *
 * NÃO RENDERIZA EM PRODUÇÃO. O portão é `NEXT_PUBLIC_LAB_CORES`, que o Next
 * injeta em tempo de build: num build normal a comparação vira
 * `undefined === '1'`, constante falsa, e o painel nunca é montado — verificado
 * servindo a página e procurando o botão.
 *
 * O que NÃO é verdade: que o código suma do bundle. O import é estático, então o
 * módulo viaja junto mesmo desligado (o custo ficou dentro do ruído entre
 * builds). Para eliminá-lo de vez, apague o import em `app/layout.tsx` e esta
 * pasta.
 *
 * Para ligar, em qualquer shell:
 *
 *     npm run build:lab && npm start
 *
 * A tela de login não muda de cor, e isso é correto: ela carrega a classe
 * `.marca-anterior`, que redefine os mesmos tokens num escopo mais específico.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { blocoCss, derivarPaleta, type Paleta } from '@/lib/paleta-marca';

const CHAVE = 'lab-cores-hex';
const TOKENS = ['--marca', '--marca-hover', '--marca-escura', '--marca-contraste'] as const;

/** Estilos próprios e fixos: o painel não pode se recolorir junto com o app, ou
 *  ficaria ilegível exatamente quando a cor testada for ruim. */
const cor = {
  fundo: '#1b1d21',
  fundoCampo: '#0f1113',
  texto: '#f2f3f5',
  textoFraco: '#9aa1a9',
  borda: '#34383e',
  ok: '#4ade80',
  falha: '#f87171',
  aviso: '#fbbf24',
};

function aplicarNoDocumento(p: Paleta) {
  const raiz = document.documentElement;
  raiz.style.setProperty('--marca', p.marca.css);
  raiz.style.setProperty('--marca-hover', p.marcaHover.css);
  raiz.style.setProperty('--marca-escura', p.marcaEscura.css);
  raiz.style.setProperty('--marca-contraste', p.marcaContraste.css);
}

function limparDoDocumento() {
  const raiz = document.documentElement;
  for (const t of TOKENS) raiz.style.removeProperty(t);
}

export function LaboratorioDeCores() {
  const [aberto, setAberto] = useState(false);
  const [entrada, setEntrada] = useState('#2e6f40');
  const [copiado, setCopiado] = useState(false);

  const paleta = useMemo(() => derivarPaleta(entrada), [entrada]);

  // Restaura a cor em teste ao navegar entre telas: sem isto, cada clique no menu
  // devolveria a paleta do CSS e a comparação recomeçaria do zero.
  useEffect(() => {
    const salvo = sessionStorage.getItem(CHAVE);
    if (!salvo) return;
    setEntrada(salvo);
    const p = derivarPaleta(salvo);
    if (p) aplicarNoDocumento(p);
  }, []);

  const aplicar = useCallback(() => {
    if (!paleta) return;
    aplicarNoDocumento(paleta);
    sessionStorage.setItem(CHAVE, paleta.marca.hex);
  }, [paleta]);

  const restaurar = useCallback(() => {
    limparDoDocumento();
    sessionStorage.removeItem(CHAVE);
  }, []);

  if (process.env.NEXT_PUBLIC_LAB_CORES !== '1') return null;

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        style={{
          position: 'fixed', right: 16, bottom: 16, zIndex: 9999,
          background: cor.fundo, color: cor.texto, border: `1px solid ${cor.borda}`,
          borderRadius: 8, padding: '8px 14px', font: '600 12px/1 system-ui, sans-serif',
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,.35)',
        }}
      >
        Cores
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', right: 16, bottom: 16, zIndex: 9999, width: 340,
        maxHeight: '85vh', overflowY: 'auto',
        background: cor.fundo, color: cor.texto, border: `1px solid ${cor.borda}`,
        borderRadius: 10, padding: 14,
        font: '400 12px/1.45 system-ui, sans-serif',
        boxShadow: '0 8px 32px rgba(0,0,0,.45)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <strong style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase' }}>
          Laboratório de cores
        </strong>
        <button
          type="button" onClick={() => setAberto(false)} aria-label="Fechar"
          style={{ background: 'none', border: 'none', color: cor.textoFraco, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="#2e6f40"
          spellCheck={false}
          style={{
            flex: 1, background: cor.fundoCampo, color: cor.texto,
            border: `1px solid ${paleta ? cor.borda : cor.falha}`, borderRadius: 6,
            padding: '7px 9px', font: '500 13px/1 ui-monospace, monospace',
          }}
        />
        <input
          type="color"
          value={paleta?.marca.hex ?? '#2e6f40'}
          onChange={(e) => setEntrada(e.target.value)}
          aria-label="Selecionar cor"
          style={{ width: 38, height: 32, background: 'none', border: `1px solid ${cor.borda}`, borderRadius: 6, cursor: 'pointer', padding: 2 }}
        />
      </div>

      {!paleta ? (
        <p style={{ color: cor.falha, margin: 0 }}>Hex inválido. Use algo como #606078 ou #abc.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {([
              ['marca', paleta.marca],
              ['hover', paleta.marcaHover],
              ['escura', paleta.marcaEscura],
              ['texto', paleta.marcaContraste],
            ] as const).map(([nome, t]) => (
              <div key={nome} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: 34, background: t.hex, border: `1px solid ${cor.borda}`, borderRadius: 5 }} />
                <div style={{ color: cor.textoFraco, fontSize: 10, marginTop: 3 }}>{nome}</div>
                <div style={{ fontSize: 9.5, fontFamily: 'ui-monospace, monospace' }}>{t.hex}</div>
              </div>
            ))}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
            <tbody>
              {paleta.medidas.map((m) => (
                <tr key={m.rotulo}>
                  <td style={{ color: cor.textoFraco, padding: '2px 0' }}>{m.rotulo}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                    {m.valor.toFixed(2)}:1
                  </td>
                  <td style={{ width: 22, textAlign: 'right', color: m.passa ? cor.ok : cor.falha, fontWeight: 700 }}>
                    {m.passa ? '✓' : '✗'}
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ color: cor.textoFraco, padding: '2px 0' }}>separação marca ↔ escura</td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                  {paleta.separacaoL.toFixed(3)}
                </td>
                <td style={{ width: 22, textAlign: 'right', color: paleta.separacaoL >= 0.1 ? cor.ok : cor.falha, fontWeight: 700 }}>
                  {paleta.separacaoL >= 0.1 ? '✓' : '✗'}
                </td>
              </tr>
            </tbody>
          </table>

          {paleta.avisos.map((a) => (
            <p key={a} style={{ color: cor.aviso, margin: '0 0 8px', fontSize: 11.5 }}>{a}</p>
          ))}

          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button type="button" onClick={aplicar} style={botao(true)}>Aplicar</button>
            <button type="button" onClick={restaurar} style={botao(false)}>Restaurar</button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(blocoCss(paleta));
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1500);
              }}
              style={botao(false)}
            >
              {copiado ? 'Copiado' : 'Copiar CSS'}
            </button>
          </div>

          <pre
            style={{
              background: cor.fundoCampo, border: `1px solid ${cor.borda}`, borderRadius: 6,
              padding: 8, margin: 0, overflowX: 'auto',
              font: '400 10.5px/1.5 ui-monospace, monospace', color: cor.textoFraco,
            }}
          >
            {blocoCss(paleta)}
          </pre>

          <p style={{ color: cor.textoFraco, fontSize: 10.5, margin: '8px 0 0' }}>
            A tela de login não muda: ela fixa o verde anterior pela classe
            <code style={{ color: cor.texto }}> .marca-anterior</code>.
          </p>
        </>
      )}
    </div>
  );
}

function botao(primario: boolean): React.CSSProperties {
  return {
    flex: 1,
    background: primario ? '#2f6f4f' : 'transparent',
    color: cor.texto,
    border: `1px solid ${primario ? '#2f6f4f' : cor.borda}`,
    borderRadius: 6,
    padding: '6px 0',
    font: '600 11.5px/1 system-ui, sans-serif',
    cursor: 'pointer',
  };
}
