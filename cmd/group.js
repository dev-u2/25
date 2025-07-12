import fs from "fs"
import chalk from "chalk"

const groupInviteCache = new Map()

// Converts a phone number string to WhatsApp jid format (e.g. "628123456789" -> "628123456789@s.whatsapp.net")
const formatNumber = (input) => {
    const num = input?.replace(/\D/g, "")
    return num ? `${num}@s.whatsapp.net` : null
}

commands.add({
    name: ["group", "add", "kick", "promote", "demote", "resetlink", "linkgroup", "tagall", "hidetag", "totag", "delete"],
    command: ["group", "+member", "add", "-member", "kick", "+admin", "promote", "-admin", "demote", "resetlink", "linkgroup", "linkgrup", "linkgc", "tagall", "hidetag", "totag", "delete"],
    alias: ["linkgc","linkgrup","h","del","d"],
    category: "group",
    desc: "Manage group actions such as adding/removing members, promoting/demoting admins, and more.",
    admin: true,
    group: true,
    botAdmin: true,
    run: async ({ rav, m, args }) => {
        const target = formatNumber(args.join(" ")) || m.quoted?.sender

        try {
            switch (m.command.toLowerCase()) {
                // Add member(s) to the group
                case "add":
                case "+member": {
                    if (!target) return m.reply(`*Example:* ${m.prefix + m.command} 627384747758`)
                    const results = await rav.groupParticipantsUpdate(m.chat, [target], "add")
                    const statusMessages = {
                        200: `Successfully added @${target.split("@")[0]} to the group!`,
                        401: "They blocked the bot!",
                        409: "They are already in the group!",
                        500: "Group is full!"
                    }

                    for (const result of results) {
                        if (statusMessages[result.status]) {
                            await m.reply(statusMessages[result.status])
                            continue
                        }
                        // If target recently left and privacy is on, send private invite
                        if (result.status === 408) {
                            const inviteCode = await getCachedInvite(rav, m.chat)
                            await m.reply(`@${target.split("@")[0]} recently left this group!\n\nDue to privacy settings, an invite has been sent privately:\n-> wa.me/${target.replace(/\D/g, "")}`)
                            await sendPrivateInvite(rav, target, inviteCode, m)
                        } else if (result.status === 403) {
                            // Invite the user manually if cannot add directly
                            const { code, expiration } = result.content.content[0].attrs
                            await rav.sendGroupInvite(
                                m.chat,
                                target,
                                code,
                                expiration,
                                m.metadata.subject,
                                `Admin: @${m.sender.split("@")[0]}\nInvites you to join this group\nFeel free to join 🙇`,
                                null,
                                { mentions: [m.sender] }
                            )
                            await m.reply(`@${target.split("@")[0]} cannot be added directly.\nAn invite has been sent privately:\n-> wa.me/${target.replace(/\D/g, "")}`)
                        } else {
                            await m.reply(`[×] Failed to add user\nStatus: ${result.status}`)
                        }
                    }
                    break
                }

                // Remove member from group
                case "kick":
                case "-member": {
                    if (!target) return m.reply(`Example: ${m.prefix + m.command} 623873621136`)
                    await rav.groupParticipantsUpdate(m.chat, [target], "remove")
                    break
                }

                // Promote member to admin
                case "promote":
                case "+admin": {
                    if (!target) return m.reply(`Example: ${m.prefix + m.command} 623873621136`)
                    await rav.groupParticipantsUpdate(m.chat, [target], "promote")
                    await m.reply("[√] Success")
                    break
                }

                // Demote admin to member
                case "demote":
                case "-admin": {
                    if (!target) return m.reply(`Example: ${m.prefix + m.command} 623873621136`)
                    await rav.groupParticipantsUpdate(m.chat, [target], "demote")
                    await m.reply("[√] Success")
                    break
                }

                // Open or close group messaging (open = all can send, close = only admins)
                case "group":
                case "grup": {
                    const setting = args[0]?.toLowerCase()
                    if (!["open", "close"].includes(setting)) {
                        return m.reply(`Usage example:\n${m.prefix}group open\n${m.prefix}group close`)
                    }
                    await rav.groupSettingUpdate(m.chat, setting === "open" ? "not_announcement" : "announcement")
                    await m.reply(`Successfully changed group setting to *${setting === "open" ? "open" : "closed"}*!`)
                    break
                }

                // Reset the group invite link
                case "resetlink": {
                    await rav.groupRevokeInvite(m.chat)
                    groupInviteCache.delete(m.chat)
                    await m.reply("[√] Successfully reset group invite link.")
                    break
                }

                // Show group invite link
                case "linkgroup":
                case "linkgrup":
                case "linkgc": {
                    const code = await getCachedInvite(rav, m.chat)
                    await m.reply(`https://chat.whatsapp.com/${code}`)
                    break
                }

                // Tag all members with an optional message
                case "tagall": {
                    const message = args.join(" ") || "-"
                    let text = `*––––––『 TAG ALL 』––––––*\n\n`
                    text += m.metadata.participants
                        .map(p => `• @${p.id.split("@")[0]}`)
                        .join("\n")
                    text += `\n\n○ Message: ${message}`
                    await m.reply(text, {
                        mentions: m.metadata.participants.map(p => p.id)
                    })
                    break
                }

                // Send message with hidden mentions (mentions everyone but does not show explicitly)
                case "hidetag":
                case "h": {
                    const message = args.join(" ") || ""
                    await m.reply(message, {
                        mentions: m.metadata.participants.map(p => p.id)
                    })
                    break
                }

                // Forward a quoted message and tag all participants
                case "totag": {
                    if (!m.quoted) return m.reply(`[×] Reply to a message with caption *${m.prefix + m.command}*`)
                    delete m.quoted.chat
                    await rav.sendMessage(m.chat, {
                        forward: m.quoted.fakeObj,
                        mentions: m.metadata.participants.map(a => a.id)
                    })
                    break
                }

                // Delete a replied message from the group
                case "delete":
                case "del":
                case "d": {
                    if (!m.quoted) return m.reply(`[×] Reply to a message with caption *${m.prefix + m.command}*`)
                    await rav.sendMessage(m.chat, {
                        delete: {
                            remoteJid: m.chat,
                            fromMe: m.isBotAdmin ? false : true,
                            id: m.quoted.id,
                            participant: m.quoted.sender
                        }
                    })
                    await m.reply({ react: { text: "✔️", key: m.key } })
                    break
                }

                default:
                    await m.reply("Command not recognized!")
            }
        } catch (e) {
            rav.cantLoad(e)
        }
    }
})

// Cache or get group invite link code
async function getCachedInvite(rav, groupId) {
    if (groupInviteCache.has(groupId)) {
        return groupInviteCache.get(groupId)
    }
    const code = await rav.groupInviteCode(groupId)
    groupInviteCache.set(groupId, code)
    return code
}

// Send group invite link privately to target user
async function sendPrivateInvite(rav, target, inviteCode, originalMsg) {
    try {
        await rav.sendMessage(target, {
            text: `https://chat.whatsapp.com/${inviteCode}\n + ------------------------------------------------------\n\n + Admin: @${originalMsg.sender.split("@")[0]}\n + Invites you to this group\nPlease join if you wish 🙇`,
            detectLink: true
        })
    } catch (err) {
        await originalMsg.reply("Failed to send invite!")
    }
}