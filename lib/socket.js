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
import { readFile } from "fs/promises"
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
  isJidBroadcast,
  isJidGroup,
} = baileys

// Configuration améliorée
const CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 10,
  RECONNECT_DELAY_BASE: 3000,
  RECONNECT_DELAY_MAX: 30000,
  CONNECTION_TIMEOUT: 60000,
  PAIRING_TIMEOUT: 120000,
  SESSION_CLEANUP_INTERVAL: 300000, // 5 minutes
  PRESENCE_UPDATE_INTERVAL: 60000,
  DATABASE_SAVE_INTERVAL: 30000,
}

const pairingCode = process.argv.includes("--qr") ? false : process.argv.includes("--pairing-code") || true

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve))

// Variables globales améliorées
let pairingStarted = false
let connectionTimeout
let reconnectAttempts = 0
let lastConnectionTime = 0
let isConnecting = false
let sessionCleanupInterval
let presenceInterval
let databaseSaveInterval

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url)))
const databaseInstance = new database(settings.database)
const msgRetryCounterCache = new NodeCache()
const groupCache = new NodeCache({
  stdTTL: 5 * 60,
  useClones: false,
})

// Gestionnaire d'erreurs global amélioré
const errorHandler = {
  handleSessionError: (error) => {
    console.log(chalk.yellow("🔧 Session error detected:"), error.message)

    if (
      error.message?.includes("Bad MAC") ||
      error.message?.includes("Failed to decrypt") ||
      error.message?.includes("session")
    ) {
      console.log(chalk.blue("🧹 Cleaning corrupted session files..."))
      try {
        // Nettoyer les fichiers de session corrompus
        exec('find ./rav -name "session-*.json" -delete', (err) => {
          if (!err) {
            console.log(chalk.green("✅ Session files cleaned successfully"))
          }
        })

        // Nettoyer les credentials si nécessaire
        if (error.message?.includes("Bad MAC")) {
          exec("rm -f ./rav/creds.json", (err) => {
            if (!err) {
              console.log(chalk.green("✅ Corrupted credentials removed"))
            }
          })
        }
      } catch (cleanupError) {
        console.error("Error during cleanup:", cleanupError)
      }

      return true // Indique qu'une action de nettoyage a été prise
    }

    return false
  },

  handleSerializationError: (error) => {
    if (error.message?.includes("Serialize is not defined")) {
      console.log(chalk.yellow("🔧 Serialization error detected, attempting to fix..."))
      // Redémarrer la connexion après une erreur de sérialisation
      setTimeout(() => {
        console.log(chalk.blue("🔄 Restarting due to serialization error..."))
        startRavBot()
      }, 5000)
      return true
    }
    return false
  },
}

// Gestionnaire de reconnexion intelligent
const reconnectionManager = {
  shouldReconnect: (statusCode) => {
    const reconnectableCodes = [
      DisconnectReason.connectionLost,
      DisconnectReason.connectionClosed,
      DisconnectReason.restartRequired,
      DisconnectReason.timedOut,
    ]
    return reconnectableCodes.includes(statusCode)
  },

  shouldClearSession: (statusCode) => {
    const clearSessionCodes = [
      DisconnectReason.badSession,
      DisconnectReason.connectionReplaced,
      DisconnectReason.forbidden,
      DisconnectReason.multideviceMismatch,
      DisconnectReason.loggedOut,
    ]
    return clearSessionCodes.includes(statusCode)
  },

  getReconnectDelay: () => {
    const delay = Math.min(CONFIG.RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts), CONFIG.RECONNECT_DELAY_MAX)
    return delay + Math.random() * 1000 // Ajouter du jitter
  },

  reset: () => {
    reconnectAttempts = 0
  },
}

server.listen(PORT, () => {
  console.log(chalk.green(`🚀 Server listening on port ${PORT}`))
})

