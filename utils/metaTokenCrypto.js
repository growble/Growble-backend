const crypto = require("crypto");

function getEncryptionKey() {
  const key = process.env.META_TOKEN_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error("META_TOKEN_ENCRYPTION_KEY must be a 32-byte hexadecimal key.");
  }
  return Buffer.from(key, "hex");
}

function encryptMetaToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptMetaToken(value) {
  if (typeof value !== "string" || !value.startsWith("enc:v1:")) {
    throw new Error("Stored Facebook Page token has an unsupported format.");
  }

  const [, , ivHex, tagHex, encryptedHex] = value.split(":");
  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error("Stored Facebook Page token is invalid.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]).toString("utf8");
}

module.exports = {
  encryptMetaToken,
  decryptMetaToken
};
