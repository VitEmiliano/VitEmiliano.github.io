"use strict";

const CAMINHO_INDICE = "./conteudo/index.json";
const DURACAO_VIRADA = 620;

const elementos = {
  livro: document.querySelector("#livro"),
  capa: document.querySelector("#capa"),
  conteudo: document.querySelector("#conteudo-pagina"),
  cabecalhoEsquerdo: document.querySelector("#cabecalho-esquerdo"),
  cabecalhoDireito: document.querySelector("#cabecalho-direito"),
  setaEsquerda: document.querySelector("#seta-esquerda"),
  setaDireita: document.querySelector("#seta-direita"),
  botaoDownload: document.querySelector("#botao-download"),
  tituloAtual: document.querySelector("#titulo-atual"),
  estadoTexto: document.querySelector("#estado-texto"),
  indicadorPagina: document.querySelector("#indicador-pagina"),
  listaEntradas: document.querySelector("#lista-entradas"),
  listaVazia: document.querySelector("#lista-vazia"),
  quantidadeEntradas: document.querySelector("#quantidade-entradas"),
  pesquisa: document.querySelector("#pesquisa-entradas"),
  sumario: document.querySelector("#sumario"),
  botaoMenu: document.querySelector("#botao-menu"),
  botaoFecharSumario: document.querySelector("#sumario-fechar"),
  fundoSumario: document.querySelector("#fundo-sumario"),
  mensagemErro: document.querySelector("#mensagem-erro"),
  mensagemErroTexto: document.querySelector("#mensagem-erro-texto"),
};

const estado = {
  sessoes: [],
  indiceAtual: -1,
  markdownAtual: "",
  carregando: false,
  animando: false,
  cacheMarkdown: new Map(),
};

document.addEventListener("DOMContentLoaded", inicializar);

async function inicializar() {
  registrarEventos();

  try {
    const resposta = await fetch(CAMINHO_INDICE, { cache: "no-store" });

    if (!resposta.ok) {
      throw new Error(
        `O índice respondeu com status ${resposta.status}.`
      );
    }

    const indice = await resposta.json();

    if (!Array.isArray(indice.sessoes)) {
      throw new Error('O arquivo index.json não contém a lista "sessoes".');
    }

    estado.sessoes = indice.sessoes
      .filter(sessaoValida)
      .sort((a, b) =>
        a.data.localeCompare(b.data) ||
        a.titulo.localeCompare(b.titulo, "pt-BR")
      );

    renderizarSumario();

    elementos.quantidadeEntradas.textContent =
      `${estado.sessoes.length} ${estado.sessoes.length === 1 ? "registro" : "registros"}`;

    elementos.estadoTexto.textContent = estado.sessoes.length
      ? "Diário pronto para ser aberto."
      : "Nenhuma entrada foi publicada.";

    atualizarControles();

    const idDaUrl = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    const indiceDaUrl = estado.sessoes.findIndex(
      (sessao) => sessao.id === idDaUrl
    );

    if (indiceDaUrl >= 0) {
      await abrirSessao(indiceDaUrl, "next", true);
    }
  } catch (erro) {
    mostrarErro(
      `${erro.message} Confirme se conteudo/index.json foi publicado junto ao site.`
    );
  }
}

function registrarEventos() {
  elementos.setaDireita.addEventListener("click", avancar);
  elementos.setaEsquerda.addEventListener("click", voltar);
  elementos.capa.addEventListener("click", avancar);
  elementos.botaoDownload.addEventListener("click", baixarMarkdown);
  elementos.pesquisa.addEventListener("input", filtrarSumario);

  elementos.botaoMenu.addEventListener("click", abrirSumarioMobile);
  elementos.botaoFecharSumario.addEventListener("click", fecharSumarioMobile);
  elementos.fundoSumario.addEventListener("click", fecharSumarioMobile);

  document.addEventListener("keydown", (evento) => {
    if (evento.target.matches("input, textarea, select")) {
      return;
    }

    if (evento.key === "ArrowRight") {
      evento.preventDefault();
      avancar();
    } else if (evento.key === "ArrowLeft") {
      evento.preventDefault();
      voltar();
    } else if (evento.key === "Escape") {
      if (elementos.sumario.classList.contains("is-open")) {
        fecharSumarioMobile();
      } else {
        fecharLivro();
      }
    }
  });

  let temporizadorRedimensionamento;

  window.addEventListener("resize", () => {
    clearTimeout(temporizadorRedimensionamento);
    temporizadorRedimensionamento = setTimeout(() => {
      if (estado.indiceAtual >= 0) {
        ajustarDensidadeConteudo();
      }
    }, 140);
  });

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      if (estado.indiceAtual >= 0) {
        ajustarDensidadeConteudo();
      }
    });
  }

  window.addEventListener("hashchange", async () => {
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!id) {
      return;
    }

    const indice = estado.sessoes.findIndex((sessao) => sessao.id === id);
    if (indice >= 0 && indice !== estado.indiceAtual) {
      await abrirSessao(indice);
    }
  });
}

