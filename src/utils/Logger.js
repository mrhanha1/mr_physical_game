export class Logger {
  static log(tag, msg) { console.log(`[${tag}] ${msg}`) }
  static warn(tag, msg) { console.warn(`[${tag}] ${msg}`) }
  static error(tag, msg) { console.error(`[${tag}] ${msg}`) }
}