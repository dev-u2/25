import yts from "yt-search"

commands.add({
    name: ["youtubeaudio"],
    command: ["youtubeaudio"],
    category: "downloader",
    alias: ["yta", "ytmp3", "youtubemp3", "ytaudio"],
    desc: "Download audio from YouTube link!",
    limit: 5,
    query: true,
    cooldown: 30,
    run: async ({ rav, m, args, Func, dl }) => {
        const url = args[0]
        if (!url) return m.reply(`[×] Example: .ytmp3 https://youtu.be/dQw4w9WgXcQ`)
        if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
            return m.reply("[♠️] This is not a YouTube link!")
        }
        //m.reply({ react: { text: "🕣", key: m.key }})
        try {
            const zer = await Func.fetchJson(`https://fastrestapis.fasturl.cloud/downup/ytmp3?url=${encodeURIComponent(args[0])}&quality=128kbps&server=auto`)
            let x = zer.result
            if (!zer.result || zer.status !== 200) return m.reply("Failed to get the audio!")
            let y = await dl.youtube(args[0])
            await m.reply(`*Title:* ${x.title}\n*Channel:* ${x.author.name}\n*Views:* ${x.metadata.views}\n*Published:* ${x.metadata.uploadDate}`, {
                contextInfo: {
                    externalAdReply: {
                        title: x.title,
                        body: x.metadata.description,
                        thumbnailUrl: x.metadata.thumbnail,
                        renderLargerThumbnail: true,
                        mediaType: 1,
                        previewType: "PHOTO",
                        mediaUrl: args[0],
                        sourceUrl: args[0]
                    }
                }
            })
            await m.reply({
                audio: { url: x.media },
                mimetype: "audio/mpeg",
                fileName: `${x.metadata?.id || "audio"}.mp3`,
                caption: "here's your audio~"
            }).catch(async () => {
                await m.reply({
                    audio: { url: y.urlmp3 },
                    mimetype: "audio/mpeg",
                    fileName: `${Func.randomInt(1, 10000000) || "audio"}.mp3`,
                    caption: "here you gooo",
                })
            })
        } catch (err) {
            console.log(err)
            m.reply(`Failed to convert YouTube: ${err.message || err}`)
        }
    }
})


commands.add({
    name: ["youtubevideo"],
    command: ["youtubevideo"],
    alias: ["ytv", "ytmp4", "youtubemp4", "ytvideo"],
    category: "downloader",
    desc: "Download video from YouTube link!",
    limit: 5,
    query: true,
    cooldown: 30,
    run: async ({ rav, m, args, Func, dl }) => {
        const url = args[0]
        if (!url) return m.reply(`[×] Example: .ytmp4 https://youtube.com/watch?v=0qE2mTzg5Iw`)
        if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
            return m.reply("[♠️] That's not a YouTube link!")
        }
        //m.reply({ react: { text: "🕣", key: m.key }})
        try {
            const vid = await Func.fetchJson(`https://fastrestapis.fasturl.cloud/downup/ytmp4?url=${encodeURIComponent(args[0])}&quality=480&server=auto`)
            const re = vid.result
            const zer = await dl.youtube(args[0])
            if (vid.status !== 200) return m.reply("Failed to get the video!")
            await m.reply({
                video: { url: zer.urlmp4 },
                mimetype: "video/mp4",
                caption: `*––––––『 YOUTUBE 』––––––*\n\n*▢ Title:* ${re.title}\n*▢ Channel:* ${re.author.name}\n*▢ Views:* ${re.metadata.views}\n*▢ Published:* ${re.metadata.uploadDate}`.trim()
            })
        } catch (err) {
            console.log(err)
            m.reply(`[♠️] Failed to convert YouTube: ${err.message || err}`)
        }
    }
})