function sessaoValida(sessao) {
  return Boolean(
    sessao &&
    typeof sessao.id === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(sessao.data) &&
    typeof sessao.titulo === "string" &&
    typeof sessao.arquivo === "string"
  );
}

function renderizarSumario() {
  const fragmento = document.createDocumentFragment();

  estado.sessoes.forEach((sessao, indice) => {
    const item = document.createElement("li");
    item.className = "entrada-sumario";
    item.dataset.id = sessao.id;
    item.dataset.pesquisa = normalizarTexto(
      `${sessao.data} ${formatarData(sessao.data)} ${sessao.titulo}`
    );

    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = `${formatarData(sessao.data)} - ${sessao.titulo}`;
    botao.addEventListener("click", async () => {
      await abrirSessao(indice);
      fecharSumarioMobile();
    });

    item.appendChild(botao);
    fragmento.appendChild(item);
  });

  elementos.listaEntradas.replaceChildren(fragmento);
}

function filtrarSumario() {
  const termo = normalizarTexto(elementos.pesquisa.value);
  let visiveis = 0;

  elementos.listaEntradas
    .querySelectorAll(".entrada-sumario")
    .forEach((item) => {
      const mostrar = !termo || item.dataset.pesquisa.includes(termo);
      item.hidden = !mostrar;
      if (mostrar) {
        visiveis += 1;
      }
    });

  elementos.listaVazia.hidden = visiveis !== 0;
}

async function avancar() {
  if (estado.animando || estado.carregando || estado.sessoes.length === 0) {
    return;
  }

  if (estado.indiceAtual < 0) {
    await abrirSessao(0, "next");
    return;
  }

  if (estado.indiceAtual < estado.sessoes.length - 1) {
    await abrirSessao(estado.indiceAtual + 1, "next");
  }
}

async function voltar() {
  if (estado.animando || estado.carregando || estado.indiceAtual < 0) {
    return;
  }

  if (estado.indiceAtual === 0) {
    await fecharLivro();
    return;
  }

  await abrirSessao(estado.indiceAtual - 1, "previous");
}

async function abrirSessao(indice, direcao, semAnimacao = false) {
  if (
    estado.animando ||
    estado.carregando ||
    indice < 0 ||
    indice >= estado.sessoes.length
  ) {
    return;
  }

  const sessao = estado.sessoes[indice];
  const livroEstavaFechado = estado.indiceAtual < 0;

  estado.carregando = true;
  elementos.estadoTexto.textContent = "Carregando a entrada...";
  atualizarControles();

  try {
    const markdown = await carregarMarkdown(sessao);
    const html = converterMarkdown(markdown);

    if (livroEstavaFechado || semAnimacao) {
      aplicarSessao(indice, markdown, html);
      elementos.livro.classList.add("is-open");
      elementos.livro.setAttribute("aria-label", "Diário aberto");
    } else {
      const classeAnimacao =
        direcao ||
        (indice > estado.indiceAtual ? "next" : "previous");

      estado.animando = true;
      elementos.livro.classList.add(
        classeAnimacao === "previous" ? "turn-previous" : "turn-next"
      );

      await esperar(DURACAO_VIRADA * 0.46);
      aplicarSessao(indice, markdown, html);
      await esperar(DURACAO_VIRADA * 0.54);

      elementos.livro.classList.remove("turn-next", "turn-previous");
      estado.animando = false;
    }

    atualizarHash(sessao.id);
  } catch (erro) {
    mostrarErro(
      `Não foi possível abrir "${sessao.titulo}": ${erro.message}`
    );
  } finally {
    estado.carregando = false;
    atualizarControles();
  }
}

async function carregarMarkdown(sessao) {
  if (estado.cacheMarkdown.has(sessao.id)) {
    return estado.cacheMarkdown.get(sessao.id);
  }

  const url = new URL(sessao.arquivo, document.baseURI);
  const resposta = await fetch(url, { cache: "no-cache" });

  if (!resposta.ok) {
    throw new Error(`o arquivo respondeu com status ${resposta.status}.`);
  }

  const markdown = (await resposta.text())
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n");

  estado.cacheMarkdown.set(sessao.id, markdown);
  return markdown;
}

