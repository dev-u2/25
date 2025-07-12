import chalk from "chalk"
import { exec } from "child_process"
import fs from "fs"

export class ErrorHandler {
  constructor() {
    this.errorCounts = new Map()
    this.lastErrorTime = new Map()
    this.maxErrorsPerMinute = 10
  }

  shouldIgnoreError(error) {
    const ignorableErrors = [
      "Bad MAC",
      "Failed to decrypt",
      "Serialize is not defined",
      "Connection timeout",
      "ECONNRESET",
      "ENOTFOUND",
    ]

    return ignorableErrors.some((pattern) => error.message?.includes(pattern))
  }

  isRateLimited(errorType) {
    const now = Date.now()
    const lastTime = this.lastErrorTime.get(errorType) || 0
    const count = this.errorCounts.get(errorType) || 0

    // Reset counter if more than 1 minute has passed
    if (now - lastTime > 60000) {
      this.errorCounts.set(errorType, 1)
      this.lastErrorTime.set(errorType, now)
      return false
    }

    // Check if we've exceeded the rate limit
    if (count >= this.maxErrorsPerMinute) {
      return true
    }

    this.errorCounts.set(errorType, count + 1)
    this.lastErrorTime.set(errorType, now)
    return false
  }

  async handleSessionError(error) {
    if (this.isRateLimited("session")) {
      console.log(chalk.yellow("⚠️ Session error rate limited"))
      return false
    }

    console.log(chalk.yellow("🔧 Handling session error:"), error.message)

    try {
      if (error.message?.includes("Bad MAC")) {
        await this.cleanCorruptedSessions()
        return true
      }

      if (error.message?.includes("Failed to decrypt")) {
        await this.resetAuthState()
        return true
      }

      return false
    } catch (cleanupError) {
      console.error("Error during session cleanup:", cleanupError)
      return false
    }
  }

  async cleanCorruptedSessions() {
    return new Promise((resolve) => {
      exec('find ./rav -name "session-*.json" -delete', (error) => {
        if (!error) {
          console.log(chalk.green("✅ Corrupted sessions cleaned"))
        }
        resolve(!error)
      })
    })
  }

  async resetAuthState() {
    return new Promise((resolve) => {
      exec("rm -f ./rav/creds.json", (error) => {
        if (!error) {
          console.log(chalk.green("✅ Auth state reset"))
        }
        resolve(!error)
      })
    })
  }

  logError(error, context = "") {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] ${context}: ${error.stack || error.message}\n`

    try {
      fs.appendFileSync("./lib/error.log", logEntry)
    } catch (writeError) {
      console.error("Failed to write error log:", writeError)
    }
  }
}

export const globalErrorHandler = new ErrorHandler()
