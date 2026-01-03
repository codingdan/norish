/**
 * SSRF protection: Block requests to private/internal networks.
 */

const PRIVATE_IP_PATTERNS = [
  // Localhost
  /^localhost$/i,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  // 0.0.0.0 (binds to all interfaces)
  /^0\.0\.0\.0$/,
  // 10.x.x.x
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  // 172.16.0.0 - 172.31.255.255
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  // 192.168.x.x
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  // 169.254.x.x (link-local, includes AWS metadata endpoint)
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
];

// IPv6 patterns that indicate private/internal addresses
const PRIVATE_IPV6_PATTERNS = [
  // Loopback
  /^::1$/,
  /^\[::1\]$/,
  // Link-local (fe80::/10)
  /^fe[89ab][0-9a-f]:/i,
  /^\[fe[89ab][0-9a-f]:/i,
  // Unique local (fc00::/7 - includes fd00::/8)
  /^f[cd][0-9a-f]{2}:/i,
  /^\[f[cd][0-9a-f]{2}:/i,
  // IPv4-mapped IPv6 (::ffff:x.x.x.x)
  /^::ffff:/i,
  /^\[::ffff:/i,
];

/**
 * Check if a URL points to a private/internal address.
 */
export function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Check against IPv4 private patterns
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return true;
      }
    }

    // Check against IPv6 private patterns
    for (const pattern of PRIVATE_IPV6_PATTERNS) {
      if (pattern.test(hostname)) {
        return true;
      }
    }

    // Check for .local, .internal, .localhost TLDs
    if (
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".localhost")
    ) {
      return true;
    }

    return false;
  } catch {
    // Invalid URL - will be caught by URL validation
    return false;
  }
}

/**
 * Validate that a URL is a valid, public URL.
 * Throws an error if the URL is invalid or points to private/internal addresses.
 *
 * Note: This provides string-based validation only. DNS rebinding attacks
 * (e.g., using nip.io) are not detected. For maximum security, also validate
 * resolved IP addresses at the HTTP client level.
 */
export function validatePublicUrl(urlString: string): string {
  // This will throw if invalid
  const url = new URL(urlString);

  if (isPrivateUrl(urlString)) {
    throw new Error(
      "URL points to a private or internal address. Only public URLs are allowed."
    );
  }

  // Return normalized URL (without trailing slash)
  return url.origin + url.pathname.replace(/\/+$/, "");
}