function aplicarSessao(indice, markdown, html) {
  const sessao = estado.sessoes[indice];

  estado.indiceAtual = indice;
  estado.markdownAtual = markdown;

  elementos.conteudo.innerHTML = html;
  elementos.conteudo.scrollTop = 0;
  ajustarDensidadeConteudo();

  elementos.cabecalhoEsquerdo.textContent =
    `${formatarData(sessao.data)} · ${sessao.titulo}`;

  elementos.cabecalhoDireito.textContent =
    `Tempos Perturbados · Registro ${indice + 1}`;

  elementos.tituloAtual.textContent =
    `${formatarData(sessao.data)} - ${sessao.titulo}`;

  elementos.estadoTexto.textContent = sessao.titulo;
  elementos.indicadorPagina.textContent =
    `${indice + 1} de ${estado.sessoes.length}`;

  destacarItemAtual(sessao.id);
}

async function fecharLivro() {
  if (estado.animando || estado.indiceAtual < 0) {
    return;
  }

  estado.animando = true;
  elementos.livro.classList.remove("is-open");
  elementos.livro.setAttribute("aria-label", "Diário fechado");

  await esperar(760);

  estado.indiceAtual = -1;
  estado.markdownAtual = "";

  elementos.tituloAtual.textContent = "O diário permanece fechado";
  elementos.estadoTexto.textContent = "Diário fechado.";
  elementos.indicadorPagina.textContent = "";
  elementos.conteudo.replaceChildren();
  elementos.cabecalhoEsquerdo.textContent = "";
  elementos.cabecalhoDireito.textContent = "";

  destacarItemAtual("");
  history.replaceState(null, "", `${location.pathname}${location.search}`);

  estado.animando = false;
  atualizarControles();
}

function ajustarDensidadeConteudo() {
  elementos.conteudo.classList.remove("is-dense", "is-very-dense");

  if (
    estado.indiceAtual < 0 ||
    window.matchMedia("(max-width: 780px)").matches
  ) {
    return;
  }

  // Força o navegador a recalcular as colunas antes da medição.
  void elementos.conteudo.offsetHeight;

  if (!conteudoTransborda()) {
    return;
  }

  elementos.conteudo.classList.add("is-dense");
  void elementos.conteudo.offsetHeight;

  if (conteudoTransborda()) {
    elementos.conteudo.classList.add("is-very-dense");
  }
}

function conteudoTransborda() {
  return (
    elementos.conteudo.scrollWidth > elementos.conteudo.clientWidth + 3 ||
    elementos.conteudo.scrollHeight > elementos.conteudo.clientHeight + 3
  );
}

function atualizarControles() {
  const possuiSessoes = estado.sessoes.length > 0;
  const estaAberto = estado.indiceAtual >= 0;

  elementos.setaEsquerda.disabled =
    !estaAberto || estado.animando || estado.carregando;

  elementos.setaDireita.disabled =
    !possuiSessoes ||
    estado.animando ||
    estado.carregando ||
    (estaAberto && estado.indiceAtual >= estado.sessoes.length - 1);

  elementos.botaoDownload.disabled =
    !estaAberto || estado.animando || estado.carregando;
}

function destacarItemAtual(id) {
  elementos.listaEntradas
    .querySelectorAll(".entrada-sumario")
    .forEach((item) => {
      item.classList.toggle("is-current", item.dataset.id === id);

      const botao = item.querySelector("button");
      if (botao) {
        if (item.dataset.id === id) {
          botao.setAttribute("aria-current", "page");
          item.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } else {
          botao.removeAttribute("aria-current");
        }
      }
    });
}

