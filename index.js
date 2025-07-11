import path from "path"
import chalk from "chalk"
import { spawn } from "child_process"
import { fileURLToPath } from "url"
import { dirname } from "path"
import fs from "fs"
import os from "os"
import { printStartupBanner } from "./lib/myfunction.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const BOT_ENTRY = path.join(__dirname, "lib/socket.js")
const NODE_BINARY = process.argv[0]
const ER_LOG = path.join(__dirname, "lib/error.log")

// make sure error log file exists
if (!fs.existsSync(ER_LOG)) fs.writeFileSync(ER_LOG, "")

const unhandledRejections = new Map()

const logToFile = (type, err) => {
    const logMsg = `[${new Date().toISOString()}] ${type}: ${err.stack || err}\n`
    fs.appendFileSync(ER_LOG, logMsg)
}

function launchBotInstance() {
    const processArgs = [BOT_ENTRY, ...process.argv.slice(2)]
    const botProcess = spawn(NODE_BINARY, processArgs, {
        stdio: ["inherit", "inherit", "inherit", "ipc"],
        detached: true
    })

    const handleProcessMessage = (message) => {
        switch (message) {
            case "reset":
                console.log(chalk.yellow.bold("[ SYSTEM ] Restarting bot instance..."))
                botProcess.off("message", handleProcessMessage)
                botProcess.kill()
                launchBotInstance()
                break
            case "uptime":
                botProcess.send(process.uptime())
                break
        }
    }

    botProcess
        .on("message", handleProcessMessage)
        .on("exit", (exitCode) => {
            if (exitCode !== 0) {
                console.error(chalk.red.bold(`[ CRASH ] Bot terminated unexpectedly! Exit code: ${exitCode}`))
                setTimeout(launchBotInstance, 1000)
            } else {
                console.log(chalk.green.bold("[ SYSTEM ] Bot shutdown gracefully"))
                process.exit(0)
            }
        })

    // error handler to make bot more resilient
    process.on("uncaughtException", (err) => {
        if (err?.code === "ENOMEM") {
            console.error("⚠️ Memory full (uncaughtException)!")
        } else {
            console.error("❌ Uncaught Exception:", err)
        }
        logToFile("uncaughtException", err)
    })

    process.on("unhandledRejection", (reason, promise) => {
        unhandledRejections.set(promise, reason)
        if (reason?.code === "ENOMEM") {
            console.error("⚠️ Memory full (unhandledRejection)!")
        } else {
            console.error("❌ Unhandled Rejection at:", promise, "\nReason:", reason)
        }
        logToFile("unhandledRejection", reason)
    })

    process.on("rejectionHandled", (promise) => {
        unhandledRejections.delete(promise)
    })

    process.on("exit", (code) => {
        console.warn(`⚠️ Process exiting with code: ${code}`)
        botProcess.kill()
    })

    process.on("beforeExit", (code) => {
        console.log(`💡 beforeExit (${code})...`)
    })

    process.on("SIGINT", () => {
        console.warn("📴 Detected CTRL+C (SIGINT)")
        // process.exit(0) 
        // uncomment if you want to exit, probably not needed
    })

    process.on("warning", (warning) => {
        if (warning.name === "MaxListenersExceededWarning") {
            console.warn("⚠️ Too many listeners! Watch out for memory leaks:", warning.message)
        } else {
            console.warn("⚠️ Warning:", warning.name, "-", warning.message)
        }
        logToFile("warning", warning)
    })

    process.on("multipleResolves", (type, promise, reason) => {
        console.warn("⚠️ Multiple Resolves Detected")
        console.warn("→ type:", type)
        console.warn("→ promise:", promise)
        console.warn("→ reason:", reason)
        logToFile("multipleResolves", reason)
    })
}

// startup info
console.log(chalk.red.bold(`
╔══════════════════════════════════════════════════╗
║               SYSTEM ENVIRONMENT                 ║
╚══════════════════════════════════════════════════╝
  - Platform    : ${chalk.yellow.bold(os.platform())}
  - Release     : ${chalk.yellow.bold(os.release())}
  - Architecture: ${chalk.yellow.bold(os.arch())}
  - Hostname    : ${chalk.yellow.bold(os.hostname())}
  - Total RAM   : ${chalk.yellow.bold(`${(os.totalmem() / 1024 / 1024).toFixed(2)} MB`)}
  - Developer    : ${chalk.yellow.bold("@hhhisoka-bot")}
  - Free RAM    : ${chalk.yellow.bold(`${(os.freemem() / 1024 / 1024).toFixed(2)} MB`)}
  - Message     : ${chalk.yellow.bold("Enjoy the source code")}
`))

console.log(chalk.yellow.bold("[=============== STARTING BOT INSTANCE ===============]"))

try {
    launchBotInstance()
    printStartupBanner()
} catch (err) {
    console.error(chalk.red.bold("[ BOOT FAILURE ] Initialization error:"), err)
    logToFile("boot_failure", err)
}