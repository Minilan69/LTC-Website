const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
const express = require('express')
const axios = require('axios')
const session = require('express-session')
const SQLiteStore = require('connect-sqlite3')(session)
const app = express()
const db = require('./database')
const { exec } = require('child_process');
const { Client, GatewayIntentBits } = require('discord.js')
const { parse } = require('discord-markdown-parser');

// Get Discord OAuth info from env vars
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const BOT_TOKEN = process.env.BOT_TOKEN 
const REDIRECT_URI = process.env.REDIRECT_URI
const PORT = process.env.PORT

// Check if env vars exist
if (!CLIENT_ID || !CLIENT_SECRET || !BOT_TOKEN || !REDIRECT_URI || !PORT) {
  console.error('Missing environment variables: CLIENT_ID, CLIENT_SECRET, BOT_TOKEN, REDIRECT_URI or PORT')
  process.exit(1)
}

// Use session to handle user infos
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.sqlite', // Le fichier sera créé dans le dossier backend
    dir: './db',            // Tu peux choisir un dossier, ici "db"
  }),
  secret: process.env.SESSION_SECRET || 'ultra_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // mets true si tu passes en HTTPS
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 365 // 1 an
  }
}))


app.use(express.static(path.join(__dirname, '../public')))
app.use('/assets', express.static(path.join(__dirname, 'assets')))

// Route to start Discord login via OAuth2
app.get('/login', (req, res) => {
  const redirectTo = req.query.redirect || '/'
  req.session.redirectTo = redirectTo
  req.session.save(err => {
    if (err) {
      console.error('Session error:', err)
      return res.redirect('/')
    }
    const discordOAuthURL = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`
    res.redirect(discordOAuthURL)
  })
})


// OAuth2 callback route from Discord
app.get('/callback', async (req, res) => {
  const code = req.query.code
  const data = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    scope: 'identify guilds'
  })

  try {
    // Exchange code for access token
    const tokenRes = await axios.post('https://discord.com/api/oauth2/token', data, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })

    const access_token = tokenRes.data.access_token

    // Use access token to get user info
    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    })

    const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${access_token}` }
    })

    const user = userRes.data
    const guilds = guildsRes.data

    const MY_GUILD_ID = '1376474773101744148'
    const redirectTo = req.session.redirectTo || '/'

    // Store user info in session
    req.session.user = {
      id: user.id,
      username: user.username
    }

    // Check if user is in guild
    const isInGuild = guilds.some(guild => guild.id === MY_GUILD_ID)
    req.session.notInGuild = !isInGuild

    // Save session
    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err)
        return res.status(500).send('Session save error')
      }

      // If user is in the guild, update DB
      if (isInGuild) {
        db.run(
          `INSERT INTO users (id, username) VALUES (?, ?)
          ON CONFLICT(id) DO UPDATE SET username = excluded.username`,
          [user.id, user.username],
          (dbErr) => {
            if (dbErr) console.error('Error insert DB', dbErr)
            else console.log('User inserted/updated in DB:', user.username)
          }
        )
      }

      // Redirect
      return res.redirect(redirectTo)
    })

  } catch (err) {
    console.error((err.response && err.response.data) || err)
    res.status(500).send('Error during authentication')
  }
})


// Route to log out user and destroy session
app.get('/logout', (req, res) => {
  const redirectTo = req.query.redirect || '/'
  req.session.redirectTo = redirectTo
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error', err)
    }
    res.redirect(redirectTo)
  })
})


// Route to get current user info
app.get('/me', (req, res) => {
  if (req.session.user) {
    res.json({
      loggedIn: true,
      username: req.session.user.username,
      id: req.session.user.id,
      notInGuild: req.session.notInGuild || false
    })
  } else {
    res.json({ loggedIn: false, notInGuild: false })
  }
})

app.use(express.json())

// Check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session.user && req.session.user.id) return next()
  res.status(401).json({ error: 'Unauthorized' })
}

// Route to go to the map page
app.get('/br', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'br.html'))
})

// Route to find a user by ID or username
app.post('/find-user', isAuthenticated, (req, res) => {
  const { input } = req.body;

  db.get(
      `SELECT latitude, longitude FROM users WHERE id = ? OR username = ?`,
      [input, input],
      (err, row) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            if (!row) return res.status(404).json({ error: 'Not found' });

            res.json(row);
        }
    );
});

// Update Map
app.post('api/update-map', (req, res) => {
  exec('python3 map_updater.py', (error, stdout, stderr) => {
    if (error) {
      console.error(`Erreur d’exécution : ${error.message}`)
      return res.status(500).json({ success: false, error: error.message })
    }
    if (stderr) console.error(`stderr : ${stderr}`)

    console.log(`stdout : ${stdout}`)
    res.json({ success: true, message: 'Carte mise à jour' })
  })
})

// Proxy route to fetch data from the external API
app.use('/api/proxy', async (req, res) => {
  const url = 'http://91.197.6.112:30604' + req.url
  try {
    const response = await fetch(url)
    const data = await response.text()
    res.send(data)
  } catch (err) {
    res.status(500).send('Erreur proxy')
  }
})

// Route to get the head of user
app.get('/api/mojang-uuid/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${name}`);
    if (!response.ok) return res.status(404).json({ error: 'Not found' });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Discord News
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})
discordClient.login(BOT_TOKEN)
discordClient.once('ready', () => {
  console.log(`Bot Discord connecté en tant que ${discordClient.user.tag}`)
})

// Route pour récupérer le nom d'un utilisateur ou d'un rôle Discord par ID
app.get('/api/discord-name/:id', async (req, res) => {
  const { id } = req.params;
  const guildId = '1313197477674881135'; // Remplace par l'ID de ton serveur

  try {
    const guild = await discordClient.guilds.fetch(guildId);

    // Cherche d'abord un membre (utilisateur)
    try {
      const member = await guild.members.fetch(id);
      return res.json({ type: 'user', name: member.displayName });
    } catch (e) {
      // Pas un membre, on continue
    }

    // Cherche un rôle
    try {
      const role = await guild.roles.fetch(id);
      if (role) return res.json({ type: 'role', name: role.name });
    } catch (e) {
      // Pas un rôle non plus
    }

    // Si rien trouvé
    res.status(404).json({ error: 'Aucun utilisateur ou rôle trouvé pour cet ID' });
  } catch (err) {
    console.error('Erreur Discord API:', err); // <-- Ajoute ce log
    res.status(500).json({ error: 'Erreur Discord API' });
  }
});

app.post('/api/discord-markdown', express.json(), (req, res) => {
  
  const { text } = req.body;
  try {
    const ast = parse(text, 'normal');
    res.json({ ast });
  } catch (err) {
    res.status(500).json({ error: 'Parsing error' });
  }
});

app.get('/api/last-message', async (req, res) => {
  try {
    const channel = await discordClient.channels.fetch('1387487557322936370')
    const messages = await channel.messages.fetch({ limit: 1 })
    const last = messages.first() 

    const data = {
      content: last.content,
      images: [...last.attachments.values()].map(a => a.url)
    }

    if (!data.content) {
      data.content = ""
    }
    console.log(data)
    res.json(data)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erreur lors de la récupération du message' })
  }
})


app.listen(PORT, () => {
  console.log('Server running on port ' + PORT)
})