async function startRavBot() {
  if (isConnecting) {
    console.log(chalk.yellow("⚠️ Connection already in progress, skipping..."))
    return
  }

  isConnecting = true

  try {
    const { state, saveCreds } = await useMultiFileAuthState("rav")
    const logger = pino({ level: "silent" })
    const { version } = await fetchLatestBaileysVersion() // Moved to top level

    // Initialisation de la base de données améliorée
    try {
      const dbData = await databaseInstance.read()
      if (dbData && Object.keys(dbData).length === 0) {
        global.db = {
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
          ...(dbData || {}),
        }
        await databaseInstance.write(global.db)
      } else {
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
      }

      // Sauvegarde automatique de la base de données
      if (databaseSaveInterval) clearInterval(databaseSaveInterval)
      databaseSaveInterval = setInterval(async () => {
        if (global.db) {
          try {
            await databaseInstance.write(global.db)
          } catch (error) {
            console.error("Database save error:", error)
          }
        }
      }, CONFIG.DATABASE_SAVE_INTERVAL)
    } catch (error) {
      console.error("Database initialization error:", error)
      process.exit(1)
    }

    const getMessage = async (key) => {
      try {
        if (store) {
          const message = await store.loadMessage(key.remoteJid, key.id)
          return message?.message || ""
        }
        return { conversation: "hi here" }
      } catch (error) {
        console.error("Error getting message:", error.message)
        return { conversation: "hi here" }
      }
    }

    const sock = WAConnection({
      logger: logger,
      getMessage: getMessage,
      syncFullHistory: false, // Désactivé pour éviter les problèmes de session
      maxMsgRetryCount: 5, // Réduit pour éviter les boucles
      msgRetryCounterCache: msgRetryCounterCache,
      retryRequestDelayMs: 10,
      connectTimeoutMs: CONFIG.CONNECTION_TIMEOUT,
      printQRInTerminal: false,
      browser: Browsers.ubuntu("Chrome"),
      generateHighQualityLinkPreview: true,
      cachedGroupMetadata: async (groupId) => groupCache.get(groupId),
      transactionOpts: {
        maxCommitRetries: 5,
        delayBetweenTriesMs: 10,
      },
      appStateMacVerification: {
        patch: false, // Désactivé pour éviter les erreurs MAC
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

    // Nettoyage automatique des sessions
    if (sessionCleanupInterval) clearInterval(sessionCleanupInterval)
    sessionCleanupInterval = setInterval(() => {
      try {
        exec('find ./rav -name "session-*.json" -mtime +1 -delete', (error) => {
          if (!error) {
            console.log(chalk.blue("🧹 Old session files cleaned"))
          }
        })
      } catch (error) {
        console.error("Session cleanup error:", error)
      }
    }, CONFIG.SESSION_CLEANUP_INTERVAL)

    const startPresenceUpdates = () => {
      if (presenceInterval) clearInterval(presenceInterval)
      presenceInterval = setInterval(() => {
        if (sock.user && sock.user.id) {
          try {
            sock.sendPresenceUpdate("available")
          } catch (error) {
            console.error("Presence update error:", error)
          }
        }
      }, CONFIG.PRESENCE_UPDATE_INTERVAL)
    }

    sock.ev.on("connection.update", async (update) => {
      const { qr, connection, lastDisconnect, isNewLogin, receivedPendingNotifications } = update

      console.log(chalk.cyan("Connection update:"), chalk.yellow(connection || "unknown"))

      // Clear timeout si connexion réussie
      if (connectionTimeout && connection !== "connecting") {
        clearTimeout(connectionTimeout)
        connectionTimeout = null
      }

      // Gestion des erreurs de session améliorée
      if (lastDisconnect?.error) {
        const handled =
          errorHandler.handleSessionError(lastDisconnect.error) ||
          errorHandler.handleSerializationError(lastDisconnect.error)

        if (handled) {
          console.log(chalk.green("✅ Error handled automatically"))
        }
      }

      if (connection === "connecting") {
        console.log(chalk.blue("📡 Connecting to WhatsApp..."))

        // Timeout pour la connexion
        connectionTimeout = setTimeout(() => {
          console.log(chalk.yellow("⏰ Connection timeout reached"))
          sock.end()
          setTimeout(() => {
            isConnecting = false
            startRavBot()
          }, 5000)
        }, CONFIG.CONNECTION_TIMEOUT)

        // Gestion du pairing code améliorée
        if (pairingCode && !sock.authState.creds.registered && !pairingStarted) {
          pairingStarted = true

          setTimeout(async () => {
            try {
              let phoneNumber = settings.bot.number

              if (!phoneNumber) {
                phoneNumber = await question(chalk.yellow("Please enter your WhatsApp number: "))
              }

              phoneNumber = phoneNumber.replace(/[^0-9]/g, "")

              if (phoneNumber.length < 6) {
                console.log(chalk.red("❌ Invalid phone number format"))
                console.log(chalk.yellow("💡 Example: 33612345678 (country code + number)"))
                pairingStarted = false
                return
              }

              console.log(chalk.blue("📱 Requesting pairing code..."))

              const pairingCodeResult = await sock.requestPairingCode(phoneNumber)

              console.log("")
              console.log(chalk.green.bold("════════════════════════════════════════"))
              console.log(chalk.green.bold("🔗 Your Pairing Code: ") + chalk.yellow.bold(pairingCodeResult))
              console.log(chalk.green.bold("════════════════════════════════════════"))
              console.log(chalk.cyan("📱 1. Open WhatsApp on your phone"))
              console.log(chalk.cyan("⚙️  2. Go to Settings > Linked Devices"))
              console.log(chalk.cyan('🔗 3. Tap "Link a Device"'))
              console.log(chalk.cyan('📞 4. Tap "Link with phone number instead"'))
              console.log(chalk.cyan("🔢 5. Enter the code above"))
              console.log(chalk.green.bold("════════════════════════════════════════"))
              console.log("")
            } catch (error) {
              console.error(chalk.red("❌ Error requesting pairing code:"), error.message)
              pairingStarted = false

              // Retry avec délai
              setTimeout(() => {
                console.log(chalk.blue("🔄 Retrying pairing process..."))
                isConnecting = false
                startRavBot()
              }, 10000)
            }
          }, 4000)
        }
      }

      if (connection === "close") {
        isConnecting = false
        const statusCode = new Boom(lastDisconnect?.error)?.output.statusCode

        console.log(chalk.red("❌ Connection closed. Status code:"), statusCode)

        if (reconnectionManager.shouldReconnect(statusCode)) {
          reconnectAttempts++

          if (reconnectAttempts <= CONFIG.MAX_RECONNECT_ATTEMPTS) {
            const delay = reconnectionManager.getReconnectDelay()
            console.log(
              chalk.yellow(
                `🔄 Reconnection attempt ${reconnectAttempts}/${CONFIG.MAX_RECONNECT_ATTEMPTS} in ${Math.round(delay / 1000)}s...`,
              ),
            )

            setTimeout(() => {
              startRavBot()
            }, delay)
          } else {
            console.log(chalk.red("❌ Maximum reconnection attempts reached"))
            process.exit(1)
          }
        } else if (reconnectionManager.shouldClearSession(statusCode)) {
          console.log(chalk.red("🚫 Session invalid. Clearing credentials..."))

          try {
            exec("rm -rf rav/*", (error) => {
              if (!error) {
                console.log(chalk.green("✅ Session cleared successfully"))
                console.log(chalk.blue("💡 Please restart the bot to create a new session"))
                process.exit(0)
              }
            })
          } catch (error) {
            console.error("Error clearing session:", error)
            process.exit(1)
          }
        } else {
          console.log(chalk.red("❓ Unknown disconnect reason:"), statusCode)
          setTimeout(() => {
            isConnecting = false
            startRavBot()
          }, 5000)
        }
      }

      if (connection === "open") {
        isConnecting = false
        reconnectionManager.reset()
        lastConnectionTime = Date.now()

        console.log(chalk.green("✅ Successfully connected to WhatsApp!"))
        console.log(chalk.cyan("📱 Bot info:"), {
          name: sock.user.name || "Unknown",
          number: sock.user.id.split(":")[0] || "Unknown",
        })

        try {
          if (settings.creator) {
            await sock.sendMessage(settings.creator, {
              text: `[🃏] ${settings.bot.name} Connected Successfully!\n\n⏰ Connected at: ${new Date().toLocaleString()}\n🔄 Reconnect attempts: ${reconnectAttempts}`,
            })
          }
        } catch (error) {
          console.log(chalk.yellow("⚠️ Could not send connection message to creator"))
        }

        startPresenceUpdates()
        const decodedJid = await sock.decodeJid(sock.user.id)
        joinNewsletterAndWelcome(sock, decodedJid)
      }

      if (isNewLogin) {
        console.log(chalk.green("🆕 New device login detected"))
      }

      if (receivedPendingNotifications) {
        console.log(chalk.blue("📥 Processing pending notifications..."))
        sock.ev.flush()
      }
    })

    // Gestionnaires d'événements améliorés
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
          console.error("Contact update error:", error)
        }
      }
    })

    sock.ev.on("call", async (calls) => {
      try {
        const decodedJid = await sock.decodeJid(sock.user.id)

        if (global.db?.set?.[decodedJid]?.anticall) {
          for (const call of calls) {
            if (call.status === "offer") {
              const message = await sock.sendMessage(call.remoteJid, {
                text: `Pour le moment, nous ne sommes pas en mesure d'accepter les appels ${call.isVideo ? "vidéo" : "audio"}.\n\nSi @${call.from.split("@")[0]} avez besoin d'aide, veuillez contacter le propriétaire :)`,
                mentions: [call.remoteJid],
              })

              await sock.sendContact(call.remoteJid, settings.owner, message)
              await sock.rejectCall(call.id, call.remoteJid)
            }
          }
        }
      } catch (error) {
        console.error("Error handling call:", error)
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
          console.error("Message processing error:", error)
        }
      }
    })

    sock.ev.on("groups.update", async (groups) => {
      try {
        await GroupCacheUpdate(sock, groups, store, groupCache)
      } catch (error) {
        console.error("Error in groups.update:", error)
      }
    })

    sock.ev.on("group-participants.update", async (participants) => {
      try {
        await GroupParticipantsUpdate(sock, participants, store, groupCache)
      } catch (error) {
        console.error("Error in group-participants.update:", error)
      }
    })

    // Gestionnaire d'erreurs global pour les rejets non gérés
    process.removeAllListeners("unhandledRejection")
    process.on("unhandledRejection", (reason, promise) => {
      if (
        reason?.message?.includes("Bad MAC") ||
        reason?.message?.includes("Failed to decrypt") ||
        reason?.message?.includes("Serialize is not defined")
      ) {
        const handled = errorHandler.handleSessionError(reason) || errorHandler.handleSerializationError(reason)

        if (handled) {
          console.log(chalk.green("✅ Unhandled rejection resolved automatically"))
          return
        }
      }

      console.error(chalk.red("❌ Unhandled Rejection:"), reason)
    })

    return sock
  } catch (error) {
    isConnecting = false
    console.error(chalk.red("❌ Failed to start bot:"), error)

    // Retry après erreur
    setTimeout(() => {
      console.log(chalk.blue("🔄 Retrying bot startup..."))
      startRavBot()
    }, 10000)
  }
}

