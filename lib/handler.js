
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { sendWithNewsletter } from './newsletter-helper.js';
import config from '../settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Système de commandes global
global.commands = {
    list: new Map(),
    add: function(command) {
        const names = Array.isArray(command.name) ? command.name : [command.name];
        names.forEach(name => {
            this.list.set(name.toLowerCase(), command);
        });
    },
    get: function(name) {
        return this.list.get(name.toLowerCase());
    },
    getAllCommands: function() {
        return Array.from(this.list.values());
    },
    getByCategory: function(category) {
        return Array.from(this.list.values()).filter(cmd => cmd.category === category);
    }
};

// Système de cooldown
const cooldowns = new Map();

// Système de limits
const limits = new Map();

export async function handler(rav, m, msg, store, groupCache) {
    try {
        // Debug pour voir les messages reçus
        if (m.body && m.body.startsWith('.')) {
            console.log('Message reçu:', {
                body: m.body,
                prefix: m.prefix,
                command: m.command,
                isCommand: m.isCommand,
                sender: m.sender
            });
        }

        // Vérifications de base
        if (!m.isCommand || !m.command) return;
        if (m.sender === 'status@broadcast') return;
        if (m.isNewsletter) return; // Ignorer les messages des newsletters
        
        // Obtenir la commande
        const command = global.commands.get(m.command);
        if (!command) return;

        // Vérifications utilisateur
        const userDb = global.db.users[m.sender];
        if (!userDb) {
            global.db.users[m.sender] = {
                ban: false,
                name: m.pushName || '',
                sessions: [],
                autodl: false,
                warn: 0
            };
        }

        // Vérifier si l'utilisateur est banni
        if (userDb.ban && !m.isOwner) {
            return m.reply('❌ Vous êtes banni et ne pouvez pas utiliser les commandes.');
        }

        // Vérifications de permissions
        if (command.owner && !m.isOwner) {
            return m.reply(config.mess.owner);
        }

        if (command.admin && !m.isAdmin && !m.isOwner) {
            return m.reply(config.mess.admin);
        }

        if (command.botAdmin && !m.isBotAdmin && m.isGroup) {
            return m.reply(config.mess.botAdmin);
        }

        if (command.group && !m.isGroup) {
            return m.reply(config.mess.group);
        }

        if (command.private && m.isGroup) {
            return m.reply(config.mess.privatechat);
        }

        

        // Système de cooldown
        if (command.cooldown && !m.isOwner) {
            const cooldownKey = `${m.sender}-${m.command}`;
            const now = Date.now();
            const cooldownTime = command.cooldown * 1000;
            
            if (cooldowns.has(cooldownKey)) {
                const expirationTime = cooldowns.get(cooldownKey) + cooldownTime;
                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return m.reply(`⏰ Veuillez attendre ${timeLeft.toFixed(1)} secondes avant d'utiliser cette commande à nouveau.`);
                }
            }
            cooldowns.set(cooldownKey, now);
            setTimeout(() => cooldowns.delete(cooldownKey), cooldownTime);
        }

        // Système de limite
        if (command.limit && !m.isOwner) {
            const limitKey = `${m.sender}-${m.command}`;
            const today = new Date().toDateString();
            const userLimits = limits.get(limitKey) || { date: today, count: 0 };
            
            // Reset si nouveau jour
            if (userLimits.date !== today) {
                userLimits.date = today;
                userLimits.count = 0;
            }
            
            if (userLimits.count >= command.limit) {
                return m.reply(`⚠️ Vous avez atteint la limite quotidienne de ${command.limit} utilisations pour cette commande.`);
            }
            
            userLimits.count++;
            limits.set(limitKey, userLimits);
        }

        // Vérification des paramètres requis
        if (command.param && m.args.length === 0) {
            return m.reply(`⚠️ Paramètre requis manquant!\n\n*Utilisation:* ${m.prefix}${m.command} ${command.param}\n*Description:* ${command.desc || 'Aucune description disponible'}`);
        }

        // Logs de commande
        console.log(chalk.blue('[COMMAND]'), chalk.yellow(m.command), chalk.green('from'), chalk.cyan(m.pushName || m.sender.split('@')[0]), chalk.green('in'), chalk.magenta(m.isGroup ? 'Group' : 'Private'));

        // Ajouter cantLoad à rav
        addCantLoadToRav(rav);

        // Exécuter la commande
        try {
            await command.run({
                rav,
                m,
                msg,
                args: m.args,
                text: m.text,
                body: m.body,
                prefix: m.prefix,
                command: m.command,
                commands: global.commands,
                store,
                groupCache,
                config: config,
                Func: createFunctionUtils(rav),
                db: global.db,
                sendWithNewsletter
            });
        } catch (cmdError) {
            console.error(chalk.red('[COMMAND ERROR]'), cmdError);
            
            // Message d'erreur
            const errorMsg = m.isOwner ? 
                `❌ Erreur lors de l'exécution de la commande:\n\`\`\`${cmdError.message}\`\`\`` :
                '❌ Une erreur est survenue lors de l\'exécution de la commande.';
            
            m.reply(errorMsg);
        }

    } catch (error) {
        console.error(chalk.red('[HANDLER ERROR]'), error);
    }
}

