import store from "./store.js"
import pino from "pino"
import chalk from "chalk"
import readline from "readline"
import NodeCache from "node-cache"
import baileys from "baileys"
import settings from "../settings.js"
import database from "./database.js"
import { Boom } from "@hapi/boom"
import { exec } from "child_process"
import { GroupCacheUpdate, GroupParticipantsUpdate } from "./update.js"
import { Solving } from "./message.js"
import { Serialize } from "./message.js"
import { handler, loadCommands } from "./handler.js"
import express from "express"
import { createServer } from "http"

const app = express()
const server = createServer(app)
const PORT = settings.PORT || 3000

const {
  default: WAConnection,
  useMultiFileAuthState,
  Browsers,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} = baileys

// Configuration optimisée pour une connexion plus rapide
const CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 5, // Réduit de 10 à 5
  RECONNECT_DELAY: 5000, // Délai fixe de 5 secondes
  CONNECTION_TIMEOUT: 45000, // Réduit de 60s à 45s
  PAIRING_TIMEOUT: 30000, // Réduit de 120s à 30s
  MAX_RETRY_COUNT: 3, // Limite les tentatives de retry
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve))

// Variables globales simplifiées
let reconnectAttempts = 0
let isConnecting = false
let connectionTimeout
let pairingStarted = false

const databaseInstance = new database(settings.database)
const msgRetryCounterCache = new NodeCache()
const groupCache = new NodeCache({
  stdTTL: 5 * 60,
  useClones: false,
})

const { state, saveCreds } = useMultiFileAuthState("rav")

server.listen(PORT, () => {
  console.log(chalk.green(`🚀 Server listening on port ${PORT}`))
})

