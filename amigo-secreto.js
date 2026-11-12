const local = ["localhost", "127.0.0.1"].includes(location.hostname);
const endpoint = local ? "/api/sorteio" :
  "https://amigo-secreto-vitemiliano-api.hospitablepike1.chatgpt.site/api/sorteio";
const adminNames = new Set(["Taiane", "Vítor"]);
const $ = (id) => document.getElementById(id);
const entry = $("entry");
const login = $("login");
const admin = $("admin");
const nameField = $("name");
const retry = $("retry");
const passwordField = $("password");
const choiceField = $("choice");
const choose = $("choose");
const confirmation = $("confirmation");
const result = $("result");
const resultName = $("result-name");
const errorText = $("error");
const statusText = $("status");
const unavailable = "Não foi possível conectar ao sorteio. Tente novamente.";
let name = "";
let adminPassword = "";
let confirmAction;
let working = false;

function setMessage(element, message = "") {
  element.textContent = message;
  element.hidden = !message;
}

function showForm(form) {
  for (const step of [entry, login, admin]) step.hidden = step !== form;
}

function clearSelection() {
  name = "";
  nameField.value = "";
  passwordField.value = "";
  choiceField.replaceChildren();
  adminPassword = "";
  confirmAction = undefined;
  retry.hidden = true;
  setMessage(errorText);
  showForm(entry);
  nameField.focus();
}

function showFriend(friend) {
  resultName.textContent = friend;
  passwordField.value = "";
  adminPassword = "";
  result.showModal();
}

function showChoices(available) {
  choiceField.replaceChildren(new Option("Selecione um nome", ""));
  for (const person of available) choiceField.add(new Option(person, person));
  choose.disabled = true;
  showForm(admin);
  choiceField.focus();
}

async function request(action, extra = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, name, ...extra }),
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json();
  if (!response.ok) {
    if (Array.isArray(data.available)) showChoices(data.available);
    return { error: data.error || unavailable };
  }
  return data;
}

async function run(action, options, onSuccess, showRetry = false) {
  if (working) return;
  working = true;
  retry.hidden = true;
  setMessage(errorText);
  setMessage(statusText, "Aguarde…");
  const controls = [...document.querySelectorAll(".panel form:not([hidden]) :is(input, select, button)")]
    .filter((control) => !control.disabled);
  for (const control of controls) control.disabled = true;

  let data;
  try {
    data = await request(action, options);
  } catch {
    data = { error: unavailable };
  } finally {
    for (const control of controls) control.disabled = false;
    choose.disabled = !choiceField.value;
    setMessage(statusText);
    working = false;
  }

  if (data.error) {
    setMessage(errorText, data.error);
    retry.hidden = !showRetry;
    if (showRetry) retry.focus();
    if (action === "admin") {
      passwordField.focus();
      passwordField.select();
    }
    return;
  }
  onSuccess(data);
}

function openConfirmation(assigned) {
  confirmAction = assigned ? "reveal" : "draw";
  $("confirmation-text").textContent = assigned
    ? `Você está prestes a ver o amigo de ${name}, prosseguir?`
    : "Seu amigo secreto será sorteado, prosseguir?";
  confirmation.returnValue = "";
  confirmation.showModal();
}

function selectName() {
  if (working || !nameField.value) return;
  name = nameField.value;
  if (adminNames.has(name)) {
    setMessage(errorText);
    $("login-description").textContent = `Digite a senha de administrador para acessar como ${name}.`;
    showForm(login);
    passwordField.focus();
    return;
  }
  run("status", {}, ({ assigned }) => openConfirmation(assigned), true);
}

nameField.addEventListener("change", selectName);
entry.addEventListener("submit", (event) => {
  event.preventDefault();
  selectName();
});

confirmation.addEventListener("close", () => {
  if (confirmation.returnValue === "confirm") {
    run(confirmAction, {}, ({ friend }) => showFriend(friend), true);
  } else {
    clearSelection();
  }
});

login.addEventListener("submit", (event) => {
  event.preventDefault();
  if (working) return;
  const password = passwordField.value;
  run("admin", { password }, ({ friend, available }) => {
    passwordField.value = "";
    if (friend) {
      showFriend(friend);
    } else {
      adminPassword = password;
      showChoices(available);
    }
  });
});

choiceField.addEventListener("change", () => { choose.disabled = !choiceField.value; });
admin.addEventListener("submit", (event) => {
  event.preventDefault();
  run("choose", { choice: choiceField.value, password: adminPassword },
    ({ friend }) => showFriend(friend));
});

for (const button of document.querySelectorAll(".back")) {
  button.addEventListener("click", clearSelection);
}

result.addEventListener("close", () => {
  resultName.textContent = "";
  clearSelection();
});
