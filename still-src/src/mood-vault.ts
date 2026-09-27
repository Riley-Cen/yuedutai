// 心情记录加密后只存在本设备浏览器。写入只用公钥，读取要用口令解开私钥。
export type Entry = {
  id: string;
  intent: string;
  content: string;
  reflection: string;
  change: string;
  helpful: string;
  createdAt: string;
};
type Sealed = { id: string; epk: string; iv: string; data: string };
export type Vault = {
  v: 1;
  publicKey: JsonWebKey;
  salt: string;
  iterations: number;
  keyIv: string;
  wrappedKey: string;
  entries: Sealed[];
};

const KEY = "still-mood-vault";
const ITERATIONS = 600_000;
const curve = { name: "ECDH", namedCurve: "P-256" } as const;
const encoder = new TextEncoder();

function b64(bytes: ArrayBuffer | Uint8Array) {
  let text = "";
  for (const byte of new Uint8Array(bytes)) text += String.fromCharCode(byte);
  return btoa(text);
}
function unb64(text: string) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
function aad(label: string) {
  return encoder.encode(`still-mood-v1:${label}`);
}

export function readVault(): Vault | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}
function writeVault(vault: Vault) {
  localStorage.setItem(KEY, JSON.stringify(vault));
}
export function eraseVault() {
  localStorage.removeItem(KEY);
}

async function passphraseKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const base = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
async function entryKey(privateKey: CryptoKey, publicKey: CryptoKey, usage: KeyUsage) {
  const shared = await crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey },
    privateKey,
    256,
  );
  const base = await crypto.subtle.importKey("raw", shared, "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: aad("entry") },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

// 只在这台设备还没有口令时写入，不覆盖别的页面刚设好的。
export async function createVault(passphrase: string): Promise<Vault> {
  const pair = await crypto.subtle.generateKey(curve, true, ["deriveBits"]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyIv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: keyIv, additionalData: aad("key") },
    await passphraseKey(passphrase, salt, ITERATIONS),
    await crypto.subtle.exportKey("pkcs8", pair.privateKey),
  );
  const vault: Vault = {
    v: 1,
    publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey),
    salt: b64(salt),
    iterations: ITERATIONS,
    keyIv: b64(keyIv),
    wrappedKey: b64(wrapped),
    entries: [],
  };
  if (readVault()) throw new Error("exists");
  writeVault(vault);
  return vault;
}

// 口令不对时 AES-GCM 解密会失败并抛错。
export async function unlock(vault: Vault, passphrase: string) {
  const pkcs8 = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(vault.keyIv), additionalData: aad("key") },
    await passphraseKey(passphrase, unb64(vault.salt), vault.iterations),
    unb64(vault.wrappedKey),
  );
  return crypto.subtle.importKey("pkcs8", pkcs8, curve, false, ["deriveBits"]);
}

async function seal(vault: Vault, entry: Entry): Promise<Sealed> {
  const recipient = await crypto.subtle.importKey("jwk", vault.publicKey, curve, false, []);
  const ephemeral = await crypto.subtle.generateKey(curve, true, ["deriveBits"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad(entry.id) },
    await entryKey(ephemeral.privateKey, recipient, "encrypt"),
    encoder.encode(JSON.stringify(entry)),
  );
  return {
    id: entry.id,
    epk: b64(await crypto.subtle.exportKey("raw", ephemeral.publicKey)),
    iv: b64(iv),
    data: b64(data),
  };
}

export async function openAll(vault: Vault, privateKey: CryptoKey) {
  const entries = await Promise.all(
    vault.entries.map(async (sealed): Promise<Entry> => {
      const epk = await crypto.subtle.importKey("raw", unb64(sealed.epk), curve, false, []);
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: unb64(sealed.iv), additionalData: aad(sealed.id) },
        await entryKey(privateKey, epk, "decrypt"),
        unb64(sealed.data),
      );
      return JSON.parse(new TextDecoder().decode(plain));
    }),
  );
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// 写入前重新读取存储，只改这一条，不把旧快照整体写回：
// 别的页面新增的记录不会丢，已删除的记录或整库不会被旧的保存任务写回来。
function current(vault: Vault) {
  const stored = readVault();
  if (stored?.wrappedKey !== vault.wrappedKey) throw new Error("stale");
  return stored;
}
export async function putEntry(vault: Vault, entry: Entry, replace: boolean) {
  const sealed = await seal(vault, entry);
  const stored = current(vault);
  if (replace !== stored.entries.some((item) => item.id === entry.id))
    throw new Error("stale");
  const next = {
    ...stored,
    entries: [sealed, ...stored.entries.filter((item) => item.id !== entry.id)],
  };
  writeVault(next);
  return next;
}
export function removeEntry(vault: Vault, id: string) {
  const stored = current(vault);
  const next = { ...stored, entries: stored.entries.filter((item) => item.id !== id) };
  writeVault(next);
  return next;
}
