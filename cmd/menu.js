import fs from "fs";
import chalk from "chalk";
import config from '../settings.js';
import { createNewsletterContext, sendWithNewsletter } from "../lib/newsletter-helper.js";

commands.add({
    name: ["menu"],
    command: ["menu"],
    category: "info",
    cooldown: 30,
    desc: "Display bot menu by category",
    run: async ({ rav, m, args }) => {
        try {
            const pushName = m.pushName || "-";
            const prefix = ".";
            const x = await rav.decodeJid(rav.user.id);
            const set = db.set[x];
            const ment = set.template;
            const uptime = process.uptime();
            const runtime = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
            const modeBot = set.privateonly ? "Only private chat" : set.grouponly ? "Only group chat" : set.public ? "Public" : "Self";

            // get all command categories
            const commandCategories = [...new Set(
                commands.getAllCommands()
                    .map(cmd => cmd.category?.toLowerCase())
                    .filter(Boolean) // just for clarity
            )].sort();

            // helper function to get command list per category
            const getCommandsByCategory = (category) => {
                const rows = [];
                const seenEvents = new Set();
                for (const event of commands.getAllCommands()) {
                    if (event.category?.toLowerCase() !== category || event.category === "hidden") continue;
                    const eventKey = event.name[0];
                    if (seenEvents.has(eventKey)) continue;
                    seenEvents.add(eventKey);
                    event.command.forEach((cmd) => {
                        rows.push({
                            title: cmd.toUpperCase(),
                            description: event.desc?.slice(0, 72) || "-",
                            id: `${prefix}${cmd}`
                        });
                    });
                }
                return rows.sort((a, b) => a.title.localeCompare(b.title));
            };

            // main menu (no arguments)
            if (!args[0]) {
                let welcomeMsg = `Hi! I'm *${config.bot.name || "𝕽𝖆𝖛𝖊𝖓"}*, an automated system (WhatsApp Bot) ready to help you find data, entertainment, and fun tools directly from WhatsApp!\n\n`;
                welcomeMsg += `    *▢ Runtime:* ${runtime}\n`;
                welcomeMsg += `    *▢ Mode:* ${modeBot}\n`;
                welcomeMsg += `    *▢ Group:* ${config.bot.group}\n\n`;
                welcomeMsg += `Type *.auto-ai* to chat with ${config.bot.name}!`;
                const menuSections = [{
                    title: 'LIST MENU',
                    rows: [
                        { title: 'ALL MENU', id: `.allmenu` },
                        ...commandCategories.map(cat => ({
                            title: cat.toUpperCase(),
                            description: `Features from ${cat} category (Total: ${getCommandsByCategory(cat).length} features)`,
                            id: `.menu ${cat}`
                        }))
                    ]
                }];

                // select template according to menu type
                if (ment === "buttonList") {
                    const menuThumb = fs.readFileSync("./lib/database/allmenu.jpg");
                    return await rav.sendMessage(m.chat, {
                        image: menuThumb,
                        caption: welcomeMsg,
                        footer: config.bot.footer,
                        contextInfo: { 
                            forwardingScore: 10, 
                            isForwarded: true 
                        },
                        buttons: [
                        {
                            buttonId: `${prefix}allmenu`,
                            buttonText: { displayText: 'All Menu' },
                            type: 1
                        },
                        {
                            buttonId: 'list_menu',
                            buttonText: { displayText: 'List' },
                            type: 4,
                            nativeFlowInfo: {
                            name: 'single_select',
                            paramsJson: JSON.stringify({
                            title: 'List Menu',
                            sections: menuSections 
                            })
                        }
                        }
                        ],
                        headerType: 1,
                        viewOnce: true
                    }, { quoted: m });
                } else if (ment === "documentButtonList" || ment === "gifButtonList" || ment == "documentButtonWithAdReply") {
                    const media = (ment === "documentButtonList" || ment == "documentButtonWithAdReply") ? {
                        document: fs.readFileSync("./index.js"),
                        mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        fileName: config.bot.name
                    } : {
                        video: { url: "https://files.catbox.moe/jr7hl0.jpg" }                       
                    };
                    return await rav.sendMessage(m.chat, {
                        ...media,
                        caption: welcomeMsg,
                        footer: config.bot.footer,
                        contextInfo: {
                            forwardingScore: 10,
                            isForwarded: true,
                            externalAdReply: {
                                thumbnailUrl: config.thumb.menu,
                                mediaUrl: config.thumb.menu,
                                mediaType: 1,
                                previewType: "PHOTO",
                                sourceUrl: config.instagram,
                                renderLargerThumbnail: true
                            }
                        },
                        buttons: [
                        {
                            buttonId: `${prefix}allmenu`,
                            buttonText: { displayText: 'All Menu' },
                            type: 1
                        },
                        {
                        buttonId: 'interactive_menu',
                        buttonText: { displayText: 'List' },
                        type: 4,
                        nativeFlowInfo: {
                            name: 'single_select',
                            paramsJson: JSON.stringify({
                                title: 'List Menu',
                                sections: menuSections
                            })
                        }
                        }
                        ],
                        headerType: 1,
                        viewOnce: true
                    }, {
                       quoted: m 
                    });
                } else if (ment === "replyAd") {
                    let categoryList = `Hi! I'm *${config.bot.name || "𝕽𝖆𝖛𝖊𝖓"}*, an automated system (WhatsApp Bot) ready to help you find data, entertainment, and fun tools directly from WhatsApp!\n\n`;
                    categoryList += `    *▢ Runtime:* ${runtime}\n`;
                    categoryList += `    *▢ Mode:* ${modeBot}\n`;
                    categoryList += `    *▢ Group:* ${config.bot.group}\n\n`;
                    categoryList += `*MENU CATEGORY LIST*\n`;
                    for (let cat of commandCategories) {
                        categoryList += `- .menu ${cat} (${getCommandsByCategory(cat).length})\n`;
                    }
                    categoryList += `\n> Use .menu <category> to view commands, or .allmenu for all features. Type .auto-ai to chat with ${config.bot.name}`;

                    const menuThumb = fs.readFileSync("./lib/database/allmenu.jpg");
                    return m.reply(categoryList, {
                        contextInfo: {
                            forwardingScore: 100,
                            isForwarded: true,
                            externalAdReply: {
                                thumbnail: menuThumb,
                                sourceUrl: config.instagram,
                                mediaType: 1,
                                previewType: "PHOTO",
                                renderLargerThumbnail: true
                            }
                        }
                    });
                } else if (ment === "simple") {
                    let categoryList = `*CATEGORY LIST*\n\n`;
                    categoryList += "┌─\n"
                    for (let cat of commandCategories) {
                        categoryList += `├ ${m.prefix}menu ${cat}\n`;
                    }
                    categoryList += "└─\n"
                    return m.reply(categoryList)
                }
            }

            // category-specific menu
            const requestedCategory = args[0].toLowerCase();
            if (!commandCategories.includes(requestedCategory)) {
                return
            }

            const rows = getCommandsByCategory(requestedCategory);
            if (ment === "buttonList" || ment === "documentButtonList") {
                const listThumb = fs.readFileSync("./lib/database/list.jpg");
                const media = ment === "buttonList" ? {
                    image: listThumb
                } : {
                    document: fs.readFileSync("./index.js"),
                    mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    fileName: config.bot.name
                };

                return rav.sendMessage(m.chat, {
                    ...media,
                    caption: `Here are the available commands for *${requestedCategory.toUpperCase()}*, please select according to your needs!`,
                    footer: config.bot.footer,
                    contextInfo: {
                        forwardingScore: 10,
                        isForwarded: true,
                        externalAdReply: {
                            thumbnail: listThumb,
                            mediaType: 1,
                            previewType: "PHOTO",
                            sourceUrl: config.instagram,
                            renderLargerThumbnail: true
                        }
                    },
                    buttons: [{
                        buttonId: 'category_menu',
                        buttonText: { displayText: 'List Commands' },
                        type: 4,
                        nativeFlowInfo: {
                            name: 'single_select',
                            paramsJson: JSON.stringify({
                                title: `MENU ${requestedCategory.toUpperCase()}`,
                                sections: [{
                                    title: `MENU ${requestedCategory.toUpperCase()}`,
                                    highlight_label: '📁 Commands',
                                    rows: rows
                                }]
                            })
                        }
                    }],
                    headerType: 1,
                    viewOnce: true
                }, { 
                    quoted: m 
                });
            } else if (ment === "replyAd" || ment === "documentButtonWithAdReply") {
                const listThumb = fs.readFileSync("./lib/database/list.jpg");
                const filteredCmd = [];
                const seenEvents = new Set();
                for (const event of commands.getAllCommands()) {
                    if (event.category?.toLowerCase() !== requestedCategory || event.category === "hidden") continue;
                    const eventKey = event.name[0];
                    if (seenEvents.has(eventKey)) continue;
                    seenEvents.add(eventKey);
                    event.command.forEach((cmd) => {
                        filteredCmd.push({
                            name: cmd + (event.param ? ` ${event.param}` : ""),
                            tag: event.category
                        });
                    });
                }
                const sortedCmds = filteredCmd.map(d => d.name).sort();
                let menuList = `╭────「 *${requestedCategory.toUpperCase()}* 」\n`;
                for (let cmd of sortedCmds) {
                    menuList += `│▢ .${cmd}\n`;
                }
                menuList += "╰────────"
                const newsletterContext = createNewsletterContext();
                return m.reply(menuList.trim(), {
                    contextInfo: {
                        ...newsletterContext,
                        externalAdReply: {
                            thumbnail: listThumb,
                            sourceUrl: config.instagram,
                            mediaType: 1,
                            previewType: "PHOTO",
                            renderLargerThumbnail: true
                        }
                    }
                });
            } else if (ment === "simple") {
                let filteredCmd = [];
                let seenEvents = new Set();
                for (const event of commands.getAllCommands()) {
                    if (event.category?.toLowerCase() !== requestedCategory || event.category === "hidden") continue;
                    const eventKey = event.name[0];
                    if (seenEvents.has(eventKey)) continue;
                    seenEvents.add(eventKey);
                    event.command.forEach((cmd) => {
                        filteredCmd.push({
                            name: cmd + (event.param ? ` ${event.param}` : ""),
                            tag: event.category
                        });
                    });
                }
                const sortedCmds = filteredCmd.map(d => d.name).sort();
                let menuList = `┌─ 「 *${requestedCategory.toUpperCase()}* 」\n`;
                for (let cmd of sortedCmds) {
                    menuList += `├ ${m.prefix}${cmd}\n`;
                }
                menuList += "└─"
                return sendWithNewsletter(rav, m.chat, menuList.trim(), { quoted: m }) 
            }
        } catch (e) {            
            rav.cantLoad(e);            
        }
    }
});