// Fonctions utilitaires
function createFunctionUtils(rav) {
    return {
        formatNumber: (number) => {
            if (!number) return null;
            return number.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        },
        
        runtime: () => {
            const uptime = process.uptime();
            return `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
        },
        
        formatSize: (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },
        
        sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        
        isUrl: (url) => {
            try {
                new URL(url);
                return true;
            } catch {
                return false;
            }
        },
        
        getRandom: (ext) => {
            return `${Math.floor(Math.random() * 10000)}${ext}`;
        }
    };
}

// Charger toutes les commandes
export async function loadCommands() {
    try {
        const cmdDir = path.join(__dirname, '../cmd');
        const files = fs.readdirSync(cmdDir, { withFileTypes: true });
        
        let loadedCount = 0;
        
        for (const file of files) {
            if (file.isDirectory()) {
                // Charger les commandes dans les sous-dossiers
                const subDir = path.join(cmdDir, file.name);
                const subFiles = fs.readdirSync(subDir);
                
                for (const subFile of subFiles) {
                    if (subFile.endsWith('.js')) {
                        try {
                            const filePath = path.join(subDir, subFile);
                            await import(`file://${filePath}`);
                            loadedCount++;
                        } catch (error) {
                            console.error(chalk.red(`[ERROR] Failed to load ${file.name}/${subFile}:`), error.message);
                        }
                    }
                }
            } else if (file.name.endsWith('.js') && file.name !== 'index.js') {
                try {
                    const filePath = path.join(cmdDir, file.name);
                    await import(`file://${filePath}`);
                    loadedCount++;
                } catch (error) {
                    console.error(chalk.red(`[ERROR] Failed to load ${file.name}:`), error.message);
                }
            }
        }
        
        console.log(chalk.green(`[COMMANDS] Loaded ${loadedCount} command files`));
        console.log(chalk.blue(`[COMMANDS] Total commands: ${global.commands.list.size}`));
        
    } catch (error) {
        console.error(chalk.red('[COMMANDS] Error loading commands:'), error);
    }
}

// Fonction d'erreur pour les commandes
global.cantLoad = (error) => {
    console.error(chalk.red('[COMMAND ERROR]'), error);
};

// Extension pour rav
export function extendRav(rav) {
    rav.cantLoad = global.cantLoad;
    return rav;
}

// Ajouter cantLoad à l'objet rav dans handler
function addCantLoadToRav(rav) {
    if (!rav.cantLoad) {
        rav.cantLoad = (error) => {
            console.error(chalk.red('[COMMAND ERROR]'), error);
        };
    }
}
