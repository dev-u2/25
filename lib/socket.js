
import store from './store.js';
import fs from 'fs';
import pino from 'pino';
import chalk from 'chalk';
import readline from 'readline';
import NodeCache from 'node-cache';
import baileys from 'baileys';
import settings from '../settings.js';
import database from './database.js';
import qrcodeTerminal from 'qrcode-terminal';
import { Boom } from '@hapi/boom';
import awesomePhoneNumber from 'awesome-phonenumber';
import { exec } from 'child_process';
import { readFile } from 'fs/promises';
import { GroupCacheUpdate, GroupParticipantsUpdate, MessagesUpsert } from './update.js';
import { Solving } from './message.js';
import { generateMessageTag, getBuffer, getSizeMedia, fetchJson, sleep } from './myfunction.js';
import express from 'express';
import { createServer } from 'http';

const app = express();
const server = createServer(app);
const PORT = settings.PORT || 3000;

const {
  default: WAConnection,
  useMultiFileAuthState,
  Browsers,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} = baileys;

const pairingCode = process.argv.includes('--qr') ? false : process.argv.includes('--pairing-code') || true;

const rl = readline.createInterface({
  'input': process.stdin,
  'output': process.stdout
});

const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

let pairingStarted = false;
let connectionTimeout;

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const databaseInstance = new database(settings.database);
const msgRetryCounterCache = new NodeCache();
const groupCache = new NodeCache({
  'stdTTL': 5 * 60, // 5 minutes
  'useClones': false
});

server.listen(PORT, () => {
  console.log('App listened on port', PORT);
});

