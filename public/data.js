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
async function getMentionHTML(part) {
  try {
    const res = await fetch(`/api/discord-name/${part.id}`);
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();
    if (part.type === 'user') {
      return `<span class="mention">@${data.name}</span>`;
    } else if (part.type === 'role') {
      return `<span class="mention">@${data.name}</span>`;
    }
  } catch {
    // fallback si pas trouvé ou erreur
    if (part.type === 'user') return `<span class="mention">@User:${part.id}</span>`;
    if (part.type === 'role') return `<span class="mention">@Role:${part.id}</span>`;
    return '';
  }
}

async function renderParsedToHTML(parsed) {
  let html = "";

  for (const part of parsed) {
    switch (part.type) {
      case 'text':
        html += part.content;
        break
      case 'br':
        html += '<br>';
        break
      case 'heading':
        html += `<h${part.level}>${await renderParsedToHTML(part.content)}</h${part.level}>`
        break
      case 'strong':
        html += `<strong>${await renderParsedToHTML(part.content)}</strong>`
        break
      case 'em':
        html += `<em>${await renderParsedToHTML(part.content)}</em>`
        break
      case 'underline':
        html += `<u>${await renderParsedToHTML(part.content)}</u>`
        break
      case 'strikethrough':
        html += `<del>${await renderParsedToHTML(part.content)}</del>`
        break
      case 'blockquote':
        html += `<blockquote class="discord-quote">${await renderParsedToHTML(part.content)}</blockquote>`
        break
      case 'spoiler':
        html += `<span class="spoiler">${await renderParsedToHTML(part.content)}</span>`
        break
      case 'emoji':
        const url = `https://cdn.discordapp.com/emojis/${part.id}.${part.animated ? 'gif' : 'png'}?size=16`
        html += `<img class="emoji" src="${url}" alt="${part.name}" title="${part.name}" loading="lazy" />`
        break
      case 'twemoji':
        html += part.name;
      case 'user':
      case 'role':
        html += await getMentionHTML(part);
        break
      case 'url':
        html += `<a href="${part.target}" target="_blank" rel="noopener noreferrer">${await renderParsedToHTML(part.content)}</a>`;
        break
      case 'subtext':
        html += `<span class="subtext">${await renderParsedToHTML(part.content)}</span>`;
        break

      case 'channel':
        html += `<span class="mention">#Channel:${part.id}</span>`;
        break
      default:
        html += ''; // ignore ou ajoute un fallback si tu veux
    }
  }

  return html;
}

async function fetchNews() {
  const res = await fetch('/api/last-message')
  if (!res.ok) return

  const data = await res.json()
  console.log(data)
  const newsDiv = document.getElementById("server-info")
  newsDiv.innerHTML = ""

  // Appel backend qui renvoie AST discord-markdown-parser
  const mdRes = await fetch('/api/discord-markdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: data.content }),
  })

  if (!mdRes.ok) return
  const mdData = await mdRes.json()

  let htmlContent = await renderParsedToHTML(mdData.ast || mdData.parsed || [])
  
  const images = data.images;
  const chunkSize = 5;

  for (let i = 0; i < images.length; i += chunkSize) {
    const chunk = images.slice(i, i + chunkSize);
    const count = chunk.length;
    htmlContent += `<div class="news-images">`
    htmlContent += chunk.map(img => 
      `<img src="${img}" alt="Image attachée" style="max-width: ${100 / count}%; width: ${100 / count}%" loading="lazy">`
    ).join('');
    htmlContent += `</div>`;
  }



  const div = document.createElement("div")
  div.classList.add("news-content")
  div.innerHTML = htmlContent

  newsDiv.appendChild(div)
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