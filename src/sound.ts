import { spawn } from "child_process";
import fetch from "node-fetch";
import { load as cheerioLoad } from "cheerio";
import fs from "fs";
import * as mm from "music-metadata";

export const savePath = `${process.env.HOME}/Documents/raycast-my-instant`;

export type Sound = {
    name: string;
    url: string;
    filename: string;
    isPlaying: boolean;
    isDownloading: boolean;
    metadata?: AudioMetadata;
    subtitle?: string;
};

// Fetch sounds from myinstants.com and return a list of sounds in JSON format
export async function fetchSounds(title: string) {
    const response = await fetch(`https://www.myinstants.com/fr/search/?name=${encodeURIComponent(title)}`);
    const htmlText = await response.text();
    const $ = cheerioLoad(htmlText);
    const buttons = $('button.small-button');

    const sounds: Sound[] = [];

    // Extract information about the sounds from the buttons
    buttons.each((_, button) => {
        const name = $(button).attr('title')?.replace('Jouer le son de ', '');
        const onclick = $(button).attr('onclick');
        const urlMatch = onclick?.match(/play\('(.+?)',/);

        // Add the sound to the list of sounds if it has been found
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
                // Download only if the file doesn't already exist
                if (fs.existsSync(`${savePath}/${sound.filename}`)) {
                    resolve();
                    return;
                }

                // Create the directory if it doesn't exist
                if (!fs.existsSync(savePath)) {
                    fs.mkdirSync(savePath);
                }

                // Download the sound using curl
                const download = spawn('curl', ['--silent', '-o', `${savePath}/${sound.filename}`, sound.url]);
                download.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Failed to download sound: ${code}`));
                    }
                });
            });

            // Play the sound using afplay
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

export type AudioMetadata = {
    title?: string;
    artist?: string;
    album?: string;
    picture?: Buffer;
}

export async function readAudioMetadata(source: string): Promise<AudioMetadata> {
    try {
        let metadata;

        if (source.startsWith("http://") || source.startsWith("https://")) {
            const response = await fetch(source);
            const buffer = await response.buffer();
            metadata = await mm.parseBuffer(buffer, response.headers.get("content-type"));
        } else {
            metadata = await mm.parseFile(source);
        }

        const { title, artist, album } = metadata.common;

        const picture = metadata.common.picture?.[0]?.data;

        return { title, artist, album, picture };
    } catch (error) {
        console.error("Error reading audio metadata:", error);
        return {};
    }
}
