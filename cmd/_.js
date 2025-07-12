import { sendWithNewsletter } from "../lib/newsletter-helper.js";

commands.add({
    name: ["antilink"],
    command: ["antilink"],
    param: "<on/off>",
    category: "group",
    admin: true,
    group: true,
    botAdmin: true,
    desc: "Enable/disable group antilink",
    run: async ({ rav, m, args }) => {
        const set = db.groups[m.chat]
        if (/on|true/i.test(args[0])) {
            if (set.antilink) return sendWithNewsletter(rav, m.chat, "*Already enabled.*", { quoted: m })
            set.antilink = true
            sendWithNewsletter(rav, m.chat, "*Antilink enabled successfully!*", { quoted: m })
        } else if (/off|false/i.test(args[0])) {
            set.antilink = false
            sendWithNewsletter(rav, m.chat, "*Antilink disabled successfully!*", { quoted: m })
        } else rav.sendButton(m.chat, [
            ["On", ".antilink on"],
            ["Off", ".antilink off"]
        ], {
            text: "*Please choose an option below*\n\n> On: Enable\n> Off: Disable",
            quoted: m
        })
    }
})

commands.add({
    name: ["antivirtex"],
    command: ["antivirtex"],
    category: "group",
    param: "<on/off>",
    admin: true,
    group: true,
    botAdmin: true,
    desc: "Enable/disable antivirtex in group",
    run: async ({ rav, m, args }) => {
        const set = db.groups[m.chat]
        if (/on|true/i.test(args[0])) {
            if (set.antivirtex) return m.reply("*Already enabled.*")
            set.antivirtex = true
            m.reply("*Antivirtex enabled successfully!*")
        } else if (/off|false/i.test(args[0])) {
            set.antivirtex = false
            m.reply("*Antivirtex disabled successfully!*")
        } else rav.sendButton(m.chat, [
            ["On", ".antivirtex on"],
            ["Off", ".antivirtex off"]
        ], {
            text: "*Please choose an option below*\n\n> On: Enable\n> Off: Disable",
            quoted: m
        })
    }
})

commands.add({
    name: ["antidelete"],
    command: ["antidelete"],
    category: "group",
    param: "<on/off>",
    admin: true,
    group: true,
    botAdmin: true,
    desc: "Enable/disable message anti-deletion",
    run: async ({ rav, m, args }) => {
        const set = db.groups[m.chat]
        if (/on|true/i.test(args[0])) {
            if (set.antidelete) return m.reply("*Already enabled.*")
            set.antidelete = true
            m.reply("*Anti-delete enabled successfully!*")
        } else if (/off|false/i.test(args[0])) {
            set.antidelete = false
            m.reply("*Anti-delete disabled successfully!*")
        } else rav.sendButton(m.chat, [
            ["On", ".antidelete on"],
            ["Off", ".antidelete off"]
        ], {
            text: "*Please choose an option below*\n\n> On: Enable\n> Off: Disable",
            quoted: m
        })
    }
})

commands.add({
    name: ["welcome"],
    command: ["welcome"],
    category: "group",
    param: "<on/off>",
    admin: true,
    group: true,
    botAdmin: true,
    desc: "Enable/disable welcome messages",
    run: async ({ rav, m, args }) => {
        const set = db.groups[m.chat]
        if (/on|true/i.test(args[0])) {
            if (set.welcome) return m.reply("*Already enabled.*")
            set.welcome = true
            m.reply("*Welcome message enabled successfully!*")
        } else if (/off|false/i.test(args[0])) {
            set.welcome = false
            m.reply("*Welcome message disabled successfully!*")
        } else rav.sendButton(m.chat, [
            ["On", ".welcome on"],
            ["Off", ".welcome off"]
        ], {
            text: "*Please choose an option below*\n\n> On: Enable\n> Off: Disable",
            quoted: m
        })
    }
})

commands.add({
    name: ["antitoxic"],
    command: ["antitoxic"],
    category: "group",
    param: "<on/off>",
    admin: true,
    group: true,
    botAdmin: true,
    desc: "Enable/disable anti-toxic filter",
    run: async ({ rav, m, args }) => {
        const set = db.groups[m.chat]
        if (/on|true/i.test(args[0])) {
            if (set.antitoxic) return m.reply("*Already enabled.*")
            set.antitoxic = true
            m.reply("*Anti-toxic enabled successfully!*")
        } else if (/off|false/i.test(args[0])) {
            set.antitoxic = false
            m.reply("*Anti-toxic disabled successfully!*")
        } else rav.sendButton(m.chat, [
            ["On", ".antitoxic on"],
            ["Off", ".antitoxic off"]
        ], {
            text: "*Please choose an option below*\n\n> On: Enable\n> Off: Disable",
            quoted: m
        })
    }
})

commands.add({
    name: ["nsfw"],
    command: ["nsfw"],
    category: "group",
    param: "<on/off>",
    admin: true,
    group: true,
    botAdmin: true,
    desc: "Enable/disable NSFW content in group",
    run: async ({ rav, m, args }) => {
        const set = db.groups[m.chat]
        if (/on|true/i.test(args[0])) {
            if (set.nsfw) return m.reply("*Already enabled.*")
            set.nsfw = true
            m.reply("*NSFW mode enabled successfully!*")
        } else if (/off|false/i.test(args[0])) {
            set.nsfw = false
            m.reply("*NSFW mode disabled successfully!*")
        } else rav.sendButton(m.chat, [
            ["On", ".nsfw on"],
            ["Off", ".nsfw off"]
        ], {
            text: "*Please choose an option below*\n\n> On: Enable\n> Off: Disable",
            quoted: m
        })
    }
})

commands.add({
    name: ["antihidetag"],
    command: ["antihidetag"],
    category: "group",
    param: "<on/off>",
    admin: true,
    group: true,
    botAdmin: true,
    desc: "Enable/disable antihidetag protection",
    run: async ({ rav, m, args }) => {
        const set = db.groups[m.chat]
        if (/on|true/i.test(args[0])) {
            if (set.antihidetag) return m.reply("*Already enabled.*")
            set.antihidetag = true
            m.reply("*Antihidetag enabled successfully!*")
        } else if (/off|false/i.test(args[0])) {
            set.antihidetag = false
            m.reply("*Antihidetag disabled successfully!*")
        } else rav.sendButton(m.chat, [
            ["On", ".antihidetag on"],
            ["Off", ".antihidetag off"]
        ], {
            text: "*Please choose an option below*\n\n> On: Enable\n> Off: Disable",
            quoted: m
        })
    }
})

commands.add({
    name: ["antitagsw"],
    command: ["antitagsw"],
    category: "group",
    param: "<on/off>",
    admin: true,
    group: true,
    botAdmin: true,
    desc: "Enable/disable tag + sw (status view) block",
    run: async ({ rav, m, args }) => {
        const set = db.groups[m.chat]
        if (/on|true/i.test(args[0])) {
            if (set.antitagsw) return m.reply("*Already enabled.*")
            set.antitagsw = true
            m.reply("*Antitagsw enabled successfully!*")
        } else if (/off|false/i.test(args[0])) {
            set.antitagsw = false
            m.reply("*Antitagsw disabled successfully!*")
        } else rav.sendButton(m.chat, [
            ["On", ".antitagsw on"],
            ["Off", ".antitagsw off"]
        ], {
            text: "*Please choose an option below*\n\n> On: Enable\n> Off: Disable",
            quoted: m
        })
    }
})