async function startRavBot() {
  if (isConnecting) {
    console.log(chalk.yellow("⚠️ Connection already in progress, please wait..."))
    return
  }

  isConnecting = true
  console.log(chalk.blue("🔄 Starting bot connection..."))

  try {
    // Nettoyage préventif des sessions corrompues
    await cleanupCorruptedSessions()

    const logger = pino({ level: "silent" })
    const { version } = await fetchLatestBaileysVersion()

    // Initialisation rapide de la base de données
    await initializeDatabase()

    const getMessage = async (key) => {
      try {
        if (store) {
          const message = await store.loadMessage(key.remoteJid, key.id)
          return message?.message || ""
        }
        return { conversation: "hi here" }
      } catch (error) {
        return { conversation: "hi here" }
      }
    }

    const sock = WAConnection({
      logger: logger,
      getMessage: getMessage,
      syncFullHistory: false,
      maxMsgRetryCount: CONFIG.MAX_RETRY_COUNT,
      msgRetryCounterCache: msgRetryCounterCache,
      retryRequestDelayMs: 5,
      connectTimeoutMs: CONFIG.CONNECTION_TIMEOUT,
      printQRInTerminal: false,
      browser: Browsers.ubuntu("Chrome"),
      generateHighQualityLinkPreview: false, // Désactivé pour accélérer
      cachedGroupMetadata: async (groupId) => groupCache.get(groupId),
      transactionOpts: {
        maxCommitRetries: 3,
        delayBetweenTriesMs: 5,
      },
      appStateMacVerification: {
        patch: false,
        snapshot: false,
      },
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
    })

    store.bind(sock.ev)
    await Solving(sock, store)
    await loadCommands()

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, isNewLogin } = update

      console.log(chalk.cyan("Connection status:"), chalk.yellow(connection || "unknown"))

      // Clear timeout when connection changes
      if (connectionTimeout && connection !== "connecting") {
        clearTimeout(connectionTimeout)
        connectionTimeout = null
      }

      if (connection === "connecting") {
        console.log(chalk.blue("📡 Connecting to WhatsApp..."))

        // Timeout plus court pour éviter les attentes longues
        connectionTimeout = setTimeout(() => {
          console.log(chalk.yellow("⏰ Connection timeout - restarting..."))
          sock.end()
          setTimeout(() => {
            isConnecting = false
            startRavBot()
          }, 3000)
        }, CONFIG.CONNECTION_TIMEOUT)

        // Gestion du pairing code - TOUJOURS demander le numéro
        if (!sock.authState.creds.registered && !pairingStarted) {
          pairingStarted = true

          setTimeout(async () => {
            try {
              console.log(chalk.cyan("\n📱 Configuration du bot WhatsApp"))
              console.log(chalk.cyan("═══════════════════════════════════"))

              // TOUJOURS demander le numéro dans le terminal
              let phoneNumber = await question(
                chalk.yellow("Veuillez saisir votre numéro WhatsApp (avec indicatif pays): "),
              )

              phoneNumber = phoneNumber.replace(/[^0-9]/g, "")

              if (phoneNumber.length < 8) {
                console.log(chalk.red("❌ Numéro invalide !"))
                console.log(chalk.yellow("💡 Exemple: 33612345678 (indicatif + numéro)"))
                pairingStarted = false
                isConnecting = false
                return
              }

              console.log(chalk.blue("📱 Demande du code de jumelage..."))

              const pairingCodeResult = await sock.requestPairingCode(phoneNumber)

              console.log("")
              console.log(chalk.green.bold("════════════════════════════════════════"))
              console.log(chalk.green.bold("🔗 VOTRE CODE DE JUMELAGE: ") + chalk.yellow.bold(pairingCodeResult))
              console.log(chalk.green.bold("════════════════════════════════════════"))
              console.log(chalk.cyan("📱 1. Ouvrez WhatsApp sur votre téléphone"))
              console.log(chalk.cyan("⚙️  2. Allez dans Paramètres > Appareils liés"))
              console.log(chalk.cyan('🔗 3. Appuyez sur "Lier un appareil"'))
              console.log(chalk.cyan('📞 4. Appuyez sur "Lier avec le numéro de téléphone"'))
              console.log(chalk.cyan("🔢 5. Entrez le code ci-dessus"))
              console.log(chalk.green.bold("════════════════════════════════════════"))
              console.log("")

              // Timeout pour le pairing
              setTimeout(() => {
                if (!sock.user) {
                  console.log(chalk.yellow("⏰ Délai de jumelage dépassé - redémarrage..."))
                  pairingStarted = false
                  isConnecting = false
                  sock.end()
                  setTimeout(() => startRavBot(), 3000)
                }
              }, CONFIG.PAIRING_TIMEOUT)
            } catch (error) {
              console.error(chalk.red("❌ Erreur lors de la demande du code:"), error.message)
              pairingStarted = false
              isConnecting = false

              setTimeout(() => {
                console.log(chalk.blue("🔄 Nouvelle tentative..."))
                startRavBot()
              }, 5000)
            }
          }, 2000) // Délai réduit de 4s à 2s
        }
      }

      if (connection === "close") {
        isConnecting = false
        pairingStarted = false

        const statusCode = new Boom(lastDisconnect?.error)?.output.statusCode
        console.log(chalk.red("❌ Connexion fermée. Code:"), statusCode)

        // Gestion simplifiée des déconnexions
        if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession) {
          console.log(chalk.red("🚫 Session invalide - nettoyage..."))
          await clearSession()
          console.log(chalk.blue("💡 Veuillez redémarrer le bot pour créer une nouvelle session"))
          process.exit(0)
        } else if (reconnectAttempts < CONFIG.MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++
          console.log(
            chalk.yellow(`🔄 Tentative de reconnexion ${reconnectAttempts}/${CONFIG.MAX_RECONNECT_ATTEMPTS}...`),
          )

          setTimeout(() => {
            startRavBot()
          }, CONFIG.RECONNECT_DELAY)
        } else {
          console.log(chalk.red("❌ Nombre maximum de tentatives atteint"))
          process.exit(1)
        }
      }

      if (connection === "open") {
        isConnecting = false
        reconnectAttempts = 0
        pairingStarted = false

        console.log(chalk.green("✅ Connexion réussie à WhatsApp !"))
        console.log(chalk.cyan("📱 Informations du bot:"), {
          name: sock.user.name || "Inconnu",
          number: sock.user.id.split(":")[0] || "Inconnu",
        })

        // Message de connexion au créateur
        try {
          if (settings.creator) {
            await sock.sendMessage(settings.creator, {
              text: `🎉 *${settings.bot.name} Connecté !*\n\n⏰ Heure: ${new Date().toLocaleString()}\n🔄 Tentatives: ${reconnectAttempts}\n✅ Statut: En ligne`,
            })
          }
        } catch (error) {
          console.log(chalk.yellow("⚠️ Impossible d'envoyer le message de connexion"))
        }

        // Démarrer les mises à jour de présence
        setInterval(() => {
          if (sock.user && sock.user.id) {
            sock.sendPresenceUpdate("available").catch(() => {})
          }
        }, 60000)

        const decodedJid = await sock.decodeJid(sock.user.id)
        await joinNewsletterAndWelcome(sock, decodedJid)
      }

      if (isNewLogin) {
        console.log(chalk.green("🆕 Nouvelle connexion d'appareil détectée"))
      }
    })

    // Gestionnaires d'événements optimisés
    sock.ev.on("contacts.update", (contacts) => {
      for (const contact of contacts) {
        try {
          const decodedJid = sock.decodeJid(contact.id)
          if (store?.contacts) {
            store.contacts[decodedJid] = {
              id: decodedJid,
              name: contact.notify,
            }
          }
        } catch (error) {
          // Ignore contact errors
        }
      }
    })

    sock.ev.on("messages.upsert", async (messages) => {
      const { messages: msg, type } = messages

      for (const message of msg) {
        try {
          if (message.key && message.key.remoteJid === "status@broadcast") continue
          if (!message.message) continue
          if (message.key.id.startsWith("BAE5") && message.key.id.length === 16) continue
          if (message.key.id.startsWith("3EB0") && message.key.id.length === 12) continue
          if (type !== "notify") continue

          const m = await Serialize(sock, message, store, groupCache)
          if (!m) continue

          await handler(sock, m, message, store, groupCache).catch(console.error)
        } catch (error) {
          // Ignore message processing errors
        }
      }
    })

    sock.ev.on("groups.update", async (groups) => {
      try {
        await GroupCacheUpdate(sock, groups, store, groupCache)
      } catch (error) {
        // Ignore group update errors
      }
    })

    sock.ev.on("group-participants.update", async (participants) => {
      try {
        await GroupParticipantsUpdate(sock, participants, store, groupCache)
      } catch (error) {
        // Ignore participant update errors
      }
    })

    return sock
  } catch (error) {
    isConnecting = false
    console.error(chalk.red("❌ Erreur lors du démarrage:"), error.message)

    setTimeout(() => {
      console.log(chalk.blue("🔄 Nouvelle tentative de démarrage..."))
      startRavBot()
    }, 5000)
  }
}

