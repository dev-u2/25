import fs from "fs"
import path from "path"
import https from "https"
import axios from "axios"
import chalk from "chalk"
import crypto from "crypto"
import { fileTypeFromBuffer } from "file-type"
import PhoneNumber from "awesome-phonenumber"
import config from "../settings.js"
import { imageToWebp, videoToWebp, writeExif } from "./exif.js"
import { isUrl, generateMessageTag, getBuffer, getSizeMedia, fetchJson, sleep, getTypeUrlMedia } from "./myfunction.js"
import { Serialize } from "./message.js"
import baileys from "baileys"

const { jidNormalizedUser, proto, getBinaryNodeChildren, getBinaryNodeChild, generateMessageIDV2, jidEncode, encodeSignedDeviceIdentity, generateWAMessageContent, generateForwardMessageContent, prepareWAMessageMedia, delay, areJidsSameUser, extractMessageContent, generateMessageID, downloadContentFromMessage, generateWAMessageFromContent, jidDecode, generateWAMessage, toBuffer, getContentType, WAMessageStubType, getDevice } = baileys;

const getGroupAdmins = (participants) => {
    let admins = [];
    for (let i of participants) {
        i.admin === "superadmin" ? admins.push(i.id) : i.admin === "admin" ? admins.push(i.id) : "";
    }
    return admins || [];
};