commands.add({
    name: ["allmenu"],
    command: ["allmenu"],
    category: "info",
    desc: "Display all bot features",
    cooldown: 30,
    run: async ({ rav, m }) => {
        const bot = rav.user.id
        const botJid = await rav.decodeJid(bot)
        const set = db.set[botJid]
        const uptime = process.uptime()
        const runtime = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
        const modeBot = set.privateonly ? "Only private chat" : set.grouponly ? "Only group chat" : set.public ? "Public" : "Self"

        const allCmds = commands.getAllCommands().filter(e => e.category !== "hidden")
        const grouped = {}

        for (const ev of allCmds) {
            const cat = ev.category.toUpperCase()
            if (!grouped[cat]) grouped[cat] = []
            grouped[cat].push(ev)
        }

        let teks = `📖 *COMPLETE MENU ${config.bot.name.toUpperCase()}*\n\n`
        teks += `▢ Runtime: ${runtime}\n`
        teks += `▢ Mode: ${modeBot}\n\n`

        for (const [cat, list] of Object.entries(grouped).sort()) {
            teks += `┌────「 *${cat}* 」\n`
            for (const ev of list) {
                for (const cmd of ev.command) {
                    teks += `├ .${cmd}${ev.param ? ` ${ev.param}` : ""}\n`
                }
            }
            teks += `└─────────────\n`
        }

        await rav.adChannel(teks.trim(), {
            title: `All Commands - ${config.bot.name}`,
            thumb: config.thumb.menu,
            render: true,
            txt: config.bot.name
        })
    }
})