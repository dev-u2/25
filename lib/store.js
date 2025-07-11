
import pino from "pino";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// Create logger with silent level
const logger = pino({ level: "silent" });

// Store file path
const storeFilePath = join(process.cwd(), "raven.json");

// Simple custom store implementation
class SimpleStore {
    constructor() {
        this.contacts = {};
        this.messages = {};
        this.groupMetadata = {};
        this.loadData();
    }

    // Load data from file
    loadData() {
        if (existsSync(storeFilePath)) {
            try {
                const data = JSON.parse(readFileSync(storeFilePath, "utf-8"));
                this.contacts = data.contacts || {};
                this.messages = data.messages || {};
                this.groupMetadata = data.groupMetadata || {};
                console.log("Store data loaded successfully");
            } catch (error) {
                console.log("Could not load store data:", error.message);
            }
        }
    }

    // Save data to file
    saveData() {
        try {
            const data = {
                contacts: this.contacts,
                messages: this.messages,
                groupMetadata: this.groupMetadata
            };
            writeFileSync(storeFilePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.log("Could not save store data:", error.message);
        }
    }

    // Bind to socket events
    bind(ev) {
        ev.on('messages.upsert', ({ messages, type }) => {
            for (const msg of messages) {
                const jid = msg.key.remoteJid;
                if (!this.messages[jid]) {
                    this.messages[jid] = { array: [] };
                }
                
                const existingIndex = this.messages[jid].array.findIndex(m => m.key.id === msg.key.id);
                if (existingIndex === -1) {
                    this.messages[jid].array.push(msg);
                    // Keep only last 1000 messages per chat
                    if (this.messages[jid].array.length > 1000) {
                        this.messages[jid].array = this.messages[jid].array.slice(-1000);
                    }
                } else {
                    this.messages[jid].array[existingIndex] = msg;
                }
            }
        });

        ev.on('contacts.update', (contacts) => {
            for (const contact of contacts) {
                if (contact.id) {
                    this.contacts[contact.id] = {
                        id: contact.id,
                        name: contact.name || contact.notify || contact.verifiedName,
                        notify: contact.notify,
                        verifiedName: contact.verifiedName,
                        imgUrl: contact.imgUrl,
                        status: contact.status
                    };
                }
            }
        });

        ev.on('groups.update', (groups) => {
            for (const group of groups) {
                if (group.id) {
                    if (!this.groupMetadata[group.id]) {
                        this.groupMetadata[group.id] = {};
                    }
                    Object.assign(this.groupMetadata[group.id], group);
                }
            }
        });
    }

    // Load message by ID
    async loadMessage(jid, id) {
        if (!this.messages[jid]) return null;
        const message = this.messages[jid].array.find(m => m.key.id === id);
        return message || null;
    }

    // Get contact name
    getContactName(jid) {
        const contact = this.contacts[jid];
        return contact?.name || contact?.notify || contact?.verifiedName || jid.split('@')[0];
    }

    // Get group metadata
    getGroupMetadata(jid) {
        return this.groupMetadata[jid] || null;
    }

    // Convert to JSON format (compatibility)
    toJSON() {
        return {
            contacts: this.contacts,
            messages: this.messages,
            groupMetadata: this.groupMetadata
        };
    }

    // Load from JSON format (compatibility)
    fromJSON(data) {
        if (data.contacts) this.contacts = data.contacts;
        if (data.messages) this.messages = data.messages;
        if (data.groupMetadata) this.groupMetadata = data.groupMetadata;
    }
}

// Create store instance
const store = new SimpleStore();

// Auto-save every 30 seconds
const autoSaveInterval = setInterval(() => {
    store.saveData();
}, 30000);

// Cleanup function
const cleanup = () => {
    clearInterval(autoSaveInterval);
    store.saveData();
    console.log("Store cleanup completed");
};

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

export default store;
