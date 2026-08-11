const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 310_000;

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) throw new Error("invalid_hex");
  return Uint8Array.from(value.match(/.{2}/g)!, (pair) => Number.parseInt(pair, 16));
}

function safeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function sha256Hex(value: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return `pbkdf2_sha256$${iterations}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPbkdf2(password: string, stored: string): Promise<boolean> {
  try {
    const [algorithm, iterationText, saltHex, hashHex] = stored.split("$");
    if (algorithm !== "pbkdf2_sha256") return false;
    const iterations = Number(iterationText);
    if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
    const expected = fromHex(hashHex);
    const actual = await derive(password, fromHex(saltHex), iterations);
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function verifyLegacyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const actual = await sha256Hex(`${salt}${password}`);
  try {
    return safeEqual(fromHex(actual), fromHex(hash));
  } catch {
    return false;
  }
}

export async function verifyTempPassword(password: string, hash: string, clinicSecret: string): Promise<boolean> {
  const actual = await sha256Hex(`${password}_${clinicSecret}`);
  try {
    return safeEqual(fromHex(actual), fromHex(hash));
  } catch {
    return false;
  }
}
