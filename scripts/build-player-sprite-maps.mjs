import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.join(
  root,
  "public/assets/images/soccer_player_for_arcade_style",
);
const directions = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];
const frameWidth = 40;
const frameHeight = 64;
const phases = 8;

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePng(file) {
  const png = fs.readFileSync(file);
  const chunks = [];
  let width;
  let height;
  let colorType;
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
      if (data[8] !== 8 || data[10] !== 0 || data[11] !== 0 || data[12] !== 0)
        throw new Error(`Unsupported PNG format: ${file}`);
    } else if (type === "IDAT") {
      chunks.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += length + 12;
  }
  if (colorType !== 6) throw new Error(`Expected RGBA PNG: ${file}`);
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  let inputOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[inputOffset++];
    for (let x = 0; x < stride; x++) {
      const source = raw[inputOffset++];
      const index = y * stride + x;
      const left = x >= bytesPerPixel ? pixels[index - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[index - stride] : 0;
      const upperLeft =
        y > 0 && x >= bytesPerPixel
          ? pixels[index - stride - bytesPerPixel]
          : 0;
      if (filter === 0) pixels[index] = source;
      else if (filter === 1) pixels[index] = (source + left) & 255;
      else if (filter === 2) pixels[index] = (source + up) & 255;
      else if (filter === 3)
        pixels[index] = (source + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4)
        pixels[index] = (source + paeth(left, up, upperLeft)) & 255;
      else throw new Error(`Unsupported PNG filter ${filter}: ${file}`);
    }
  }
  return { width, height, pixels };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const chunk = Buffer.concat([name, data]);
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  chunk.copy(result, 4);
  result.writeUInt32BE(crc32(chunk), data.length + 8);
  return result;
}

function encodePng(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const target = y * (stride + 1);
    raw[target] = 0;
    pixels.copy(raw, target + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    signature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function copyFrame(sheet, sheetWidth, image, column, row, away) {
  // The source pack uses a 120px square canvas. This fixed crop retains its
  // registration across every frame and places the player's feet at y=60,
  // matching the game's existing world-space anchor.
  const sourceX = 40;
  const sourceY = 28;
  for (let y = 0; y < frameHeight; y++) {
    for (let x = 0; x < frameWidth; x++) {
      const sourceIndex = ((sourceY + y) * image.width + sourceX + x) * 4;
      const targetIndex =
        ((row * frameHeight + y) * sheetWidth + column * frameWidth + x) * 4;
      let red = image.pixels[sourceIndex];
      let green = image.pixels[sourceIndex + 1];
      let blue = image.pixels[sourceIndex + 2];
      const alpha = image.pixels[sourceIndex + 3];
      // Recolor saturated red uniform pixels for the away kit while leaving
      // skin, hair, white shorts, outlines, and shading intact.
      if (
        away &&
        red > 70 &&
        red > green * 1.8 &&
        red > blue * 1.35 &&
        blue > green * 0.65
      ) {
        [red, green, blue] = [blue * 0.65, green * 1.05, red * 0.95];
      }
      sheet[targetIndex] = Math.round(red);
      sheet[targetIndex + 1] = Math.round(green);
      sheet[targetIndex + 2] = Math.round(blue);
      sheet[targetIndex + 3] = alpha;
    }
  }
}

function buildSpriteMap(away) {
  const width = frameWidth * phases;
  const height = frameHeight * directions.length * 2;
  const sheet = Buffer.alloc(width * height * 4);
  directions.forEach((direction, directionIndex) => {
    const idle = decodePng(
      path.join(sourceRoot, "rotations", `${direction}.png`),
    );
    for (let phase = 0; phase < phases; phase++)
      copyFrame(sheet, width, idle, phase, directionIndex, away);

    for (let phase = 0; phase < phases; phase++) {
      const running = decodePng(
        path.join(
          sourceRoot,
          "animations/Running",
          direction,
          `frame_${String(phase).padStart(3, "0")}.png`,
        ),
      );
      copyFrame(
        sheet,
        width,
        running,
        phase,
        directions.length + directionIndex,
        away,
      );
    }
  });
  const team = away ? "away" : "home";
  const output = path.join(sourceRoot, `sprite-map-${team}.png`);
  fs.writeFileSync(output, encodePng(width, height, sheet));
  console.log(`Built ${path.relative(root, output)} (${width}x${height})`);
}

buildSpriteMap(false);
buildSpriteMap(true);