commands.add({
    name: ["play"],
    command: ["play"],
    category: "internet",
    desc: "Search for a song and send it as audio!",
    limit: 5,
    query: true,
    cooldown: 30,
    run: async ({ rav, m, args, Func, dl }) => {
        try {
            const txt = args.join(" ")
            if (!txt) return m.reply("[♠️] Please provide the song title you want to play!")
            //m.reply({ react: { text: "🕣", key: m.key }})
            const lo = await yts.search(txt)
            const morrow = lo.all[0]
            if (!morrow || !morrow.url) return m.reply("[♠️] No results found.")
            const teksnya = `
*––––––『 MUSIC PLAY 』––––––*

*▢ Title        :* ${morrow.title || 'Not available'}
*▢ Description :* ${morrow.description || 'Not available'}
*▢ Channel    :* ${morrow.author?.name || 'Not available'}
*▢ Duration    :* ${morrow.seconds || 'Not available'} second (${morrow.timestamp || 'Not available'})
*▢ Source     :* ${morrow.url || 'Not available'}

*_processing audio_*
`.trim()
            const zer = await dl.youtube(morrow.url)
            await m.reply(teksnya, {
                contextInfo: {
                    externalAdReply: {
                        title: morrow.title,
                        body: morrow.description,
                        thumbnailUrl: morrow.thumbnail,
                        renderLargerThumbnail: true,
                        mediaType: 1,
                        previewType: "PHOTO",
                        mediaUrl: morrow.url,
                        sourceUrl: morrow.url
                    }
                }
            });
            const x = await Func.fetchJson(`https://fastrestapis.fasturl.cloud/downup/ytmp3?url=${encodeURIComponent(morrow.url)}&quality=128kbps&server=auto`)
            await Func.sleep(1000)
            const { media, metadata } = x.result
            await m.reply({
                audio: { url: media },
                mimetype: 'audio/mp4',
                fileName: `${metadata?.id || "audio"}.mp3`,
                ptt: false
            }).catch(async () => {
                await m.reply({
                    audio: { url: zer.urlmp3 },
                    mimetype: "audio/mpeg",
                    fileName: `${Func.randomInt(1, 10000000) || "audio"}.mp3`,
                    caption: "here you gooo",
                })
            })
        } catch (err) {
            console.log(err)
            m.reply("[♠️] Failed to find song.")
        }
    }
})

commands.add({
    name: ["playaudio", "song"],
    command: ["playaudio"],
    alias: ["song"],
    category: "downloader",
    limit: 5,
    query: true,
    cooldown: 30,
    desc: "Search for a song and provide its audio media",
    run: async ({ rav, m, args, Func, dl }) => {
        try {
            const txt = args.join(" ")
            if (!txt) return m.reply("[♠️] Please provide the song title you want to play!")
            //m.reply({ react: { text: "🕣", key: m.key }})
            const li = await yts.search(txt)
            const morrow = li.all[0]
            if (!morrow || !morrow.url) return m.reply("[♠️] No results found.")
            const x = await Func.fetchJson(`https://fastrestapis.fasturl.cloud/downup/ytmp3?url=${encodeURIComponent(morrow.url)}&quality=128kbps&server=auto`)
            const zer = await dl.youtube(morrow.url)
            await Func.sleep(1000)
            const { media, metadata } = x.result
            await m.reply({
                audio: { url: media },
                mimetype: 'audio/mp4',
                fileName: `${metadata?.id || "audio"}.mp3`,
                ptt: false,
                contextInfo: {
                    externalAdReply: {
                        title: morrow.title,
                        body: morrow.description,
                        thumbnailUrl: morrow.thumbnail,
                        renderLargerThumbnail: true,
                        mediaType: 1,
                        previewType: "PHOTO",
                        mediaUrl: morrow.url,
                        sourceUrl: morrow.url
                    }
                }
            }).catch(async () => {
                await m.reply({
                    audio: { url: zer.urlmp3 },
                    mimetype: "audio/mpeg",
                    fileName: `${Func.randomInt(1, 10000000) || "audio"}.mp3`,
                    caption: "here you gooo",
                })
            })
        } catch (err) {
            console.log(err)
            m.reply("[♠️] Failed to find song.")
        }
    }
})


commands.add({
    name: ["playvideo"],
    command: ["playvideo"],
    category: "downloader",
    limit: 5,
    query: true,
    cooldown: 30,
    desc: "Search for a YouTube video and send it!",
    run: async ({ rav, m, args, Func, dl }) => {
        try {
            const txt = args.join(" ")
            if (!txt) return m.reply("[♠️] Please provide the video title you want to play!")
            //m.reply({ react: { text: "🕣", key: m.key }})
            const op = await yts.search(txt)
            const morrow = op.all[0]
            if (!morrow || !morrow.url) return m.reply("[♠️] No results found.")
            const teksnya = `
*––––––『 VIDEO 』––––––*

*▢ Title         :* ${morrow.title || 'Not available'}
*▢ Description  :* ${morrow.description || 'Not available'}
*▢ Channel     :* ${morrow.author?.name || 'Not available'}
*▢ Duration     :* ${morrow.seconds || 'Not available'} second (${morrow.timestamp || 'Not available'})
*▢ Source       :* ${morrow.url || 'Not available'}
`.trim()
            const zer = await dl.youtube(morrow.url)
            const vid = await Func.fetchJson(`https://fastrestapis.fasturl.cloud/downup/ytmp4?url=${encodeURIComponent(morrow.url)}&quality=480&server=auto`)
            const res = vid.result
            m.reply({
                video: { url: res.media },
                caption: teksnya,
                mimetype: 'video/mp4'
            }).catch(async () => {
                await m.reply({
                    audio: { url: y.urlmp3 },
                    mimetype: "audio/mpeg",
                    fileName: `${Func.randomInt(1, 10000000) || "audio"}.mp3`,
                    caption: "here you gooo",
                })
            })
        } catch (e) {
            console.log(e)
        }
    }
})