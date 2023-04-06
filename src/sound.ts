import { spawn } from "child_process";
import fetch from "node-fetch";
import { load as cheerioLoad } from "cheerio";
import fs from "fs";

const savePath = `${process.env.HOME}/Documents/raycast-my-instant`;

export type Sound = {
  name: string;
  url: string;
  filename: string;
  isPlaying: boolean;
  isDownloading: boolean;
};

// Fetch sounds from myinstants.com and return JSON a list of sounds
export async function fetchSounds(title: string) {
  const response = await fetch(`https://www.myinstants.com/fr/search/?name=${encodeURIComponent(title)}`);
  const htmlText = await response.text();
  const $ = cheerioLoad(htmlText);
  const buttons = $('button.small-button');

  const sounds: Sound[] = [];

  buttons.each((_, button) => {
    const name = $(button).attr('title')?.replace('Jouer le son de ', '');
    const onclick = $(button).attr('onclick');
    const urlMatch = onclick?.match(/play\('(.+?)',/);

    if (name && urlMatch && urlMatch[1]) {
      sounds.push({
        name,
        url: `https://www.myinstants.com${urlMatch[1]}`,
        filename: urlMatch[1].split('/').reverse()[0],
        isPlaying: false,
        isDownloading: false,
      });
    }
  });

  return sounds;
}

// Download and play a sound from a URL using curl and afplay
export async function playSound(sound: Sound) {
  if (sound.filename) {
    if (sound.filename === 'search') {
      return;
    } else {
      // Download the sound
      await new Promise<void>((resolve, reject) => {
        // download only if the file doesn't exist
        if (fs.existsSync(`${savePath}/${sound.filename}`)) {
          resolve();
          return;
        }

        // create the directory if it doesn't exist
        if (!fs.existsSync(savePath)) {
          fs.mkdirSync(savePath);
        }

        const download = spawn('curl', ['--silent', '-o', `${savePath}/${sound.filename}`, sound.url]);
        download.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Failed to download sound: ${code}`));
          }
        });
      });

      // Play the sound
      const play = spawn('afplay', [`${savePath}/${sound.filename}`]);

      return {
        pid: play.pid,
        onFinished: () =>
          new Promise<void>((resolve) => {
            play.on('close', () => {
              resolve();
            });
          }),
      };
    }
  }
}