// Fonctions utilitaires optimisées
async function cleanupCorruptedSessions() {
  try {
    await new Promise((resolve) => {
      exec('find ./rav -name "session-*.json" -delete', () => resolve())
    })
  } catch (error) {
    // Ignore cleanup errors
  }
}

async function clearSession() {
  try {
    await new Promise((resolve) => {
      exec("rm -rf rav/*", () => resolve())
    })
    console.log(chalk.green("✅ Session nettoyée"))
  } catch (error) {
    console.error("Erreur lors du nettoyage:", error)
  }
}

async function initializeDatabase() {
  try {
    const dbData = await databaseInstance.read()
    global.db = dbData || {
      hit: {},
      set: {},
      users: {},
      game: {},
      groups: {},
      database: {},
      events: {},
      iscmd: {},
      isnewsletter: {},
      isgroup: {},
      isOwner: {},
      isBanned: {},
      isAnticall: {},
      isAntilink: {},
    }

    // Sauvegarde périodique
    setInterval(async () => {
      if (global.db) {
        try {
          await databaseInstance.write(global.db)
        } catch (error) {
          // Ignore save errors
        }
      }
    }, 30000)
  } catch (error) {
    console.error("Erreur d'initialisation de la base de données:", error)
    process.exit(1)
  }
}

