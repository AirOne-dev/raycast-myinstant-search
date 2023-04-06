import { spawn } from "child_process";
import { Action, ActionPanel, List } from "@raycast/api";
import { useState } from "react";
import fetch from "node-fetch";
import { load as cheerioLoad } from "cheerio";
import fs from "fs";

export default function Command() {
  type Sound = {
    name: string;
    url: string;
    filename: string;
    isPlaying: boolean;
    isDownloading: boolean;
  };

  const emptySoundList = [{ name: '🔍 Press [Enter] to search', url: 'search', filename: '', isPlaying: false, isDownloading: false }] as [Sound];
  const [soundList, setSoundList] = useState([...emptySoundList]);

  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [afplayPID, setAfplayPID] = useState<null | number>(null);
  
  // Fetch sounds from myinstants.com and return JSON a list of sounds
  async function fetchSounds(title: string) {
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
  async function playSoundAction(sound: Sound) {
    if (sound.url) {
      if (sound.url === 'search') {
        if (searchText.length > 0) {
          setIsLoading(true);
          fetchSounds(searchText).then((sounds) => {
            setSoundList(sounds);
          }).finally(() => {
            setIsLoading(false);
          });
        }
      } else {
        // Set all sounds to not playing
        setSoundList(soundList.map(snd => ({ ...snd, isPlaying: false })));
  
        // If there's a sound playing, stop it
        if (afplayPID) {
          process.kill(afplayPID);
        }

        // If the sound is already playing, stop it
        if(afplayPID && soundList.find(snd => snd.isPlaying && snd.url === sound.url)) {
          setIsLoading(false);
          return;
        }
  
        try {
          // Download the sound
          await new Promise<void>((resolve, reject) => {
            // download only if the file doesn't exist
            if (fs.existsSync(`/tmp/${sound.filename}`)) {
              resolve();
              return;
            }
            setIsLoading(true);
            const download = spawn('curl', ['--silent', '-o', `/tmp/${sound.filename}`, sound.url]);
            setSoundList(soundList.map(snd => ({ ...snd, isDownloading: sound.url === snd.url })));
            download.on('close', (code) => {
              if (code === 0) {
                resolve();
              } else {
                reject(new Error(`Failed to download sound: ${code}`));
              }
            });
          }).finally(() => {
            setIsLoading(false);
          });
  
          // Play the sound
          setSoundList(soundList.map(snd => ({ ...snd, isPlaying: sound.url === snd.url, isDownloading: false })));
  
          const play = spawn('afplay', [`/tmp/${sound.filename}`]);
          setAfplayPID(play.pid ? play.pid : null);
  
          await new Promise<void>((resolve) => {
            play.on('close', () => {
              setAfplayPID(null);
              resolve();
            });
          });
        } catch (err) {
          console.error(err);
        } finally {
          // reset all sounds to not playing
          setSoundList(soundList.map(snd => ({ ...snd, isPlaying: false })));
        }
      }
    }
  }
  
  function searchAction(text: string) {
    setSearchText(text);
    setSoundList([...emptySoundList]);
  }

  return (
    <List
      onSearchTextChange={searchAction}
      searchBarPlaceholder="Search for sounds..."
      isLoading={isLoading}
    >
      {soundList.map((sound, index) => (
        <List.Item
          key={sound.url ?? index}
          title={
            (sound.isDownloading ? '⏳ ' : '') +
            (sound.isPlaying ? '🔊 ' : '') +
            (!sound.isPlaying && !sound.isDownloading && sound.url !== 'search' ? '▶️ ' : '') +
            sound.name
          }
          actions={
            <ActionPanel>
              <Action title="Select" onAction={() => playSoundAction(sound)} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
