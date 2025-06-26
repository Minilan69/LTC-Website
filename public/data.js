// UUID pour les icônes
async function getUUIDFromName(name) {
  const res = await fetch(`/api/mojang-uuid/${name}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.id;
}

// Joueurs connectés
async function fetchPlayers() {
  const res = await fetch('/api/proxy/api/players');
  const data = await res.json();
  const list = document.getElementById("players-list");

  // Nettoie les messages spéciaux
  Array.from(list.children).forEach(child => {
    if (
      child.textContent === "Chargement..." ||
      child.textContent === "Aucun joueur connecté"
    ) {
      list.removeChild(child);
    }
  });

  // Si aucun joueur connecté
  if (!data || data.length === 0) {
    if (!Array.from(list.children).some(child => child.textContent === "Aucun joueur connecté")) {
      const li = document.createElement("li");
      li.textContent = "Aucun joueur connecté";
      while (list.firstChild) list.removeChild(list.firstChild);
      list.appendChild(li);
    }
    return;
  }

  // Supprime les joueurs qui ne sont plus connectés
  for (const li of Array.from(list.children)) {
    const name = li.dataset && li.dataset.playerName;
    if (name && !data.some(p => p.name === name)) {
      list.removeChild(li);
    }
  }

  // Ajoute les nouveaux joueurs
  for (const player of data) {
    if (!Array.from(list.children).some(li => li.dataset && li.dataset.playerName === player.name)) {
      const li = document.createElement("li");
      li.dataset.playerName = player.name;
      const img = document.createElement("img");
      const uuid = await getUUIDFromName(player.name);
      img.src = `https://crafatar.com/avatars/${uuid}?size=32&overlay`;
      img.alt = `Avatar de ${player.name}`;
      img.style.verticalAlign = "middle";
      img.style.marginRight = "8px";
      img.width = 24;
      img.height = 24;
      li.appendChild(img);
      li.appendChild(document.createTextNode(player.name));
      list.appendChild(li);
    }
  }
}

// Classement
async function fetchLeaderboard() {
  const res = await fetch('/api/proxy/api/br/leaderboard');
  const data = await res.json();
  const list = document.getElementById("leaderboard");

  // Nettoie les messages spéciaux
  Array.from(list.children).forEach(child => {
    if (child.textContent === "Chargement..." || child.textContent === "Pas de données") {
      list.removeChild(child);
    }
  });

  if (!data || data.length === 0) {
    if (!Array.from(list.children).some(child => child.textContent === "Pas de données")) {
      const li = document.createElement("li");
      li.textContent = "Pas de données";
      while (list.firstChild) list.removeChild(list.firstChild);
      list.appendChild(li);
    }
    return;
  }

  const displayed = new Map();
  Array.from(list.children).forEach(li => {
    if (li.dataset && li.dataset.playerName) {
      displayed.set(li.dataset.playerName, li);
    }
  });

  for (let i = 0; i < data.length; i++) {
    const player = data[i];
    let li = displayed.get(player.name);

    if (li) {
      const expectedText = `${player.name} - ${player.wins} victoires`;
      if (!li.textContent.includes(expectedText)) {
        li.innerHTML = "";
        const img = document.createElement("img");
        const uuid = await getUUIDFromName(player.name);
        img.src = `https://crafatar.com/avatars/${uuid}?size=32&overlay`;
        img.alt = `Avatar de ${player.name}`;
        img.style.verticalAlign = "middle";
        img.style.marginRight = "8px";
        img.width = 24;
        img.height = 24;
        li.appendChild(img);
        li.appendChild(document.createTextNode(expectedText));
      }
      if (list.children[i] !== li) {
        list.insertBefore(li, list.children[i]);
      }
      displayed.delete(player.name);
    } else {
      li = document.createElement("li");
      li.dataset.playerName = player.name;
      const img = document.createElement("img");
      const uuid = await getUUIDFromName(player.name);
      img.src = `https://crafatar.com/avatars/${uuid}?size=32&overlay`;
      img.alt = `Avatar de ${player.name}`;
      img.style.verticalAlign = "middle";
      img.style.marginRight = "8px";
      img.width = 24;
      img.height = 24;
      li.appendChild(img);
      li.appendChild(document.createTextNode(`${player.name} - ${player.wins} victoires`));
      list.insertBefore(li, list.children[i] || null);
    }
  }

  for (const li of displayed.values()) {
    list.removeChild(li);
  }
}

// Statut des parties
async function fetchGameStatus() {
  const res = await fetch('/api/proxy/api/br/status');
  const data = await res.json();
  const statusDiv = document.getElementById("game-status");
  statusDiv.innerHTML = "";
  const p = document.createElement("p");
  if (data) {
    p.textContent = "Partie en cours";
  } else {
    p.textContent = "Aucune partie en cours";
  }
  statusDiv.appendChild(p);
}

// Actus
async function fetchNews() {
  const res = await fetch('/api/last-message');
  if (!res.ok) return;

  const data = await res.json();

  let content = data || "Aucune actu disponible";

  content = content
    .replace(/\|\|(.+?)\|\|/g, '<span class="spoiler">$1</span>') // Spoiler
    .replace(/<@!?(\d+)>/g, '@utilisateur') // Mentions (remplace par texte)
    .replace(/<a?:\w+:\d+>/g, '') // Emojis custom Discord
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // Gras Discord
    .replace(/^-# (.*)$/gm, '<span class="little">$1</span>'); // Petit texte gris

  const newsDiv = document.getElementById("server-info");

  newsDiv.innerHTML = "";

  const div = document.createElement("div");
  div.innerHTML = marked.parse(content);
  newsDiv.appendChild(div);
}


// Initialisation globale
document.addEventListener("DOMContentLoaded", () => {
  fetchPlayers();
  fetchLeaderboard();
  fetchGameStatus();
  fetchNews();

  setInterval(fetchPlayers, 10000);
  setInterval(fetchLeaderboard, 10000);
  setInterval(fetchGameStatus, 10000);
  setInterval(fetchNews, 30000);
});