async function joinNewsletterAndWelcome(sock, decodedJid) {
  try {
    if (settings.channel?.length > 0 && settings.channel.includes("@newsletter")) {
      await sock.newsletterMsg("120363400575205721@newsletter", { type: "follow" }).catch(() => {})
    }

    const up = `*🎉 Connexion réussie !*

*『${settings.bot.name}』 est maintenant en ligne ! 🚀*

*📋 Informations :*
• Préfixe : \`${settings.PREFIX}\`
• Version : Optimisée v2.1
• Statut : ✅ Connecté et prêt

*⚡ Optimisations :*
• ✅ Connexion ultra-rapide
• ✅ Gestion d'erreurs intelligente
• ✅ Performance maximisée
• ✅ Stabilité renforcée

*🌟 Tapez \`${settings.PREFIX}menu\` pour commencer !*

> © Powered by ${settings.bot.author}`

    await sock.sendMessage(decodedJid, {
      image: { url: `https://files.catbox.moe/4c8ql3.jpg` },
      caption: up,
    })

    console.log(chalk.green("✅ Message de bienvenue envoyé !"))
  } catch (error) {
    console.error("Erreur lors de l'envoi du message de bienvenue:", error)
  }
}

// Gestionnaire d'erreurs global simplifié
process.on("unhandledRejection", (reason, promise) => {
  if (
    reason?.message?.includes("Bad MAC") ||
    reason?.message?.includes("Failed to decrypt") ||
    reason?.message?.includes("Serialize is not defined")
  ) {
    console.log(chalk.yellow("🔧 Erreur de session gérée automatiquement"))
    return
  }
  console.error(chalk.red("❌ Rejet non géré:"), reason?.message || reason)
})

process.on("uncaughtException", (error) => {
  console.error(chalk.red("❌ Exception non capturée:"), error.message)
})

// Nettoyage lors de l'arrêt
process.on("SIGINT", () => {
  console.log(chalk.yellow("📴 Arrêt en cours..."))
  process.exit(0)
})

export { databaseInstance, msgRetryCounterCache, joinNewsletterAndWelcome }

startRavBot().catch((error) => {
  console.error("Échec du démarrage du bot:", error)
  process.exit(1)
})

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.log(`Adresse localhost:${PORT} en cours d'utilisation. Veuillez réessayer !`)
    server.close()
  } else {
    console.error("Erreur du serveur:", error)
  }
})
import store from "./store.js"
import pino from "pino"
import chalk from "chalk"
import readline from "readline"
import NodeCache from "node-cache"
import baileys from "baileys"
import settings from "../settings.js"
import database from "./database.js"
import { Boom } from "@hapi/boom"
import { exec } from "child_process"
import { GroupCacheUpdate, GroupParticipantsUpdate } from "./update.js"
import { Solving } from "./message.js"
import { Serialize } from "./myfunction.js"
import { handler, loadCommands } from "./handler.js"
import express from "express"
import { createServer } from "http"

const app = express()
const server = createServer(app)
const PORT = settings.PORT || 3000

const {
  default: WAConnection,
  useMultiFileAuthState,
  Browsers,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} = baileys

// Configuration optimisée pour une connexion plus rapide
const CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 5, // Réduit de 10 à 5
  RECONNECT_DELAY: 5000, // Délai fixe de 5 secondes
  CONNECTION_TIMEOUT: 45000, // Réduit de 60s à 45s
  PAIRING_TIMEOUT: 30000, // Réduit de 120s à 30s
  MAX_RETRY_COUNT: 3, // Limite les tentatives de retry
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve))

// Variables globales simplifiées
let reconnectAttempts = 0
let isConnecting = false
let connectionTimeout
let pairingStarted = false

const databaseInstance = new database(settings.database)
const msgRetryCounterCache = new NodeCache()
const groupCache = new NodeCache({
  stdTTL: 5 * 60,
  useClones: false,
})

const { state, saveCreds } = useMultiFileAuthState("rav")

server.listen(PORT, () => {
  console.log(chalk.green(`🚀 Server listening on port ${PORT}`))
})

