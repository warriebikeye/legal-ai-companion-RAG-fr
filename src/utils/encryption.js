// src/utils/encryption.js
//
// Frontend AES-256-GCM encryption/decryption using Web Crypto API
// + FIXED key derivation (SHA-256, matches backend exactly)
// + FIXED encryptedFetch (stable + consistent JSON return + error handling)

const SECRET = process.env.REACT_APP_ENCRYPTION_SECRET;

/* =========================================================
   Key derivation (SHA-256 → AES-GCM key)
   MUST MATCH BACKEND: crypto.createHash("sha256").update(secret).digest()
========================================================= */
let _cachedKey = null;

async function getDerivedKey() {
    if (_cachedKey) return _cachedKey;

    if (!SECRET) {
        throw new Error("[encryption] REACT_APP_ENCRYPTION_SECRET is not set");
    }

    const encoder = new TextEncoder();
    const hash = await window.crypto.subtle.digest(
        "SHA-256",
        encoder.encode(SECRET)
    );

    _cachedKey = await window.crypto.subtle.importKey(
        "raw",
        hash,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );

    return _cachedKey;
}

/* =========================================================
   Helpers
========================================================= */
function bufToHex(buf) {
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function hexToBuf(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes.buffer;
}

/* =========================================================
   Encrypt
========================================================= */
export async function encryptBody(data) {
    const key = await getDerivedKey();

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(data));

    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv, tagLength: 128 },
        key,
        plaintext
    );

    const encBytes = new Uint8Array(encrypted);

    const ciphertext = encBytes.slice(0, encBytes.length - 16);
    const tag = encBytes.slice(encBytes.length - 16);

    return {
        iv: bufToHex(iv.buffer),
        tag: bufToHex(tag.buffer),
        ciphertext: bufToHex(ciphertext.buffer),
    };
}

/* =========================================================
   Decrypt
========================================================= */
export async function decryptBody(payload) {
    const key = await getDerivedKey();

    const iv = new Uint8Array(hexToBuf(payload.iv));
    const ciphertext = new Uint8Array(hexToBuf(payload.ciphertext));
    const tag = new Uint8Array(hexToBuf(payload.tag));

    // WebCrypto expects ciphertext + tag together in ONE buffer
    const full = new Uint8Array(ciphertext.length + tag.length);

    full.set(ciphertext);
    full.set(tag, ciphertext.length);

    try {
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv,
                tagLength: 128,
            },
            key,
            full
        );

        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decrypted));
    } catch (err) {
        console.error("❌ DECRYPT FAILED");
        console.log({
            iv,
            ciphertext,
            tag,
        });
        throw err;
    }
}

/* =========================================================
   Detect encrypted payload
========================================================= */
function isEncryptedPayload(data) {
    return (
        data &&
        typeof data === "object" &&
        typeof data.iv === "string" &&
        typeof data.tag === "string" &&
        typeof data.ciphertext === "string"
    );
}

/* =========================================================
   FIXED encryptedFetch
   - Always resolves to the final JSON DATA (never a Response object)
   - Decrypts encrypted responses automatically
   - Throws on non-2xx HTTP status (after decrypting, if applicable)
     so callers can use normal try/catch instead of checking `.ok`
   - No clone() bug, no silent failure masking
========================================================= */
export async function encryptedFetch(url, options = {}) {
    const { body, method = "GET", ...rest } = options;

    let finalBody = body;
    let finalHeaders = { ...(options.headers || {}) };

    // Encrypt outgoing request body
    if (body && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
        const parsed =
            typeof body === "string" ? JSON.parse(body) : body;

        const encrypted = await encryptBody(parsed);
        finalBody = JSON.stringify(encrypted);
        finalHeaders["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
        method,
        ...rest,
        headers: finalHeaders,
        body: finalBody,
    });

    const text = await response.text();

    // Empty body (e.g. 204 No Content)
    if (!text) {
        if (!response.ok) {
            throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }
        return null;
    }

    let data;
    try {
        data = JSON.parse(text);
    } catch {
        // not JSON → treat as raw text
        if (!response.ok) {
            throw new Error(text || `Request failed: ${response.status} ${response.statusText}`);
        }
        return text;
    }

    // Decrypt if needed (errors can be encrypted too)
    if (isEncryptedPayload(data)) {
        data = await decryptBody(data);
    }

    // Surface non-2xx responses as thrown errors so callers can use try/catch
    if (!response.ok) {
        const message =
            (data && (data.error || data.message)) ||
            `Request failed: ${response.status} ${response.statusText}`;
        const err = new Error(message);
        err.status = response.status;
        err.data = data;
        throw err;
    }

    return data;
}