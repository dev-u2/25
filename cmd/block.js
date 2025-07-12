commands.add({
    name: ["+block", "block"],
    command: ["+block", "block"],
    alias: ["addblock", "blokir", "blockir"],
    category: "owner",
    owner: true,
    run: async ({ rav, m, args }) => {
        let text = args.join(" ")
        let target = m.mentionedJid?.[0] || m.quoted?.sender || text?.replace(/\D/g, "") + "@s.whatsapp.net"
        if (target) {
            await rav.updateBlockStatus(target, "block")
                .then(() => m.reply(config.mess.success))
                .catch(() => m.reply("[♠️] Failed"))
        } else m.reply("[♠️] Reply/Tag/Include the target to ban")
    }
})

commands.add({
    name: ["listblock"],
    command: ["listblock"],
    alias: ["blocklist", "listblockir", "listblokir"],
    category: "info",
    run: async ({ rav, m, args }) => {
        let blocked = await rav.fetchBlocklist()
        m.reply(`Total Blocked: ${blocked.length}\n` + blocked.map(v => "• " + v.replace(/@.+/, "")).join`\n`)
    }
})

commands.add({
    name: ["-block", "unblock"],
    command: ["-block", "unblock"],
    alias: ["unblockir", "unblokir"],
    category: "owner",
    owner: true,
    run: async ({ rav, m, args }) => {
        let text = args.join(" ")
        let target = m.mentionedJid?.[0] || m.quoted?.sender || text?.replace(/\D/g, "") + "@s.whatsapp.net"
        if (target) {
            await rav.updateBlockStatus(target, "unblock")
                .then(() => m.reply(config.mess.success))
                .catch(() => m.reply("[♠️] Failed!"))
        } else m.reply("[♠️] Reply/Tag/Include the target to unblock")
    }
})