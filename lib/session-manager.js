import fs from "fs"
import path from "path"
import chalk from "chalk"
import { exec } from "child_process"

export class SessionManager {
  constructor(sessionPath = "./rav") {
    this.sessionPath = sessionPath
    this.backupPath = "./rav-backup"
  }

  async createBackup() {
    try {
      if (!fs.existsSync(this.sessionPath)) return false

      // Create backup directory if it doesn't exist
      if (!fs.existsSync(this.backupPath)) {
        fs.mkdirSync(this.backupPath, { recursive: true })
      }

      // Copy session files to backup
      const timestamp = Date.now()
      const backupDir = path.join(this.backupPath, `session-${timestamp}`)

      await new Promise((resolve, reject) => {
        exec(`cp -r ${this.sessionPath} ${backupDir}`, (error) => {
          if (error) reject(error)
          else resolve()
        })
      })

      console.log(chalk.green("✅ Session backup created"))
      return true
    } catch (error) {
      console.error("Backup creation failed:", error)
      return false
    }
  }

  async restoreFromBackup() {
    try {
      if (!fs.existsSync(this.backupPath)) return false

      // Find the most recent backup
      const backups = fs
        .readdirSync(this.backupPath)
        .filter((dir) => dir.startsWith("session-"))
        .sort()
        .reverse()

      if (backups.length === 0) return false

      const latestBackup = path.join(this.backupPath, backups[0])

      // Remove current session
      await this.clearSession()

      // Restore from backup
      await new Promise((resolve, reject) => {
        exec(`cp -r ${latestBackup}/* ${this.sessionPath}/`, (error) => {
          if (error) reject(error)
          else resolve()
        })
      })

      console.log(chalk.green("✅ Session restored from backup"))
      return true
    } catch (error) {
      console.error("Backup restoration failed:", error)
      return false
    }
  }

  async clearSession() {
    try {
      if (fs.existsSync(this.sessionPath)) {
        await new Promise((resolve, reject) => {
          exec(`rm -rf ${this.sessionPath}/*`, (error) => {
            if (error) reject(error)
            else resolve()
          })
        })
      }
      console.log(chalk.green("✅ Session cleared"))
      return true
    } catch (error) {
      console.error("Session clearing failed:", error)
      return false
    }
  }

  async cleanOldSessions() {
    try {
      // Remove session files older than 24 hours
      await new Promise((resolve) => {
        exec('find ./rav -name "session-*.json" -mtime +1 -delete', () => {
          resolve()
        })
      })

      // Clean old backups (keep only last 5)
      if (fs.existsSync(this.backupPath)) {
        const backups = fs
          .readdirSync(this.backupPath)
          .filter((dir) => dir.startsWith("session-"))
          .sort()
          .reverse()

        if (backups.length > 5) {
          const toDelete = backups.slice(5)
          for (const backup of toDelete) {
            await new Promise((resolve) => {
              exec(`rm -rf ${path.join(this.backupPath, backup)}`, () => {
                resolve()
              })
            })
          }
        }
      }

      console.log(chalk.blue("🧹 Old sessions cleaned"))
    } catch (error) {
      console.error("Session cleanup failed:", error)
    }
  }

  getSessionInfo() {
    try {
      if (!fs.existsSync(this.sessionPath)) {
        return { exists: false }
      }

      const files = fs.readdirSync(this.sessionPath)
      const credsExists = files.includes("creds.json")
      const sessionFiles = files.filter((f) => f.startsWith("session-"))

      return {
        exists: true,
        hasCredentials: credsExists,
        sessionFileCount: sessionFiles.length,
        files: files,
      }
    } catch (error) {
      return { exists: false, error: error.message }
    }
  }
}
