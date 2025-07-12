export default {
    name: "anti-link",
    exec: async ({ rav, m }) => {
        const isOwner = config.owner.map(v => v.replace(/[^0-9]/g, "") + "@s.whatsapp.net").includes(m.sender)
        if (!m.text || m.key.fromMe || !m.isGroup || m.isAdmin || !m.isBotAdmin || isOwner) return false;
        const budy = typeof m.text === "string" ? m.text.toLowerCase() : ""
        const setgroups = db.groups[m.chat] || {}
        if (budy.match("chat.whatsapp.com/") && setgroups.antilink) {
            await rav.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.id, participant: m.sender } })
            await rav.relayMessage(m.chat, { extendedTextMessage: { text: `Detected @${m.sender.split("@")[0]} Sending Group Link\nSorry, Link Must Be Deleted..`, contextInfo: { mentionedJid: [m.key.participant], isForwarded: true, forwardingScore: 1, quotedMessage: { conversation: "*Anti Link❗*" }, ...m.key } } }, {})
            return true;
        }
        return false;
    }
}