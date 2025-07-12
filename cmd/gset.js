commands.add({
    name: ["setwelcome"],
    command: ["setwelcome"],
    desc: "Set a custom welcome message for the group",
    category: "group",
    admin: true,
    group: true,
    run: async ({ rav, m, args }) => {
        if (!args.length) return m.reply("Please enter the welcome text you want to set!");
        const text = args.join(" ");
        const id = m.chat;
        if (!db.groups[id]) db.groups[id] = {};
        db.groups[id].setwelcome = text;
        m.reply(`[🃏] Welcome message successfully saved:\n${text}`);
    }
});

commands.add({
    name: ["setleave"],
    command: ["setleave"],
    desc: "Set a custom leave message for the group",
    category: "group",
    admin: true,
    group: true,
    run: async ({ rav, m, args }) => {
        if (!args.length) return m.reply("Please enter the leave text you want to set!");
        const text = args.join(" ");
        const id = m.chat;
        if (!db.groups[id]) db.groups[id] = {};
        db.groups[id].setleave = text;
        m.reply(`[🃏] Leave message successfully saved:\n${text}`);
    }
});

commands.add({
    name: ["setpromote"],
    command: ["setpromote"],
    desc: "Set a custom promote message for the group",
    category: "group",
    admin: true,
    group: true,
    run: async ({ rav, m, args }) => {
        if (!args.length) return m.reply("Please enter the promote text you want to set!");
        const text = args.join(" ");
        const id = m.chat;
        if (!db.groups[id]) db.groups[id] = {};
        db.groups[id].setpromote = text;
        m.reply(`[🃏] Promote message successfully saved:\n${text}`);
    }
});

commands.add({
    name: ["setdemote"],
    command: ["setdemote"],
    desc: "Set a custom demote message for the group",
    category: "group",
    admin: true,
    group: true,
    run: async ({ rav, m, args }) => {
        if (!args.length) return m.reply("Please enter the demote text you want to set!");
        const text = args.join(" ");
        const id = m.chat;
        if (!db.groups[id]) db.groups[id] = {};
        db.groups[id].setdemote = text;
        m.reply(`[🃏] Demote message successfully saved:\n${text}`);
    }
});

commands.add({
    name: ["adminonly"],
    command: ["adminonly"],
    description: "Enable or disable admin-only mode in the group",
    category: "group",
    group: true,
    admin: true,
    run: async ({ rav, m, args }) => {
        const mode = args[0] && args[0].toLowerCase();
        if (!mode || !["on", "off"].includes(mode)) {
            return m.reply("[♠️] Invalid format! Use .adminonly on/off");
        }
        if (!db.groups[m.chat]) db.groups[m.chat] = {};
        db.groups[m.chat].adminonly = mode === "on";
        await m.reply(`[🃏] Admin-only mode in this group has been *${mode === "on" ? "enabled" : "disabled"}*.`);
    }
});