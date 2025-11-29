/**
 * Logger utilitário que só loga em desenvolvimento
 * Remove todos os logs em produção para melhorar performance
 * Funciona tanto no cliente quanto no servidor
 */

const isDevelopment = 
  typeof process !== "undefined" 
    ? process.env.NODE_ENV === "development"
    : typeof window !== "undefined" && window.location.hostname === "localhost";

export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  error: (...args: unknown[]) => {
    // Erros sempre são logados, mas apenas em desenvolvimento mostram stack trace completo
    if (isDevelopment) {
      console.error(...args);
    } else {
      // Em produção, apenas logar erros críticos sem detalhes sensíveis
      const message = args[0] instanceof Error ? args[0].message : String(args[0]);
      console.error(message);
    }
  },
  
  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
  
  /**
   * Logger com prefixo para facilitar identificação em logs
   */
  withPrefix: (prefix: string) => ({
    log: (...args: unknown[]) => logger.log(`[${prefix}]`, ...args),
    error: (...args: unknown[]) => logger.error(`[${prefix}]`, ...args),
    warn: (...args: unknown[]) => logger.warn(`[${prefix}]`, ...args),
    info: (...args: unknown[]) => logger.info(`[${prefix}]`, ...args),
    debug: (...args: unknown[]) => logger.debug(`[${prefix}]`, ...args),
  }),
};

