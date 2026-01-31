import { mkdir } from "node:fs/promises";
import { join } from "node:path";

/** bun download script for specific arch */
 async function bundown(arch, subfolder) {
   const url = `https://github.com/oven-sh/bun/releases/latest/download/bun-linux-${arch}.zip`;
   const baseDir = join("ubuntu-bin", subfolder);
   const binaryPath = join(baseDir, "bun");
   const gzipPath = join(baseDir, "bun.gz");

   console.log(`[${subfolder}] Downloading zip...`);
   await mkdir(baseDir, { recursive: true });

   const response = await fetch(url);
   const zipBuffer = await response.arrayBuffer();

   console.log(`[${subfolder}] Parsing and inflating binary...`);
   const bunBinary = extractFromZip(zipBuffer, "/bun");

   await Bun.write(binaryPath, bunBinary);
   // Ensure executable permissions (native Bun.file method)
   const { chmod } = await import("node:fs/promises");
   await chmod(binaryPath, 0o755);
   console.log(`[${subfolder}] Done! Saved to ${binaryPath}`);

   const gzipped = Bun.gzipSync(bunBinary);
   await Bun.write(gzipPath, gzipped);

   console.log(`[${subfolder}] Done! Saved to ${gzipPath}`);
 }

 /**
  * Google generated workaround for reliable sizes.
  *
  * Possible source, and article with more details.
  * https://dev.to/pavel-zeman/the-pitfalls-of-streamed-zip-decompression-an-in-depth-analysis-3l99
  */
  function extractFromZip(buffer, targetName) {
    const view = new DataView(buffer);

    // 1. Locate EOCD (End of Central Directory)
    let eocd = buffer.byteLength - 22;
    while (eocd > 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;

    // 2. Parse Central Directory
    const cdCount = view.getUint16(eocd + 10, true);
    const cdOffset = view.getUint32(eocd + 16, true);

    let current = cdOffset;
    for (let i = 0; i < cdCount; i++) {
      const compSize = view.getUint32(current + 20, true);
      const nameLen = view.getUint16(current + 28, true);
      const extraLen = view.getUint16(current + 30, true);
      const commLen = view.getUint16(current + 32, true);
      const localOffset = view.getUint32(current + 42, true);

      const fileName = new TextDecoder().decode(new Uint8Array(buffer, current + 46, nameLen));

      if (fileName.endsWith(targetName)) {
        // Skip Local Header to find start of data
        const localNameLen = view.getUint16(localOffset + 26, true);
        const localExtraLen = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + localNameLen + localExtraLen;

        const compressedData = new Uint8Array(buffer, dataStart, compSize);

        // Pure Bun Native Decompression (Non-streamed, fastest)
        // windowBits: -15 signals 'Raw Deflate' (required for ZIP)
        return Bun.inflateSync(compressedData, { windowBits: -15 });
      }
      current += 46 + nameLen + extraLen + commLen;
    }
    throw new Error(`File ${targetName} not found`);
  }

// Map architectures to GitHub naming conventions
try {
  await Promise.all([
    bundown("x64", "x86_64"),
    bundown("aarch64", "arm64")
  ]);
} catch (err) {
  console.error("Execution failed:", err);
}