async function GroupUpdate(rav, m, store) {
    if (!m.messageStubType || !m.isGroup) return;
    if (global.db?.groups[m.chat]?.setinfo && rav.public) {
        const admin = `@${m.sender.split("@")[0]}`;
        const messages = {
            1: "reset the group link!",
            21: `changed the Group Subject to:\n*${m.messageStubParameters[0]}*`,
            22: "changed the group icon.",
            23: "reset the group link!",
            24: `changed the group description.\n\n${m.messageStubParameters[0]}`,
            25: `set so that *${m.messageStubParameters[0] == "on" ? "only admins" : "all participants"}* can edit group info.`,
            26: `has *${m.messageStubParameters[0] == "on" ? "closed" : "opened"}* the group!\nNow ${m.messageStubParameters[0] == "on" ? "only admins" : "all participants"} can send messages.`,
            29: `made @${m.messageStubParameters[0].split("@")[0]} an admin.`,
            30: `removed @${m.messageStubParameters[0].split("@")[0]} from admin.`,
            72: `changed temporary message duration to *${m.messageStubParameters[0]}*`,
            123: "disabled temporary messages.",
            132: "reset the group link!",
        };
        if (messages[m.messageStubType]) {
            await rav.sendMessage(m.chat, { text: `${admin} ${messages[m.messageStubType]}`, mentions: [m.sender, ...(m.messageStubParameters[0]?.includes("@") ? [m.messageStubParameters[0]] : [])] }, { ephemeralExpiration: m.expiration || store?.messages[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
        } else {
            console.log({
                messageStubType: m.messageStubType,
                messageStubParameters: m.messageStubParameters,
                type: WAMessageStubType[m.messageStubType],
            });
        }
    }
}

async function GroupCacheUpdate(rav, update, store, groupCache) {
    try {
        for (let n of update) {
            if (store.groupMetadata[n.id]) {
                groupCache.set(n.id, n);
                store.groupMetadata[n.id] = {
                    ...(store.groupMetadata[n.id] || {}),
                    ...(n || {})
                };
            }
        }
    } catch (e) {
        throw e;
    }
}

async function GroupParticipantsUpdate(rav, { id, participants, author, action }, store, groupCache) {
    try {
        function updateAdminStatus(participants, metadataParticipants, status) {
            for (const participant of metadataParticipants) {
                let id = jidNormalizedUser(participant.id);
                if (participants.includes(id)) {
                    participant.admin = status;
                }
            }
        }
        if (global.db?.groups[id] && store?.groupMetadata[id]) {
            const metadata = store.groupMetadata[id];
            for (let n of participants) {
                let profile;
                try {
                    profile = await rav.profilePictureUrl(n, "image");
                } catch {
                    profile = "https://telegra.ph/file/95670d63378f7f4210f03.png";
                }
                let messageText = "";
                if (action === "add") {
                    messageText = global.db.groups[id]?.setwelcome || "Hi @user, welcome to @subject";
                    metadata.participants.push({ id: jidNormalizedUser(n), admin: null });
                } else if (action === "remove") {
                    messageText = global.db.groups[id]?.setleave || "@user left the group @subject";
                    metadata.participants = metadata.participants.filter(p => !participants.includes(jidNormalizedUser(p.id)));
                } else if (action === "promote") {
                    messageText = global.db.groups[id]?.setpromote || "@user was promoted to admin by @admin in @subject";
                    updateAdminStatus(participants, metadata.participants, "admin");
                } else if (action === "demote") {
                    messageText = global.db.groups[id]?.setdemote || "@user was demoted from admin by @admin in @subject";
                    updateAdminStatus(participants, metadata.participants, null);
                }
                groupCache.set(id, metadata);
                if (messageText && rav.public) {
                    messageText = messageText
                        .replace(/@user/g, `@${n.split("@")[0]}`)
                        .replace(/@subject/g, metadata.subject)
                        .replace(/@admin/g, author ? `@${author.split("@")[0]}` : "@admin")
                        .replace(/@desc/g, global.db.groups[id]?.desc || "No description");
                    await rav.sendMessage(
                        id,
                        {
                            text: messageText,
                            contextInfo: {
                                mentionedJid: [n, author].filter(Boolean),
                                externalAdReply: {
                                    title:
                                        action == "add"
                                            ? "Welcome"
                                            : action == "remove"
                                            ? "Leaving"
                                            : action.charAt(0).toUpperCase() + action.slice(1),
                                    mediaType: 1,
                                    previewType: 0,
                                    thumbnailUrl: profile,
                                    renderLargerThumbnail: true,
                                    sourceUrl: config.github
                                }
                            }
                        },
                        { ephemeralExpiration: store?.messages[id]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 }
                    );
                }
            }
        }
    } catch (e) {
        console.error(e);
        throw e;
    }
}

  async function LoadDataBase(rav, m) {
      try {
          const botNumber = await rav.decodeJid(rav.user.id);
          let game = global.db.game || {};

          let event = global.db.events || {};
          let user = global.db.users[m.sender] || {};
          let setBot = global.db.set[botNumber] || {};                    
          global.db.users[m.sender] = user;
          global.db.set[botNumber] = setBot;
          global.db.events = event;      

        const defaultSetBot = {
            lang: "fr",
            prefix: config.PREFIX,
            owner: config.owner,
            status: 0,
            join: false,
            public: true,
            anticall: true,
            original: true,
            readsw: false,
            autobio: false,
            autoread: true,
            antispam: true,
            autotyping: true,
            grouponly: false,
            multiprefix: false,
            privateonly: false,
            autobackup: false,
            template: "documentButtonList",
        };
        for (let key in defaultSetBot) {
            if (!(key in setBot)) setBot[key] = defaultSetBot[key];
        }
      
        const defaultUser = {
            vip: false,
            ban: false,
            name: "",
            
            sessions: [],
            
            autodl: false,
            name: null,          
            warn: 0, 
        };
        
        for (let key in defaultUser) {
            if (!(key in user)) user[key] = defaultUser[key];
        }        
        if (m.isGroup) {
            let group = global.db.groups[m.chat] || {};
            global.db.groups[m.chat] = group;
            const defaultGroup = {
                url: "",
                text: {},
                warn: {},
                tagsw: {},
                nsfw: false,
                mute: false,
                leave: false,
                setinfo: false,
                antilink: false,
                demote: false,
                antitoxic: false,
                promote: false,
                welcome: false,
                antivirtex: false,
                antitagsw: false,
                antidelete: false,
                antihidetag: false,
                prayertime: false,
                setleave: "",
                setpromote: "",
                setdemote: "",
                setwelcome: "",
                adminonly: false
            };
            for (let key in defaultGroup) {
                if (!(key in group)) group[key] = defaultGroup[key];
            }
        }
      
        const defaultEvents = {};
        
        for (let key in defaultEvents) {
            if (!(key in event)) event[key] = defaultEvents[key];
        }                        
    } catch (e) {
        throw e;
    }
}

async function MessagesUpsert(rav, message, store, groupCache) {
    try {
        let botNumber = await rav.decodeJid(rav.user.id);
        const msg = message.messages[0];
        if (!store.groupMetadata || Object.keys(store.groupMetadata).length === 0) {
            store.groupMetadata ??= await rav.groupFetchAllParticipating().catch(e => ({}));
        }
        if (!store.messages[msg.key.remoteJid]?.array?.some(a => a.key.id === msg.key.id)) return;
        const type = msg.message ? (getContentType(msg.message) || Object.keys(msg.message)[0]) : "";
        //if (!msg.key.fromMe && !msg.message && message.type === "notify") return
        const m = await Serialize(rav, msg, store, groupCache);
        const feat = await import("./handler.js");
        feat.handler(rav, m, msg, store, groupCache);
        if (type === "interactiveResponseMessage" && m.quoted && m.quoted.fromMe) {
            await rav.appendResponseMessage(m, JSON.parse(m.msg.nativeFlowResponseMessage.paramsJson).id);
        }
        if (global.db?.set[botNumber] && global.db?.set[botNumber]?.readsw) {
            if (msg.key.remoteJid === "status@broadcast") {
                await rav.readMessages([msg.key]);
                if (/protocolMessage/i.test(type)) rav.sendFromOwner(config.owner, "Status from @" + msg.key.participant.split("@")[0] + " has been deleted", msg, { mentions: [msg.key.participant] });
                if (/(audioMessage|imageMessage|videoMessage|extendedTextMessage)/i.test(type)) {
                    let content = (type == "extendedTextMessage") ? `Text Story Contains: ${msg.message.extendedTextMessage.text ? msg.message.extendedTextMessage.text : ""}` : (type == "imageMessage") ? `Image Story ${msg.message.imageMessage.caption ? "with Caption: " + msg.message.imageMessage.caption : ""}` : (type == "videoMessage") ? `Video Story ${msg.message.videoMessage.caption ? "with Caption: " + msg.message.videoMessage.caption : ""}` : (type == "audioMessage") ? "Audio Story" : "\nUnknown, please check directly";
                    await rav.sendFromOwner(config.owner, `Viewing story from @${msg.key.participant.split("@")[0]}\n${content}`, msg, { mentions: [msg.key.participant] });
                }
            }
        }
    } catch (e) {
        throw e;
    }
}

export { GroupUpdate, GroupCacheUpdate, GroupParticipantsUpdate, LoadDataBase, MessagesUpsert };