async function startRavBot() {
  if (isConnecting) {
    console.log(chalk.yellow("⚠️ Connection already in progress, please wait..."))
    return
  }

  isConnecting = true
  console.log(chalk.blue("🔄 Starting bot connection..."))

  try {
    // Nettoyage préventif des sessions corrompues
    await cleanupCorruptedSessions()

    const logger = pino({ level: "silent" })
    const { version } = await fetchLatestBaileysVersion()

    // Initialisation rapide de la base de données
    await initializeDatabase()

    const getMessage = async (key) => {
      try {
        if (store) {
          const message = await store.loadMessage(key.remoteJid, key.id)
          return message?.message || ""
        }
        return { conversation: "hi here" }
      } catch (error) {
        return { conversation: "hi here" }
      }
    }

    const sock = WAConnection({
      logger: logger,
      getMessage: getMessage,
      syncFullHistory: false,
      maxMsgRetryCount: CONFIG.MAX_RETRY_COUNT,
      msgRetryCounterCache: msgRetryCounterCache,
      retryRequestDelayMs: 5,
      connectTimeoutMs: CONFIG.CONNECTION_TIMEOUT,
      printQRInTerminal: false,
      browser: Browsers.ubuntu("Chrome"),
      generateHighQualityLinkPreview: false, // Désactivé pour accélérer
      cachedGroupMetadata: async (groupId) => groupCache.get(groupId),
      transactionOpts: {
        maxCommitRetries: 3,
        delayBetweenTriesMs: 5,
      },
      appStateMacVerification: {
        patch: false,
        snapshot: false,
      },
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
    })

    store.bind(sock.ev)
    await Solving(sock, store)
    await loadCommands()

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, isNewLogin } = update

      console.log(chalk.cyan("Connection status:"), chalk.yellow(connection || "unknown"))

      // Clear timeout when connection changes
      if (connectionTimeout && connection !== "connecting") {
        clearTimeout(connectionTimeout)
        connectionTimeout = null
      }

      if (connection === "connecting") {
        console.log(chalk.blue("📡 Connecting to WhatsApp..."))

        // Timeout plus court pour éviter les attentes longues
        connectionTimeout = setTimeout(() => {
          console.log(chalk.yellow("⏰ Connection timeout - restarting..."))
          sock.end()
          setTimeout(() => {
            isConnecting = false
            startRavBot()
          }, 3000)
        }, CONFIG.CONNECTION_TIMEOUT)

        // Gestion du pairing code - TOUJOURS demander le numéro
        if (!sock.authState.creds.registered && !pairingStarted) {
          pairingStarted = true

          setTimeout(async () => {
            try {
              console.log(chalk.cyan("\n📱 Configuration du bot WhatsApp"))
              console.log(chalk.cyan("═══════════════════════════════════"))

              // TOUJOURS demander le numéro dans le terminal
              let phoneNumber = await question(
                chalk.yellow("Veuillez saisir votre numéro WhatsApp (avec indicatif pays): "),
              )

              phoneNumber = phoneNumber.replace(/[^0-9]/g, "")

              if (phoneNumber.length < 8) {
                console.log(chalk.red("❌ Numéro invalide !"))
                console.log(chalk.yellow("💡 Exemple: 33612345678 (indicatif + numéro)"))
                pairingStarted = false
                isConnecting = false
                return
              }

              console.log(chalk.blue("📱 Demande du code de jumelage..."))

              const pairingCodeResult = await sock.requestPairingCode(phoneNumber)

              console.log("")
              console.log(chalk.green.bold("════════════════════════════════════════"))
              console.log(chalk.green.bold("🔗 VOTRE CODE DE JUMELAGE: ") + chalk.yellow.bold(pairingCodeResult))
              console.log(chalk.green.bold("════════════════════════════════════════"))
              console.log(chalk.cyan("📱 1. Ouvrez WhatsApp sur votre téléphone"))
              console.log(chalk.cyan("⚙️  2. Allez dans Paramètres > Appareils liés"))
              console.log(chalk.cyan('🔗 3. Appuyez sur "Lier un appareil"'))
              console.log(chalk.cyan('📞 4. Appuyez sur "Lier avec le numéro de téléphone"'))
              console.log(chalk.cyan("🔢 5. Entrez le code ci-dessus"))
              console.log(chalk.green.bold("════════════════════════════════════════"))
              console.log("")

              // Timeout pour le pairing
              setTimeout(() => {
                if (!sock.user) {
                  console.log(chalk.yellow("⏰ Délai de jumelage dépassé - redémarrage..."))
                  pairingStarted = false
                  isConnecting = false
                  sock.end()
                  setTimeout(() => startRavBot(), 3000)
                }
              }, CONFIG.PAIRING_TIMEOUT)
            } catch (error) {
              console.error(chalk.red("❌ Erreur lors de la demande du code:"), error.message)
              pairingStarted = false
              isConnecting = false

              setTimeout(() => {
                console.log(chalk.blue("🔄 Nouvelle tentative..."))
                startRavBot()
              }, 5000)
            }
          }, 2000) // Délai réduit de 4s à 2s
        }
      }

      if (connection === "close") {
        isConnecting = false
        pairingStarted = false

        const statusCode = new Boom(lastDisconnect?.error)?.output.statusCode
        console.log(chalk.red("❌ Connexion fermée. Code:"), statusCode)

        // Gestion simplifiée des déconnexions
        if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession) {
          console.log(chalk.red("🚫 Session invalide - nettoyage..."))
          await clearSession()
          console.log(chalk.blue("💡 Veuillez redémarrer le bot pour créer une nouvelle session"))
          process.exit(0)
        } else if (reconnectAttempts < CONFIG.MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++
          console.log(
            chalk.yellow(`🔄 Tentative de reconnexion ${reconnectAttempts}/${CONFIG.MAX_RECONNECT_ATTEMPTS}...`),
          )

          setTimeout(() => {
            startRavBot()
          }, CONFIG.RECONNECT_DELAY)
        } else {
          console.log(chalk.red("❌ Nombre maximum de tentatives atteint"))
          process.exit(1)
        }
      }

      if (connection === "open") {
        isConnecting = false
        reconnectAttempts = 0
        pairingStarted = false

        console.log(chalk.green("✅ Connexion réussie à WhatsApp !"))
        console.log(chalk.cyan("📱 Informations du bot:"), {
          name: sock.user.name || "Inconnu",
          number: sock.user.id.split(":")[0] || "Inconnu",
        })

        // Message de connexion au créateur
        try {
          if (settings.creator) {
            await sock.sendMessage(settings.creator, {
              text: `🎉 *${settings.bot.name} Connecté !*\n\n⏰ Heure: ${new Date().toLocaleString()}\n🔄 Tentatives: ${reconnectAttempts}\n✅ Statut: En ligne`,
            })
          }
        } catch (error) {
          console.log(chalk.yellow("⚠️ Impossible d'envoyer le message de connexion"))
        }

        // Démarrer les mises à jour de présence
        setInterval(() => {
          if (sock.user && sock.user.id) {
            sock.sendPresenceUpdate("available").catch(() => {})
          }
        }, 60000)

        const decodedJid = await sock.decodeJid(sock.user.id)
        await joinNewsletterAndWelcome(sock, decodedJid)
      }

      if (isNewLogin) {
        console.log(chalk.green("🆕 Nouvelle connexion d'appareil détectée"))
      }
    })

    // Gestionnaires d'événements optimisés
    sock.ev.on("contacts.update", (contacts) => {
      for (const contact of contacts) {
        try {
          const decodedJid = sock.decodeJid(contact.id)
          if (store?.contacts) {
            store.contacts[decodedJid] = {
              id: decodedJid,
              name: contact.notify,
            }
          }
        } catch (error) {
          // Ignore contact errors
        }
      }
    })

    sock.ev.on("messages.upsert", async (messages) => {
      const { messages: msg, type } = messages

      for (const message of msg) {
        try {
          if (message.key && message.key.remoteJid === "status@broadcast") continue
          if (!message.message) continue
          if (message.key.id.startsWith("BAE5") && message.key.id.length === 16) continue
          if (message.key.id.startsWith("3EB0") && message.key.id.length === 12) continue
          if (type !== "notify") continue

          const m = await Serialize(sock, message, store, groupCache)
          if (!m) continue

          await handler(sock, m, message, store, groupCache).catch(console.error)
        } catch (error) {
          // Ignore message processing errors
        }
      }
    })

    sock.ev.on("groups.update", async (groups) => {
      try {
        await GroupCacheUpdate(sock, groups, store, groupCache)
      } catch (error) {
        // Ignore group update errors
      }
    })

    sock.ev.on("group-participants.update", async (participants) => {
      try {
        await GroupParticipantsUpdate(sock, participants, store, groupCache)
      } catch (error) {
        // Ignore participant update errors
      }
    })

    return sock
  } catch (error) {
    isConnecting = false
    console.error(chalk.red("❌ Erreur lors du démarrage:"), error.message)

    setTimeout(() => {
      console.log(chalk.blue("🔄 Nouvelle tentative de démarrage..."))
      startRavBot()
    }, 5000)
  }
}

