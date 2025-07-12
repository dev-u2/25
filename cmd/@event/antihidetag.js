import { sendWithNewsletter } from "../../lib/newsletter-helper.js";

export default {
    name: "anti-hidetag",
    exec: async ({ rav, m }) => {
        const isOwner = config.owner
            .map((v) => v.replace(/[^0-9]/g, "") + "@s.whatsapp.net")
            .includes(m.sender);
        if (m.key.fromMe || !m.isGroup || m.isAdmin || !m.isBotAdmin || isOwner)
            return false;
        const setting = db.groups[m.chat] || {};
        const antihidetagAktif = setting.antihidetag;
        const semuaDisebut =
            m.mentionedJid?.length &&
            m.metadata?.participants &&
            m.mentionedJid.length === m.metadata.participants.length;
        if (antihidetagAktif && semuaDisebut) {
            await rav.sendMessage(m.chat, {
                delete: {
                    remoteJid: m.chat,
                    fromMe: false,
                    id: m.id,
                    participant: m.sender,
                },
            });
            await sendWithNewsletter(rav, m.chat, "*Anti Hidetag on!* 🚫", { quoted: m });
            return true;
        }
        return false;
    },
};
