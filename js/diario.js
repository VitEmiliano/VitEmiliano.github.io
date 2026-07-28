"use strict";

const CAMINHO_INDICE = "./conteudo/index.json";
const DURACAO_VIRADA = 620;
const MEDIA_MOBILE = "(max-width: 780px)";

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
  htmlAtual: "",
  paginasMobile: [],
  paginaInternaAtual: 0,
  modoMobile: window.matchMedia(MEDIA_MOBILE).matches,
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
      throw new Error(`O índice respondeu com status ${resposta.status}.`);
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
    await aguardarFontes();

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
    temporizadorRedimensionamento = setTimeout(reconfigurarAposRedimensionamento, 180);
  });

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      if (estado.indiceAtual >= 0) {
        reconfigurarConteudoAtual();
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
      await abrirSessao(indice, undefined, false, 0);
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
    await abrirSessao(0, "next", false, 0);
    return;
  }

  if (
    estado.modoMobile &&
    estado.paginaInternaAtual < estado.paginasMobile.length - 1
  ) {
    await virarPaginaInterna(estado.paginaInternaAtual + 1, "next");
    return;
  }

  if (estado.indiceAtual < estado.sessoes.length - 1) {
    await abrirSessao(estado.indiceAtual + 1, "next", false, 0);
  }
}

async function voltar() {
  if (estado.animando || estado.carregando || estado.indiceAtual < 0) {
    return;
  }

  if (estado.modoMobile && estado.paginaInternaAtual > 0) {
    await virarPaginaInterna(estado.paginaInternaAtual - 1, "previous");
    return;
  }

  if (estado.indiceAtual === 0) {
    await fecharLivro();
    return;
  }

  await abrirSessao(
    estado.indiceAtual - 1,
    "previous",
    false,
    estado.modoMobile ? "last" : 0
  );
}

