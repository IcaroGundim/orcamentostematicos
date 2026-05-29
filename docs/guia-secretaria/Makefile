.PHONY: pdf clean install-tectonic

MAIN = guia-secretaria
PDFLATEX := $(shell command -v pdflatex 2>/dev/null)
TECTONIC_BIN := $(abspath .bin/tectonic)

pdf: $(MAIN).pdf

$(MAIN).pdf: $(MAIN).tex preamble.tex assets/*
ifneq ($(PDFLATEX),)
	$(PDFLATEX) -interaction=nonstopmode $(MAIN).tex
	$(PDFLATEX) -interaction=nonstopmode $(MAIN).tex
else ifneq ($(wildcard .bin/tectonic),)
	"$(TECTONIC_BIN)" -X compile $(MAIN).tex
else
	$(error pdflatex não encontrado. Instale TeX Live (README) ou rode: make install-tectonic)
endif

install-tectonic:
	mkdir -p .bin
	curl -fsSL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.16.9/tectonic-0.16.9-x86_64-unknown-linux-gnu.tar.gz" \
	  | tar -xz -C .bin
	chmod +x .bin/tectonic
	@echo "Tectonic instalado em .bin/tectonic — rode: make pdf"

clean:
	rm -f $(MAIN).aux $(MAIN).log $(MAIN).out $(MAIN).toc $(MAIN).pdf
