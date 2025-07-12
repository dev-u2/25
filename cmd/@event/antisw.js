export default {
	name: "anti-tagsw",
	exec: async ({ rav, m }) => {
		const isOwner = config.owner.map(v => v.replace(/[^0-9]/g, "") + "@s.whatsapp.net").includes(m.sender)
		if (m.key.fromMe || !m.isGroup || m.isAdmin || !m.isBotAdmin || isOwner) return false;
		let setgroups = db.groups[m.chat] || {}
		if (m.type === "groupStatusMentionMessage" || m.message?.groupStatusMentionMessage || m.message?.protocolMessage?.type === 25 || Object.keys(m.message).length === 1 && Object.keys(m.message)[0] === "messageContextInfo" && setgroups.antitagsw) {
			if (!setgroups.tagsw[m.sender]) {
				setgroups.tagsw[m.sender] = 1
				await m.reply(`This group was detected being tagged in WhatsApp Status\n@${m.sender.split("@")[0]}, please do not tag the group in WhatsApp status\nWarning ${setgroups.tagsw[m.sender]}/5, will be kicked if limit is reached❗`)
				await rav.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.id, participant: m.sender } })
				return true;
			} else if (setgroups.tagsw[m.sender] >= 5) {
				await rav.groupParticipantsUpdate(m.chat, [m.sender], "remove").catch((err) => m.reply("Failed!"))
				await m.reply(`@${m.sender.split("@")[0]} has been removed from the group\nFor tagging the group in WhatsApp status 5 times`)
				await rav.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.id, participant: m.sender } })
				delete setgroups.tagsw[m.sender]
				return true;
			} else {
				setgroups.tagsw[m.sender] += 1
				await m.reply(`This group was detected being tagged in WhatsApp Status\n@${m.sender.split("@")[0]}, please do not tag the group in WhatsApp status\nWarning ${setgroups.tagsw[m.sender]}/5, will be kicked when warning reaches the limit❗`)
				await rav.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.id, participant: m.sender } })
				return true;
			}
		}
		return false;
	}
}