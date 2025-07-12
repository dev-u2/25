export class ConnectionManager {
  constructor() {
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.baseDelay = 3000
    this.maxDelay = 30000
    this.isConnecting = false
    this.lastConnectionTime = 0
    this.connectionHistory = []
  }

  shouldReconnect(statusCode) {
    const reconnectableCodes = ["connectionLost", "connectionClosed", "restartRequired", "timedOut"]
    return reconnectableCodes.includes(statusCode)
  }

  shouldClearSession(statusCode) {
    const clearSessionCodes = ["badSession", "connectionReplaced", "forbidden", "multideviceMismatch", "loggedOut"]
    return clearSessionCodes.includes(statusCode)
  }

  getReconnectDelay() {
    // Exponential backoff with jitter
    const delay = Math.min(this.baseDelay * Math.pow(2, this.reconnectAttempts), this.maxDelay)
    return delay + Math.random() * 1000
  }

  canReconnect() {
    return this.reconnectAttempts < this.maxReconnectAttempts
  }

  incrementAttempts() {
    this.reconnectAttempts++
    this.connectionHistory.push({
      attempt: this.reconnectAttempts,
      timestamp: Date.now(),
    })
  }

  reset() {
    this.reconnectAttempts = 0
    this.isConnecting = false
    this.lastConnectionTime = Date.now()
  }

  setConnecting(status) {
    this.isConnecting = status
  }

  getConnectionStats() {
    return {
      attempts: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      isConnecting: this.isConnecting,
      lastConnection: this.lastConnectionTime,
      history: this.connectionHistory.slice(-5), // Last 5 attempts
    }
  }
}