function baixarMarkdown() {
  if (estado.indiceAtual < 0 || !estado.markdownAtual) {
    return;
  }

  const sessao = estado.sessoes[estado.indiceAtual];
  const nomeArquivo =
    obterNomeArquivo(sessao.arquivo) ||
    `Diário - ${sessao.data} - ${sessao.titulo}.md`;

  const blob = new Blob([estado.markdownAtual], {
    type: "text/markdown;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function obterNomeArquivo(caminho) {
  try {
    return decodeURIComponent(caminho.split("/").pop());
  } catch {
    return caminho.split("/").pop();
  }
}

function atualizarHash(id) {
  const novoHash = `#${encodeURIComponent(id)}`;
  if (window.location.hash !== novoHash) {
    history.replaceState(null, "", novoHash);
  }
}

function formatarData(dataIso) {
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function normalizarTexto(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function abrirSumarioMobile() {
  elementos.sumario.classList.add("is-open");
  elementos.fundoSumario.hidden = false;
  elementos.botaoMenu.setAttribute("aria-expanded", "true");
}

function fecharSumarioMobile() {
  elementos.sumario.classList.remove("is-open");
  elementos.fundoSumario.hidden = true;
  elementos.botaoMenu.setAttribute("aria-expanded", "false");
}

function mostrarErro(mensagem) {
  elementos.mensagemErro.hidden = false;
  elementos.mensagemErroTexto.textContent = mensagem;
  elementos.estadoTexto.textContent = "Falha ao carregar o diário.";
  console.error(mensagem);
}

function esperar(milisegundos) {
  return new Promise((resolver) => setTimeout(resolver, milisegundos));
}

/*
 * Conversor Markdown deliberadamente pequeno e local.
 * Ele cobre os elementos usados no diário sem depender de bibliotecas externas:
 * títulos, parágrafos, quebras de linha, listas, citações, negrito, itálico,
 * links, código, separadores e wikilinks do Obsidian.
 */
function converterMarkdown(markdown) {
  const linhas = markdown.split("\n");
  const saida = [];
  let paragrafo = [];
  let listaAtual = null;
  let itensLista = [];
  let citacao = [];

  const descarregarParagrafo = () => {
    if (!paragrafo.length) {
      return;
    }

    saida.push(
      `<p>${paragrafo.map(converterInline).join("<br>")}</p>`
    );
    paragrafo = [];
  };

  const descarregarLista = () => {
    if (!listaAtual || !itensLista.length) {
      listaAtual = null;
      itensLista = [];
      return;
    }

    saida.push(
      `<${listaAtual}>${itensLista
        .map((item) => `<li>${converterInline(item)}</li>`)
        .join("")}</${listaAtual}>`
    );

    listaAtual = null;
    itensLista = [];
  };

  const descarregarCitacao = () => {
    if (!citacao.length) {
      return;
    }

    saida.push(
      `<blockquote>${citacao.map(converterInline).join("<br>")}</blockquote>`
    );
    citacao = [];
  };

  const descarregarTudo = () => {
    descarregarParagrafo();
    descarregarLista();
    descarregarCitacao();
  };

  for (const linhaOriginal of linhas) {
    const linha = linhaOriginal.replace(/\s+$/, "");

    if (!linha.trim()) {
      descarregarTudo();
      continue;
    }

    const titulo = linha.match(/^(#{1,6})\s+(.+)$/);
    if (titulo) {
      descarregarTudo();
      const nivel = Math.min(titulo[1].length, 4);
      saida.push(`<h${nivel}>${converterInline(titulo[2])}</h${nivel}>`);
      continue;
    }

    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(linha)) {
      descarregarTudo();
      saida.push("<hr>");
      continue;
    }

    const itemNaoOrdenado = linha.match(/^\s*[-+*]\s+(.+)$/);
    const itemOrdenado = linha.match(/^\s*\d+[.)]\s+(.+)$/);

    if (itemNaoOrdenado || itemOrdenado) {
      descarregarParagrafo();
      descarregarCitacao();

      const tipo = itemOrdenado ? "ol" : "ul";
      if (listaAtual && listaAtual !== tipo) {
        descarregarLista();
      }

      listaAtual = tipo;
      itensLista.push((itemOrdenado || itemNaoOrdenado)[1]);
      continue;
    }

    const trechoCitacao = linha.match(/^\s*>\s?(.*)$/);
    if (trechoCitacao) {
      descarregarParagrafo();
      descarregarLista();
      citacao.push(trechoCitacao[1]);
      continue;
    }

    descarregarLista();
    descarregarCitacao();
    paragrafo.push(linha);
  }

  descarregarTudo();
  return saida.join("");
}

function converterInline(texto) {
  const codigos = [];
  let resultado = escaparHtml(texto);

  resultado = resultado.replace(/`([^`]+)`/g, (_, codigo) => {
    const marcador = `@@CODIGO_${codigos.length}@@`;
    codigos.push(`<code>${codigo}</code>`);
    return marcador;
  });

  resultado = resultado.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, destino, rotulo) =>
      `<span class="wiki-link" title="${destino}">${rotulo || destino}</span>`
  );

  resultado = resultado.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g,
    (_, rotulo, url) => {
      const urlLimpa = url.replaceAll("&amp;", "&");
      if (!urlPermitida(urlLimpa)) {
        return rotulo;
      }

      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${rotulo}</a>`;
    }
  );

  resultado = resultado
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");

  codigos.forEach((codigo, indice) => {
    resultado = resultado.replace(`@@CODIGO_${indice}@@`, codigo);
  });

  return resultado;
}

function escaparHtml(texto) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function urlPermitida(url) {
  return /^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(url);
}