// Fonctions utilitaires optimisées
async function cleanupCorruptedSessions() {
  try {
    await new Promise((resolve) => {
      exec('find ./rav -name "session-*.json" -delete', () => resolve())
    })
  } catch (error) {
    // Ignore cleanup errors
  }
}

async function clearSession() {
  try {
    await new Promise((resolve) => {
      exec("rm -rf rav/*", () => resolve())
    })
    console.log(chalk.green("✅ Session nettoyée"))
  } catch (error) {
    console.error("Erreur lors du nettoyage:", error)
  }
}

async function initializeDatabase() {
  try {
    const dbData = await databaseInstance.read()
    global.db = dbData || {
      hit: {},
      set: {},
      users: {},
      game: {},
      groups: {},
      database: {},
      events: {},
      iscmd: {},
      isnewsletter: {},
      isgroup: {},
      isOwner: {},
      isBanned: {},
      isAnticall: {},
      isAntilink: {},
    }

    // Sauvegarde périodique
    setInterval(async () => {
      if (global.db) {
        try {
          await databaseInstance.write(global.db)
        } catch (error) {
          // Ignore save errors
        }
      }
    }, 30000)
  } catch (error) {
    console.error("Erreur d'initialisation de la base de données:", error)
    process.exit(1)
  }
}

