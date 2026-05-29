# Guia da Secretaria — Orçamentos Temáticos

Documento em LaTeX com orientações para os perfis **Representante** (`SECRETARIA_REPRESENTANTE`) e **Revisor interno** (`SECRETARIA_REVISOR`) da plataforma.

## Compilar o PDF

```bash
cd docs/guia-secretaria
make pdf
```

O arquivo gerado será `guia-secretaria.pdf`.

## Se `pdflatex` não estiver instalado

### Opção A — TeX Live (Arch / CachyOS, recomendado)

```bash
sudo pacman -S texlive-basic texlive-latexrecommended texlive-latexextra texlive-pictures texlive-lang
make pdf
```

### Opção B — Tectonic local (sem sudo)

Baixa um compilador LaTeX autocontido em `docs/guia-secretaria/.bin/`:

```bash
cd docs/guia-secretaria
make install-tectonic
make pdf
```

O Makefile usa `pdflatex` quando disponível; caso contrário, usa `.bin/tectonic`.

## Limpar artefatos

```bash
make clean
```

## Estrutura

| Arquivo | Descrição |
|---------|-----------|
| `guia-secretaria.tex` | Conteúdo principal (9 seções) |
| `preamble.tex` | Pacotes e caixas de destaque |
| `assets/` | Logotipos institucionais |
| `Makefile` | Alvos `pdf`, `install-tectonic`, `clean` |

## Sincronização com a plataforma

O conteúdo espelha a página `/secretaria/ajuda` e o código em `apps/web/src/app/secretaria/`. Ao alterar status, classificações ou campos do formulário, atualize este documento e `secretaria-help-content.tsx` em conjunto.