async function abrirSessao(
  indice,
  direcao,
  semAnimacao = false,
  paginaAlvo = 0
) {
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

    if (livroEstavaFechado) {
      elementos.livro.classList.add("is-open");
      elementos.livro.setAttribute("aria-label", "Diário aberto");
      await esperarDoisFrames();
    }

    if (livroEstavaFechado || semAnimacao) {
      await aplicarSessao(indice, markdown, html, paginaAlvo);
    } else {
      const classeAnimacao =
        direcao || (indice > estado.indiceAtual ? "next" : "previous");

      await animarVirada(classeAnimacao, async () => {
        await aplicarSessao(indice, markdown, html, paginaAlvo);
      });
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

async function aplicarSessao(indice, markdown, html, paginaAlvo = 0) {
  const sessao = estado.sessoes[indice];

  estado.indiceAtual = indice;
  estado.markdownAtual = markdown;
  estado.htmlAtual = html;

  elementos.cabecalhoEsquerdo.textContent =
    `${formatarData(sessao.data)} · ${sessao.titulo}`;

  elementos.tituloAtual.textContent =
    `${formatarData(sessao.data)} - ${sessao.titulo}`;

  elementos.estadoTexto.textContent = sessao.titulo;

  await configurarConteudoAtual(paginaAlvo);
  destacarItemAtual(sessao.id);
}

async function configurarConteudoAtual(paginaAlvo = 0) {
  limparAjustesConteudo();

  if (estado.modoMobile) {
    elementos.conteudo.innerHTML = estado.htmlAtual;
    await esperarDoisFrames();

    estado.paginasMobile = paginarHtmlParaMobile(estado.htmlAtual);

    if (estado.paginasMobile.length === 0) {
      estado.paginasMobile = [estado.htmlAtual];
    }

    const indiceDesejado = paginaAlvo === "last"
      ? estado.paginasMobile.length - 1
      : Number(paginaAlvo) || 0;

    estado.paginaInternaAtual = limitar(
      indiceDesejado,
      0,
      estado.paginasMobile.length - 1
    );

    exibirPaginaMobile();
  } else {
    estado.paginasMobile = [];
    estado.paginaInternaAtual = 0;
    elementos.conteudo.innerHTML = estado.htmlAtual;
    elementos.conteudo.scrollTop = 0;
    await ajustarTextoDesktop();
  }

  atualizarIndicadores();
}

function exibirPaginaMobile() {
  elementos.conteudo.innerHTML =
    estado.paginasMobile[estado.paginaInternaAtual] || "";
  elementos.conteudo.scrollTop = 0;
  atualizarIndicadores();
}

async function virarPaginaInterna(novoIndice, direcao) {
  if (
    novoIndice < 0 ||
    novoIndice >= estado.paginasMobile.length ||
    novoIndice === estado.paginaInternaAtual
  ) {
    return;
  }

  await animarVirada(direcao, () => {
    estado.paginaInternaAtual = novoIndice;
    exibirPaginaMobile();
  });

  atualizarControles();
}

async function animarVirada(direcao, trocarConteudo) {
  estado.animando = true;
  atualizarControles();

  const classe = direcao === "previous" ? "turn-previous" : "turn-next";
  elementos.livro.classList.add(classe);

  await esperar(DURACAO_VIRADA * 0.46);
  await trocarConteudo();
  await esperar(DURACAO_VIRADA * 0.54);

  elementos.livro.classList.remove("turn-next", "turn-previous");
  estado.animando = false;
  atualizarControles();
}

async function fecharLivro() {
  if (estado.animando || estado.indiceAtual < 0) {
    return;
  }

  estado.animando = true;
  atualizarControles();
  elementos.livro.classList.remove("is-open");
  elementos.livro.setAttribute("aria-label", "Diário fechado");

  await esperar(760);

  estado.indiceAtual = -1;
  estado.markdownAtual = "";
  estado.htmlAtual = "";
  estado.paginasMobile = [];
  estado.paginaInternaAtual = 0;

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

async function ajustarTextoDesktop() {
  limparAjustesConteudo();
  await esperarDoisFrames();

  const estilo = getComputedStyle(elementos.conteudo);
  const tamanhoInicial = Number.parseFloat(estilo.fontSize) || 17;
  const alturaLinhaInicial = Number.parseFloat(estilo.lineHeight) || tamanhoInicial * 1.42;
  const proporcaoLinha = alturaLinhaInicial / tamanhoInicial;
  const tamanhoMinimo = 9.25;
  let tamanho = tamanhoInicial;

  while (conteudoDesktopTransborda() && tamanho > tamanhoMinimo) {
    tamanho = Math.max(tamanhoMinimo, tamanho - 0.25);
    elementos.conteudo.style.fontSize = `${tamanho}px`;
    elementos.conteudo.style.lineHeight = String(
      Math.max(1.2, proporcaoLinha - (tamanhoInicial - tamanho) * 0.012)
    );
    void elementos.conteudo.offsetWidth;
  }
}

function conteudoDesktopTransborda() {
  return (
    elementos.conteudo.scrollWidth > elementos.conteudo.clientWidth + 3 ||
    elementos.conteudo.scrollHeight > elementos.conteudo.clientHeight + 3
  );
}

function paginarHtmlParaMobile(html) {
  if (!html.trim() || elementos.conteudo.clientHeight <= 0) {
    return [html];
  }

  const origem = document.createElement("div");
  origem.innerHTML = html;

  const posicoes = coletarPosicoesDeQuebra(origem);
  if (posicoes.length === 0) {
    return [html];
  }

  const medidor = elementos.conteudo.cloneNode(false);
  medidor.removeAttribute("id");
  medidor.className = "conteudo-pagina medidor-paginacao";
  medidor.style.width = `${elementos.conteudo.clientWidth}px`;
  medidor.style.height = `${elementos.conteudo.clientHeight}px`;
  document.body.appendChild(medidor);

  const paginas = [];
  let inicio = { no: origem, deslocamento: 0 };
  let indiceInicial = 0;

  while (indiceInicial < posicoes.length) {
    let minimo = indiceInicial;
    let maximo = posicoes.length - 1;
    let melhorIndice = -1;
    let melhorHtml = "";

    while (minimo <= maximo) {
      const meio = Math.floor((minimo + maximo) / 2);
      const candidato = criarFragmentoHtml(origem, inicio, posicoes[meio]);

      medidor.innerHTML = candidato;
      const cabe =
        medidor.scrollHeight <= medidor.clientHeight + 2 &&
        medidor.scrollWidth <= medidor.clientWidth + 2;

      if (cabe) {
        melhorIndice = meio;
        melhorHtml = candidato;
        minimo = meio + 1;
      } else {
        maximo = meio - 1;
      }
    }

    if (melhorIndice < indiceInicial) {
      melhorIndice = indiceInicial;
      melhorHtml = criarFragmentoHtml(origem, inicio, posicoes[melhorIndice]);
    }

    if (melhorHtml.trim()) {
      paginas.push(melhorHtml);
    }

    inicio = posicoes[melhorIndice];
    indiceInicial = melhorIndice + 1;
  }

  medidor.remove();
  return paginas.length ? paginas : [html];
}

function coletarPosicoesDeQuebra(raiz) {
  const posicoes = [];
  const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  let no;

  while ((no = walker.nextNode())) {
    const regex = /\S+\s*/g;
    let correspondencia;

    while ((correspondencia = regex.exec(no.nodeValue || ""))) {
      posicoes.push({
        no,
        deslocamento: correspondencia.index + correspondencia[0].length,
      });
    }
  }

  return posicoes;
}

function criarFragmentoHtml(raiz, inicio, fim) {
  const intervalo = document.createRange();

  if (inicio.no === raiz) {
    intervalo.setStart(raiz, inicio.deslocamento);
  } else {
    intervalo.setStart(inicio.no, inicio.deslocamento);
  }

  intervalo.setEnd(fim.no, fim.deslocamento);

  const recipiente = document.createElement("div");
  recipiente.appendChild(intervalo.cloneContents());
  return recipiente.innerHTML;
}

async function reconfigurarAposRedimensionamento() {
  const novoModoMobile = window.matchMedia(MEDIA_MOBILE).matches;
  const modoMudou = novoModoMobile !== estado.modoMobile;
  const totalAnterior = estado.paginasMobile.length;
  const paginaAnterior = estado.paginaInternaAtual;

  estado.modoMobile = novoModoMobile;

  if (estado.indiceAtual < 0 || estado.animando || estado.carregando) {
    atualizarControles();
    return;
  }

  let paginaAlvo = 0;
  if (!modoMudou && novoModoMobile && totalAnterior > 1) {
    const proporcao = paginaAnterior / (totalAnterior - 1);
    paginaAlvo = { proporcao };
  }

  await reconfigurarConteudoAtual(paginaAlvo);
}

async function reconfigurarConteudoAtual(paginaAlvo = 0) {
  if (estado.indiceAtual < 0 || !estado.htmlAtual) {
    return;
  }

  const proporcaoSolicitada =
    paginaAlvo && typeof paginaAlvo === "object"
      ? paginaAlvo.proporcao
      : null;

  await configurarConteudoAtual(0);

  if (
    estado.modoMobile &&
    proporcaoSolicitada !== null &&
    estado.paginasMobile.length > 1
  ) {
    estado.paginaInternaAtual = Math.round(
      proporcaoSolicitada * (estado.paginasMobile.length - 1)
    );
    exibirPaginaMobile();
  }

  atualizarControles();
}

function limparAjustesConteudo() {
  elementos.conteudo.style.removeProperty("font-size");
  elementos.conteudo.style.removeProperty("line-height");
  elementos.conteudo.classList.remove("is-dense", "is-very-dense");
}

function atualizarIndicadores() {
  if (estado.indiceAtual < 0) {
    elementos.indicadorPagina.textContent = "";
    return;
  }

  const sessao = estado.sessoes[estado.indiceAtual];

  if (estado.modoMobile) {
    const pagina = estado.paginaInternaAtual + 1;
    const totalPaginas = Math.max(estado.paginasMobile.length, 1);

    elementos.indicadorPagina.textContent =
      `Registro ${estado.indiceAtual + 1} de ${estado.sessoes.length} · ` +
      `Página ${pagina} de ${totalPaginas}`;

    elementos.cabecalhoDireito.textContent = "";
    elementos.cabecalhoEsquerdo.textContent =
      `${formatarData(sessao.data)} · ${sessao.titulo} · ${pagina}/${totalPaginas}`;
  } else {
    elementos.indicadorPagina.textContent =
      `Registro ${estado.indiceAtual + 1} de ${estado.sessoes.length}`;

    elementos.cabecalhoEsquerdo.textContent =
      `${formatarData(sessao.data)} · ${sessao.titulo}`;

    elementos.cabecalhoDireito.textContent =
      `Tempos Perturbados · Registro ${estado.indiceAtual + 1}`;
  }
}

function atualizarControles() {
  const possuiSessoes = estado.sessoes.length > 0;
  const estaAberto = estado.indiceAtual >= 0;
  const possuiPaginaSeguinte =
    estado.modoMobile &&
    estado.paginaInternaAtual < estado.paginasMobile.length - 1;
  const possuiNotaSeguinte =
    estaAberto && estado.indiceAtual < estado.sessoes.length - 1;

  elementos.setaEsquerda.disabled =
    !estaAberto || estado.animando || estado.carregando;

  elementos.setaDireita.disabled =
    !possuiSessoes ||
    estado.animando ||
    estado.carregando ||
    (estaAberto && !possuiPaginaSeguinte && !possuiNotaSeguinte);

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

function aguardarFontes() {
  return document.fonts?.ready || Promise.resolve();
}

function esperar(milisegundos) {
  return new Promise((resolver) => setTimeout(resolver, milisegundos));
}

function esperarDoisFrames() {
  return new Promise((resolver) => {
    requestAnimationFrame(() => requestAnimationFrame(resolver));
  });
}

function limitar(valor, minimo, maximo) {
  return Math.min(Math.max(valor, minimo), maximo);
}

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
