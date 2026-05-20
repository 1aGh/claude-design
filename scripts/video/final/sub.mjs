/**
 * Build-time captioning. Walks public/ for video files, transcribes via
 * Whisper.cpp, writes Caption[] JSON next to each input.
 *
 * Adapted from remotion-dev/template-tiktok/sub.mjs. Stripped:
 *   - 'webcam' -> 'subs' filename rewrite (template-specific).
 *   - Multi-language auto-detect (we pass lang explicitly via whisper-config).
 *
 * Run: `pnpm run caption` (processes everything in public/)
 *      `pnpm run caption public/scene-02.mp4` (single file)
 *      `WHISPER_LANG=cs pnpm run caption` (Czech model — needs large-v3)
 *
 * Caption JSON is editable. Whisper mistranscribes our jargon
 * (Claude as "cloud", MCP as "MCBP" etc); patch the JSON by hand and re-render.
 */

import { execSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  downloadWhisperModel,
  installWhisperCpp,
  toCaptions,
  transcribe,
} from '@remotion/install-whisper-cpp';
import { WHISPER_LANG, WHISPER_MODEL, WHISPER_PATH, WHISPER_VERSION } from './whisper-config.mjs';

const VIDEO_EXTS = ['.mp4', '.webm', '.mkv', '.mov'];

const extractAudio = (videoPath, wavPath) => {
  execSync(`npx remotion ffmpeg -i "${videoPath}" -ar 16000 "${wavPath}" -y`, {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
};

const transcribeOne = async (wavPath, jsonOutPath) => {
  const whisperCppOutput = await transcribe({
    inputPath: wavPath,
    model: WHISPER_MODEL,
    tokenLevelTimestamps: true,
    whisperPath: WHISPER_PATH,
    whisperCppVersion: WHISPER_VERSION,
    printOutput: false,
    translateToEnglish: false,
    language: WHISPER_LANG,
    splitOnWord: true,
  });

  const { captions } = toCaptions({ whisperCppOutput });
  writeFileSync(jsonOutPath, JSON.stringify(captions, null, 2));
  console.log(`  -> ${jsonOutPath}`);
};

const processVideo = async (videoPath) => {
  const ext = path.extname(videoPath);
  if (!VIDEO_EXTS.includes(ext)) return;

  const jsonPath = videoPath.replace(new RegExp(`${ext}$`), '.json');
  if (existsSync(jsonPath)) {
    console.log(`skip ${path.basename(videoPath)} (already transcribed)`);
    return;
  }

  console.log(`transcribe ${path.basename(videoPath)}`);
  const tempDir = path.join(process.cwd(), 'temp');
  const createdTemp = !existsSync(tempDir);
  if (createdTemp) mkdirSync(tempDir);

  const wavName = `${path.basename(videoPath, ext)}.wav`;
  const wavPath = path.join(tempDir, wavName);

  try {
    extractAudio(videoPath, wavPath);
    await transcribeOne(wavPath, jsonPath);
  } finally {
    if (createdTemp) rmSync(tempDir, { recursive: true, force: true });
  }
};

const processDirectory = async (dir) => {
  const entries = readdirSync(dir).filter((e) => e !== '.DS_Store');
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (lstatSync(full).isDirectory()) {
      await processDirectory(full);
    } else {
      await processVideo(full);
    }
  }
};

console.log(`Whisper.cpp ${WHISPER_VERSION} / model ${WHISPER_MODEL} / lang ${WHISPER_LANG}`);
await installWhisperCpp({ to: WHISPER_PATH, version: WHISPER_VERSION });
await downloadWhisperModel({ folder: WHISPER_PATH, model: WHISPER_MODEL });

const args = process.argv.slice(2);
if (args.length === 0) {
  await processDirectory(path.join(process.cwd(), 'public'));
} else {
  for (const arg of args) {
    const full = path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
    const stat = lstatSync(full);
    if (stat.isDirectory()) {
      await processDirectory(full);
    } else {
      await processVideo(full);
    }
  }
}
