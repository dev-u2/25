
export function createNewsletterContext() {
    return {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363400575205721@newsletter',
            newsletterName: '𝗛𝗜𝗦𝗢𝗞𝗔-𝗠𝗗',
            serverMessageId: 143
        }
    };
}

export function sendWithNewsletter(conn, jid, content, options = {}) {
    const newsletterContext = createNewsletterContext();
    
    if (typeof content === 'string') {
        return conn.sendMessage(jid, {
            text: content,
            contextInfo: newsletterContext
        }, options);
    } else if (typeof content === 'object') {
        return conn.sendMessage(jid, {
            ...content,
            contextInfo: {
                ...content.contextInfo,
                ...newsletterContext
            }
        }, options);
    }
}
