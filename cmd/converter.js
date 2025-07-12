import fs from "fs"
import baileys from "baileys"
import FormData from "form-data"
import fetch from "node-fetch"
import axios from "axios"
import BodyForm from "form-data"
import { toAudio, toPTT, toVideo } from "../../lib/exif.js"
import { exec } from "child_process"
import { sendWithNewsletter } from "../lib/newsletter-helper.js"
const getRandom = (ext) => {
    return `${Math.floor(Math.random() * 10000)}${ext}`;
};
const { proto, generateWAMessageContent, generateWAMessageFromContent, prepareWAMessageMedia } = baileys

commands.add({
    name: ["toptv"],
    command: ["toptv"],
    category: "converter",
    desc: "Convert video to PTV message",
    alias: ["toptvm"],
    run: async ({ rav, m }) => {
        try {
            const quoted = m.quoted ? m.quoted : m
            const mime = quoted.msg?.mimetype || ""
            if (!quoted) return sendWithNewsletter(rav, m.chat, "◇ Reply to video with *.toptv*", { quoted: m })
            if (!/video/.test(mime)) return sendWithNewsletter(rav, m.chat, "◇ Only video is supported!", { quoted: m })
            if ((m.quoted ? m.quoted.type : m.type) !== "videoMessage") return sendWithNewsletter(rav, m.chat, "◇ Reply to the video you want to convert to PTV!", { quoted: m })
            const anu = await quoted.download()
            const message = await generateWAMessageContent({ video: anu }, { upload: rav.waUploadToServer })
            await rav.relayMessage(m.chat, { ptvMessage: message.videoMessage }, {})
        } catch (e) {
            rav.cantLoad(e)
        }
    }
})

commands.add({
    name: ["tourl"],
    command: ["tourl"],
    category: "converter",
    desc: "Upload media to URL",
    alias: ["url"],
    run: async ({ rav, m, Func }) => {
        const quoted = m.quoted ? m.quoted : m;
        const mime = (quoted.msg || quoted).mimetype || '';
        if (!mime) return sendWithNewsletter(rav, m.chat, `Send/reply video/image`, { quoted: m });
		try {
			let media = await rav.downloadAndSaveMediaMessage(quoted);
			if (/image|video/.test(mime)) {
				let response = await CatBox(media);
				let fileSize = (fs.statSync(media).size / 1024).toFixed(2);
				let uploadDate = new Date().toLocaleString();
				let uploader = `${m.pushName}`;
				let caption = `> Media size : ${fileSize} ᴋʙ\n> Uploader : ${uploader}`.trim();
				let msg = generateWAMessageFromContent(m.chat, {
                    viewOnceMessage: {
                    message: {
                        interactiveMessage: {
                            body: {
                text: "Successfully converted to link URL, please copy the link from the button below!"
                            },
                        carouselMessage: {
                            cards: [{
                                header: proto.Message.InteractiveMessage.Header.create({
                                    ...(await prepareWAMessageMedia({ image: { url: response }}, { upload: rav.waUploadToServer })),
                                    title: '',
                                    gifPlayback: true,
                                    subtitle: config.bot.name,
                                    hasMediaAttachment: false
                                }),
                                body: { text: caption },
                                nativeFlowMessage: {
                                    buttons: [{
                                        "name": "cta_copy",
                                        "buttonParamsJson": `{\"display_text\":\"Click to get link\",\"id\":\"123456789\",\"copy_code\":\"${response}\"}`
                                    }],
                                },
                            }],
				        messageVersion: 1,		
			            },
			            },
                    },
                    },
                },
                { quoted: m }
                );
                await rav.relayMessage(msg.key.remoteJid, msg.message, {
                    messageId: msg.key.id,
                });
			} else if (!/image/.test(mime)) {
				let response = await CatBox(media);
				sendWithNewsletter(rav, m.chat, response, { quoted: m });
			} else {
				sendWithNewsletter(rav, m.chat, `Media type not supported!`, { quoted: m });
			}
			await fs.unlinkSync(media);
		} catch (err) {
			rav.cantLoad(err)
	    }
	}
})

commands.add({
    name: ["hd","remini"],
    command: ["hd","remini"],
    category: "tools",
    desc: "Enhance image resolution",
    limit: 10,
    cooldown: 35,
    run: async ({ rav, m, Func }) => {
        let q = m.quoted || m
        let mime = (q.msg || q).mimetype || q.mediaType || ''
        if (!mime) return sendWithNewsletter(rav, m.chat, `[♠️] Reply or send an image you want to enhance with caption ${m.prefix + m.command}`, { quoted: m })
        let wait = await m.reply({ react: { text: "🕣", key: m.key }})
        let startTime = Date.now()
        let media = await rav.downloadAndSaveMediaMessage(q)
        try {
            const imageUrl = await CatBox(media)
            const api = `https://fastrestapis.fasturl.cloud/aiimage/upscale?imageUrl=${encodeURIComponent(imageUrl)}&resize=4`
            const res = await fetch(api)
            const buffer = await res.buffer()
            let endTime = Date.now()
            let duration = ((endTime - startTime) / 1000).toFixed(2)
            await sendWithNewsletter(rav, m.chat, { image: buffer, caption: "[🃏] Successfully processed in " + duration + " seconds!"}, { quoted: m })
        } catch(e) {
            rav.cantLoad(e)
        }
    }
})

async function CatBox(filePath) {
	try {
		const fileStream = fs.createReadStream(filePath);
		const formData = new BodyForm();
		formData.append('fileToUpload', fileStream);
		formData.append('reqtype', 'fileupload');
		formData.append('userhash', '');
		const response = await axios.post('https://catbox.moe/user/api.php', formData, {
			headers: {
				...formData.getHeaders(),
			},
		});
		return response.data;
	} catch (error) {
		console.error("Error at Catbox uploader:", error);
		return "An error occurred while uploading to Catbox.";
	}
};