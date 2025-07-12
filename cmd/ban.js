import { sendWithNewsletter } from "../lib/newsletter-helper.js";

commands.add({
    name: ["ban", "+ban"],
    param: "<number>",
    command: ["ban", "+ban"],
    category: "owner",
    owner: true,
    desc: "Ban a specific number",
    run: async ({ rav, m, args, Func }) => {
        try {
            let target = m.mentionedJid?.[0] || m.quoted?.sender || (args[0] ? args[0] + "@s.whatsapp.net" : m.sender)
            let number = Func.formatNumber(target)
            if (!number) return sendWithNewsletter(rav, m.chat, '[×] Please provide the target number', { quoted: m })
            if (global.db.users[number]) {
                global.db.users[number].ban = true
                await sendWithNewsletter(rav, m.chat, '[🃏] User has been banned', { quoted: m })
            } else {
                await sendWithNewsletter(rav, m.chat, '[♠️] User not registered', { quoted: m })
            }
        } catch (e) {
            rav.cantLoad(e)
        }
    }
})

commands.add({
    name: ["-ban", "unban"],
    param: "<number>",
    command: ["-ban", "unban"],
    category: "owner",
    owner: true,
    desc: "Remove ban from a specific number",
    run: async ({ rav, m, args, Func }) => {
        try {
            let target = m.mentionedJid?.[0] || m.quoted?.sender || (args[0] ? args[0] + "@s.whatsapp.net" : m.sender)
            let number = Func.formatNumber(target)
            if (!number) return sendWithNewsletter(rav, m.chat, '[♠️] Please provide the target number', { quoted: m })
            if (global.db.users[number]) {
                global.db.users[number].ban = false
                await sendWithNewsletter(rav, m.chat, '[🃏] User has been unbanned', { quoted: m })
            } else {
                await sendWithNewsletter(rav, m.chat, '[♠️] User not registered', { quoted: m })
            }
        } catch (e) {
            rav.cantLoad(e)
        }
    }
})