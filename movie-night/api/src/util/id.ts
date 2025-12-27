export function newId(len = 10) {
  // URL-safe-ish
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export function nowIso() {
  return new Date().toISOString();
}
