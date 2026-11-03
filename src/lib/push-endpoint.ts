import { isIP } from "node:net";

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".home", ".lan"];

/**
 * Un endpoint push est fourni par le navigateur. On refuse les protocoles non
 * HTTPS et les hôtes manifestement internes pour éviter d'utiliser l'envoi
 * push comme relais SSRF depuis le serveur.
 */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;

    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (!host) return false;
    if (host === "localhost" || host.endsWith(".localhost")) return false;
    if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false;

    if (isIP(host) !== 0) return !isPrivateIp(host);
    return true;
  } catch {
    return false;
  }
}

function isPrivateIp(address: string): boolean {
  if (address.includes(":")) {
    const ip = address.toLowerCase();
    if (ip === "::" || ip === "::1") return true;
    if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // fc00::/7
    if (/^fe[89ab]/.test(ip)) return true; // fe80::/10
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateIp(mapped[1]) : false;
  }

  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}