async function joinNewsletterAndWelcome(sock, decodedJid) {
  try {
    // Rejoindre le newsletter
    if (settings.channel?.length > 0 && settings.channel.includes("@newsletter")) {
      await sock.newsletterMsg("120363400575205721@newsletter", { type: "follow" }).catch(() => {})
    }

    // Message de bienvenue amélioré
    const up = `*🎉 Connexion réussie !*

*『${settings.bot.name}』 est maintenant en ligne ! 🚀*

*📋 Informations :*
• Préfixe : \`${settings.PREFIX}\`
• Version : Améliorée v2.0
• Statut : ✅ Connecté

*🔧 Améliorations :*
• ✅ Gestion d'erreurs robuste
• ✅ Reconnexion automatique intelligente  
• ✅ Sessions sécurisées
• ✅ Performance optimisée

*🌟 Tapez \`${settings.PREFIX}menu\` pour commencer !*

> © Powered by ${settings.bot.author}`

    await sock.sendMessage(decodedJid, {
      image: { url: `https://files.catbox.moe/4c8ql3.jpg` },
      caption: up,
    })

    console.log(chalk.green("✅ Welcome message sent successfully!"))
  } catch (error) {
    console.error("Error joining newsletter or sending welcome message:", error)
  }
}

// Nettoyage lors de l'arrêt
process.on("SIGINT", () => {
  console.log(chalk.yellow("📴 Shutting down gracefully..."))

  if (sessionCleanupInterval) clearInterval(sessionCleanupInterval)
  if (presenceInterval) clearInterval(presenceInterval)
  if (databaseSaveInterval) clearInterval(databaseSaveInterval)

  process.exit(0)
})

export { databaseInstance, msgRetryCounterCache, joinNewsletterAndWelcome }

startRavBot().catch((error) => {
  console.error("Failed to start bot:", error)
  process.exit(1)
})

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.log(`Address localhost:${PORT} in use. Please retry when the port is available!`)
    server.close()
  } else {
    console.error("Server error:", error)
  }
})
