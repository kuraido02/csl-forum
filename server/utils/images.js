const fs = require("fs");
const path = require("path");

// Where post images are stored: server/uploads/posts
const postDir = path.join(__dirname, "..", "uploads", "posts");
fs.mkdirSync(postDir, { recursive: true });

// Look at the first bytes of the file to find out what it REALLY is.
// Never trust the file name or the type the browser claims.
function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  const pngStart = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(pngStart)) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

// Delete a post's image file from disk. Safe to call with null, and it
// ignores errors if the file is already gone (same idea as removeAvatarFile).
function removePostImage(imageUrl) {
  if (!imageUrl) return;
  fs.promises.unlink(path.join(postDir, path.basename(imageUrl))).catch(() => {});
}

module.exports = { detectImageType, postDir, removePostImage };