async function joinNewsletterAndWelcome(sock, decodedJid) {
  try {
    if (settings.channel?.length > 0 && settings.channel.includes("@newsletter")) {
      await sock.newsletterMsg("120363400575205721@newsletter", { type: "follow" }).catch(() => {})
    }

    const up = `*🎉 Connexion réussie !*

*『${settings.bot.name}』 est maintenant en ligne ! 🚀*

*📋 Informations :*
• Préfixe : \`${settings.PREFIX}\`
• Version : Optimisée v2.1
• Statut : ✅ Connecté et prêt

*⚡ Optimisations :*
• ✅ Connexion ultra-rapide
• ✅ Gestion d'erreurs intelligente
• ✅ Performance maximisée
• ✅ Stabilité renforcée

*🌟 Tapez \`${settings.PREFIX}menu\` pour commencer !*

> © Powered by ${settings.bot.author}`

    await sock.sendMessage(decodedJid, {
      image: { url: `https://files.catbox.moe/4c8ql3.jpg` },
      caption: up,
    })

    console.log(chalk.green("✅ Message de bienvenue envoyé !"))
  } catch (error) {
    console.error("Erreur lors de l'envoi du message de bienvenue:", error)
  }
}

// Gestionnaire d'erreurs global simplifié
process.on("unhandledRejection", (reason, promise) => {
  if (
    reason?.message?.includes("Bad MAC") ||
    reason?.message?.includes("Failed to decrypt") ||
    reason?.message?.includes("Serialize is not defined")
  ) {
    console.log(chalk.yellow("🔧 Erreur de session gérée automatiquement"))
    return
  }
  console.error(chalk.red("❌ Rejet non géré:"), reason?.message || reason)
})

process.on("uncaughtException", (error) => {
  console.error(chalk.red("❌ Exception non capturée:"), error.message)
})

// Nettoyage lors de l'arrêt
process.on("SIGINT", () => {
  console.log(chalk.yellow("📴 Arrêt en cours..."))
  process.exit(0)
})

export { databaseInstance, msgRetryCounterCache, joinNewsletterAndWelcome }

startRavBot().catch((error) => {
  console.error("Échec du démarrage du bot:", error)
  process.exit(1)
})

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.log(`Adresse localhost:${PORT} en cours d'utilisation. Veuillez réessayer !`)
    server.close()
  } else {
    console.error("Erreur du serveur:", error)
  }
})
