// Production-ready logging system for IFSM Fleet Safety System

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: any
  userId?: string
  endpoint?: string
  ip?: string
  userAgent?: string
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  private formatLog(entry: LogEntry): string {
    const baseLog = `[${entry.timestamp}] ${entry.level}: ${entry.message}`
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      return `${baseLog} | Context: ${JSON.stringify(entry.context)}`
    }
    
    if (entry.userId || entry.endpoint || entry.ip) {
      const meta = []
      if (entry.userId) meta.push(`user:${entry.userId}`)
      if (entry.endpoint) meta.push(`endpoint:${entry.endpoint}`)
      if (entry.ip) meta.push(`ip:${entry.ip}`)
      return `${baseLog} | ${meta.join(' ')}`
    }
    
    return baseLog
  }

  private createLogEntry(level: LogLevel, message: string, context?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    }
  }

  error(message: string, context?: any) {
    const entry = this.createLogEntry(LogLevel.ERROR, message, context)
    const formattedLog = this.formatLog(entry)
    
    console.error(formattedLog)
    
    // In production, you would send this to a logging service
    if (!this.isDevelopment) {
      // TODO: Send to logging service (e.g., Sentry, LogRocket, DataDog)
      this.sendToLoggingService(entry)
    }
  }

  warn(message: string, context?: any) {
    const entry = this.createLogEntry(LogLevel.WARN, message, context)
    const formattedLog = this.formatLog(entry)
    
    console.warn(formattedLog)
    
    if (!this.isDevelopment) {
      this.sendToLoggingService(entry)
    }
  }

  info(message: string, context?: any) {
    const entry = this.createLogEntry(LogLevel.INFO, message, context)
    const formattedLog = this.formatLog(entry)
    
    if (this.isDevelopment) {
      console.info(formattedLog)
    } else {
      // Only send info logs to service in production
      this.sendToLoggingService(entry)
    }
  }

  debug(message: string, context?: any) {
    if (this.isDevelopment) {
      const entry = this.createLogEntry(LogLevel.DEBUG, message, context)
      const formattedLog = this.formatLog(entry)
      console.debug(formattedLog)
    }
  }

  private async sendToLoggingService(entry: LogEntry) {
    // Placeholder for production logging service integration
    // This could be Sentry, LogRocket, DataDog, or a custom logging service
    try {
      // Example: await fetch('https://logging-service.com/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(entry)
      // })
    } catch (error) {
      // Fail silently to avoid infinite loops
      console.error('Failed to send log to logging service:', error)
    }
  }

  // API request logging helper
  logApiRequest(endpoint: string, method: string, userId?: string, ip?: string, userAgent?: string) {
    this.info(`API Request: ${method} ${endpoint}`, {
      endpoint,
      method,
      userId,
      ip,
      userAgent
    })
  }

  // API error logging helper
  logApiError(endpoint: string, error: any, userId?: string, context?: any) {
    this.error(`API Error: ${endpoint}`, {
      endpoint,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      userId,
      ...context
    })
  }

  // Database operation logging
  logDatabaseOperation(operation: string, table: string, userId?: string, context?: any) {
    this.debug(`DB Operation: ${operation} on ${table}`, {
      operation,
      table,
      userId,
      ...context
    })
  }

  // Security event logging
  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high', context?: any) {
    const level = severity === 'high' ? LogLevel.ERROR : severity === 'medium' ? LogLevel.WARN : LogLevel.INFO
    const entry = this.createLogEntry(level, `Security Event: ${event}`, context)
    const formattedLog = this.formatLog(entry)
    
    console.error(formattedLog) // Always log security events
    
    if (!this.isDevelopment) {
      this.sendToLoggingService(entry)
    }
  }
}

// Export singleton instance
export const logger = new Logger()

