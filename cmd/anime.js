import { sendWithNewsletter } from "../lib/newsletter-helper.js";

commands.add({
    name: ["anime"], // feature name shown in menu
    command: ["anime"], // command trigger
    category: "anime", // feature category/tag
    param: "<title>", // parameter usage shown in menu
    limit: 5, // costs 5 limit points to use
    cooldown: 10, // 10 seconds cooldown per user
    query: true, // requires user input (query)
    desc: "Search anime info via bot", // description of feature
    run: async ({ rav, m, text, Func }) => { // feature logic function
        let res = await Func.fetchJson(`https://fastrestapis.fasturl.cloud/anime/animeinfo?name=${encodeURIComponent(text)}`)
        if (!res.result) return sendWithNewsletter(rav, m.chat, "⚠️ Anime not found!", { quoted: m })

        let r = res.result
        let query = `*ANIME - INFO*\n\n`
        query += `*▢ Title:* ${r.title}\n`
        query += `*▢ Type:* ${r.type}\n`
        query += `*▢ Status:* ${r.status}\n`
        query += `*▢ Genre:* ${r.genres}\n`
        query += `*▢ Score:* ${r.score} | *Favorites:* ${r.favorites}\n`
        query += `*▢ Members:* ${r.members}\n\n`
        query += `*▢ Synopsis:*\n${r.synopsis?.split("\n").slice(0, 2).join("\n")}`

        await sendWithNewsletter(rav, m.chat, query, { quoted: m })
        query += `Link: ${r.url}`

        m.reply(query, {
            contextInfo: {
                externalAdReply: {
                    title: r.title,
                    mediaType: 1,
                    thumbnailUrl: r.images.jpg.image_url,
                    renderLargerThumbnail: true,
                    sourceUrl: r.url
                }
            }
        })
    }
})