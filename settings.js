
export default {
    bot: {
        name: "𝕽𝖆𝖛𝖊𝖓",
        number: "", // Entrez le numéro de votre bot ici
        footer: "© 𝕽𝖆𝖛𝖊𝖓| WhatsApp MD",
        group: "https://chat.whatsapp.com/CS8hCYxwnj5CAuo7XeZNa3",
        packname: "𝕽𝖆𝖛𝖊𝖓",
        author: "@hhhisoka-bot",
        wm: "© 𝕽𝖆𝖛𝖊𝖓 - WhatsApp Bot"
    },
    
    sticker: {
        packname: "𝕽𝖆𝖛𝖊𝖓",
        author: "@hhhisoka-bot"
    },
    
    // Configuration du propriétaire
    creator: "2250757485069@s.whatsapp.net", // Remplacez par votre numéro
    owner: ["2250757485069"], // Remplacez par votre numéro sans @s.whatsapp.net
    
    // Images et médias
    thumb: {
        reply: "https://i.pinimg.com/originals/20/15/4a/20154a72a9b841345cb3f7ad8ba8683a.jpg",
        menu: "https://i.pinimg.com/originals/20/15/4a/20154a72a9b841345cb3f7ad8ba8683a.jpg"
    },
    
    // Liens sociaux
    github: "https://github.com/hhhisoka-bot",
    instagram: "https://instagram.com/sadp_sy",
    group: "https://chat.whatsapp.com/GBN7EQJX5XV7QeJVdt9HNy",
    
    // Messages système
    mess: {
        success: "[🃏] Succès",
        owner: "Désolé, cette fonctionnalité est réservée au propriétaire.",
        limit: "Votre limite a été épuisée, tapez .getlimit pour obtenir une limite gratuite supplémentaire.",
        group: "Cette fonctionnalité ne peut être utilisée que dans les groupes.",
        privatechat: "Cette fonctionnalité ne peut être utilisée qu'en chat privé.",
        admin: "Cette fonctionnalité ne peut être utilisée que par les administrateurs du groupe.",
        botAdmin: "Le bot doit être administrateur pour exécuter cette fonctionnalité.",
        failed: "Échec de l'exécution de la commande, réessayez plus tard.",
        disabled: "Désolé, cette fonctionnalité est actuellement désactivée par le propriétaire !",
        regist: "Veuillez vous inscrire d'abord pour utiliser cette fonctionnalité !\n\n> Tapez *#register nom.âge* pour vous inscrire",
        wait: "⏳ Veuillez patienter...",
        done: "✅ Terminé !",
        error: "❌ Une erreur s'est produite"
    },
    
    // Configuration bot
    tagAI: true, // Afficher la marque "AI" dans les messages privés
    badWords: ["salopard", "imbecil", "batard"], // Mots interdits
    PREFIX: ".", // Préfixe unique pour les commandes
    NEWSLETTER_JID: "120363400575205721@newsletter",
    
    // Configuration IA
    prompt: "Votre nom est Raven, vous êtes un bot WhatsApp créé par raven-hisoka. Si quelqu'un demande des informations sur vous ou votre créateur, dites-lui de taper .owner pour en savoir plus sur votre créateur, mais seulement si nécessaire, ne le répétez pas sans cesse. Ne commencez pas vos messages par des majuscules, vous êtes très humoristique, drôle, chaleureux et bavard quand vous parlez mais vous avez une nature bonne et polie. Même si vous êtes un bot WhatsApp, vous devez toujours être un assistant multifonctionnel, capable de faire tout ce que les utilisateurs demandent. Si les utilisateurs demandent quelque chose, vous devez répondre à tout ce qu'ils demandent sérieusement, précisément, de manière détaillée et avec précision.",
    
    // Configuration serveur
    PORT: 3000, // Port du serveur
    database: "database.json", // Si vous ne savez pas, ne changez pas
    channel: "120363400575205721@newsletter",
    
    // Configuration avancée
    autoTyping: true, // Indicateur de frappe automatique
    autoRead: true, // Lecture automatique des messages
    antiSpam: true, // Protection anti-spam
    antiCall: true, // Blocage automatique des appels
    publicMode: true, // Mode public du bot
    
    // Limites et cooldowns
    defaultCooldown: 3, // Cooldown par défaut en secondes
    ownerCooldown: 0, // Pas de cooldown pour le propriétaire
    maxCommands: 50, // Limite de commandes par utilisateur par jour
    
    // Configuration des groupes
    autoJoinNewsletter: true, // Rejoindre automatiquement le newsletter
    sendWelcomeMessage: true, // Envoyer un message de bienvenue
    
    // API Keys (à configurer selon vos besoins)
    apis: {
        // Ajoutez vos clés API ici
    },
    
    // Configuration de développement
    debug: false, // Mode debug
    logLevel: "info" // Niveau de log
}