async function startRavBot() {
  const { state, saveCreds } = await useMultiFileAuthState('rav');
  const { version } = await fetchLatestBaileysVersion();
  const logger = pino({ 'level': 'silent' });
  
  try {
    const dbData = await databaseInstance.read();
    if (dbData && Object.keys(dbData).length === 0) {
      global.db = {
        'hit': {},
        'set': {},
        'users': {},
        'game': {},
        'groups': {},
        'database': {},
        'events': {},
        ...dbData || {}
      };
      await databaseInstance.write(global.db);
    } else {
      global.db = dbData || {
        'hit': {},
        'set': {},
        'users': {},
        'game': {},
        'groups': {},
        'database': {},
        'events': {}
      };
    }
    
    setInterval(async () => {
      if (global.db) {
        await databaseInstance.write(global.db);
      }
    }, 30 * 1000); // 30 seconds
    
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
  
  const getMessage = async (key) => {
    if (store) {
      const message = await store.loadMessage(key.remoteJid, key.id);
      return message?.message || '';
    }
    return { 'conversation': 'hi here' };
  };
  
  const sock = WAConnection({
    'logger': logger,
    'getMessage': getMessage,
    'syncFullHistory': true,
    'maxMsgRetryCount': 15,
    'msgRetryCounterCache': msgRetryCounterCache,
    'retryRequestDelayMs': 10,
    'connectTimeoutMs': 60000,
    'printQRInTerminal': false,
    'browser': Browsers.ubuntu('Chrome'),
    'generateHighQualityLinkPreview': true,
    'cachedGroupMetadata': async (groupId) => groupCache.get(groupId),
    'transactionOpts': {
      'maxCommitRetries': 10,
      'delayBetweenTriesMs': 10
    },
    'appStateMacVerification': {
      'patch': true,
      'snapshot': true
    },
    'auth': {
      'creds': state.creds,
      'keys': makeCacheableSignalKeyStore(state.keys, logger)
    }
  });
  
  store.bind(sock.ev);
  await Solving(sock, store);
  
  sock.ev.on('creds.update', saveCreds);
  
  let presenceInterval;
  
  const startPresenceUpdates = () => {
    if (presenceInterval) clearInterval(presenceInterval);
    presenceInterval = setInterval(() => {
      if (sock.user && sock.user.id) {
        sock.sendPresenceUpdate('available');
      }
    }, 60000);
  };
  
  sock.ev.on('connection.update', async (update) => {
    const { qr, connection, lastDisconnect, isNewLogin, receivedPendingNotifications } = update;
    
    console.log(chalk.cyan('Connection update:'), chalk.yellow(connection || 'unknown'));
    
    // Clear any existing timeout
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
    }
    
    // Set timeout for connection attempts
    if (connection === 'connecting') {
      console.log(chalk.blue('📡 Établissement de la connexion à WhatsApp...'));
      connectionTimeout = setTimeout(() => {
        console.log(chalk.yellow('⏰ Délai de connexion dépassé. Redémarrage...'));
        sock.end();
        setTimeout(() => startRavBot(), 3000);
      }, 120000); // 2 minutes timeout for pairing
    }
    
    if (connection === 'connecting' && pairingCode && !sock.authState.creds.registered && !pairingStarted) {
      pairingStarted = true;
      let phoneNumber;
      
      async function getPhoneNumber() {
        phoneNumber = settings.bot.number ? settings.bot.number : await question(chalk.yellow('Veuillez saisir votre numéro WhatsApp : '));
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (phoneNumber.length < 6) {
          console.log(chalk.bgBlack(chalk.redBright('Commencez par votre code pays WhatsApp') + chalk.whiteBright(',') + chalk.greenBright(' Exemple : 33612345678')));
          await getPhoneNumber();
        }
      }
      
      setTimeout(async () => {
        await getPhoneNumber();
        // Clean corrupted credentials
        try {
          await exec('rm -rf rav/creds.json');
          console.log('Cleaned old credentials');
        } catch (e) {}
        
        console.log('\nRequesting Pairing Code...');
        
        try {
          let pairingCodeResult = await sock.requestPairingCode(phoneNumber);
          console.log('');
          console.log(chalk.green.bold('════════════════════════════════════════'));
          console.log(chalk.green.bold('🔗 Your Pairing Code: ') + chalk.yellow.bold(pairingCodeResult));
          console.log(chalk.green.bold('════════════════════════════════════════'));
          console.log(chalk.cyan('📱 1. Open WhatsApp on your phone'));
          console.log(chalk.cyan('⚙️  2. Go to Settings > Linked Devices'));
          console.log(chalk.cyan('🔗 3. Tap "Link a Device"'));
          console.log(chalk.cyan('📞 4. Tap "Link with phone number instead"'));
          console.log(chalk.cyan('🔢 5. Enter the code above'));
          console.log(chalk.green.bold('════════════════════════════════════════'));
          console.log('');
        } catch (error) {
          console.error(chalk.red('❌ Error requesting pairing code:'), error.message);
          console.log(chalk.yellow('💡 Please restart the bot and try again.'));
          // Retry after error
          setTimeout(() => {
            console.log(chalk.blue('🔄 Retrying connection...'));
            startRavBot();
          }, 5000);
        }
      }, 4000);
    }
    
    if (connection == 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output.statusCode;
      
      console.log(chalk.red('❌ Connection closed. Status code:'), statusCode);
      
      if ([
          DisconnectReason.connectionLost,
          DisconnectReason.connectionClosed,
          DisconnectReason.restartRequired,
          DisconnectReason.timedOut
        ].includes(statusCode)) {
        console.log(chalk.yellow('🔄 Connection lost. Attempting to reconnect...'));
        setTimeout(() => startRavBot(), 3000);
      } else if ([
          DisconnectReason.badSession,
          DisconnectReason.connectionReplaced,
          DisconnectReason.forbidden,
          DisconnectReason.multideviceMismatch
        ].includes(statusCode)) {
        console.log(chalk.red('🚫 Session invalid. Clearing credentials...'));
        exec('rm -rf rav/*');
        console.log(chalk.blue('💡 Please restart the bot to create a new session'));
        process.exit(1);
      } else {
        console.log(chalk.red('❓ Unknown disconnect reason:'), statusCode);
        sock.end('Unknown DisconnectReason : ' + statusCode + '|' + connection);
      }
    }
    
    if (connection === 'open') {
      console.log(chalk.green('✅ Successfully connected to WhatsApp!'));
      console.log(chalk.cyan('📱 Bot info:'), {
        name: sock.user.name || 'Unknown',
        number: sock.user.id.split(':')[0] || 'Unknown'
      });
      
      try {
        if (settings.creator) {
          await sock.sendMessage(settings.creator, { 'text': '[🃏] Raven-MD Connected!' });
        }
      } catch (error) {
        console.log(chalk.yellow('⚠️ Could not send connection message to creator'));
      }
      startPresenceUpdates();
      
      const decodedJid = await sock.decodeJid(sock.user.id);
      
      if (global.db?.contacts?.[decodedJid] && !global.db?.contacts?.[decodedJid]?.channel) {
        if (settings.channel?.length > 0 && settings.channel.includes('@newsletter')) {
          await sock.newsletterMsg('120363400575205721@newsletter', { 'type': 'follow' }).catch(() => {});
          global.db.contacts[decodedJid].channel = true;
        }
      }
    }
    
    if (isNewLogin) {
      console.log(chalk.green('New device login detected'));
    }
    
    if (receivedPendingNotifications) {
      console.log('Please wait about 1 minute...');
      sock.ev.flush();
    }
  });
  
  sock.ev.on('contacts.update', (contacts) => {
    for (const contact of contacts) {
      const decodedJid = sock.decodeJid(contact.id);
      if (store?.contacts) {
        store.contacts[decodedJid] = {
          'id': decodedJid,
          'name': contact.notify
        };
      }
    }
  });
  
  sock.ev.on('call', async (calls) => {
    try {
      const decodedJid = await sock.decodeJid(sock.user.id);
      
      if (global.db?.set?.[decodedJid]?.anticall) {
        for (const call of calls) {
          if (call.status === 'offer') {
            const message = await sock.sendMessage(call.remoteJid, {
              'text': 'Pour le moment, nous ne sommes pas en mesure d accepter les appels ' +
                (call.isVideo ? 'video' : 'suara') +
                '.\n si @' + call.from.split('@')[0] +
                'Si vous avez besoin d aide, veuillez contacter le propriétaire :)',
              'mentions': [call.remoteJid]
            });
            
            await sock.sendContact(call.remoteJid, settings.owner, message);
            await sock.rejectCall(call.id, call.remoteJid);
          }
        }
      }
    } catch (error) {
      console.error('Error handling call:', error);
    }
  });
  
  sock.ev.on('messages.upsert', async (messages) => {
    try {
      await MessagesUpsert(sock, messages, store, groupCache);
    } catch (error) {
      console.error('Error in messages.upsert:', error);
    }
  });
  
  sock.ev.on('groups.update', async (groups) => {
    try {
      await GroupCacheUpdate(sock, groups, store, groupCache);
    } catch (error) {
      console.error('Error in groups.update:', error);
    }
  });
  
  sock.ev.on('group-participants.update', async (participants) => {
    try {
      await GroupParticipantsUpdate(sock, participants, store, groupCache);
    } catch (error) {
      console.error('Error in group-participants.update:', error);
    }
  });
  
  return sock;
}

startRavBot().catch(error => {
  console.error('Failed to start bot:', error);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log('Address localhost:' + PORT + ' in use. Please retry when the port is available!');
    server.close();
  } else {
    console.error('Server error:', error);
  }
});
