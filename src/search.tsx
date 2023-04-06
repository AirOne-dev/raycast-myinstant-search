import { useState } from "react";
import { Action, ActionPanel, List } from "@raycast/api";
import { fetchSounds, playSound, Sound } from "./sound";

const emptySoundList = [{ name: '🔍 Press [Enter] to search', url: '', filename: 'search', isPlaying: false, isDownloading: false }] as [Sound];

export default function Command() {
  const [soundList, setSoundList] = useState([...emptySoundList]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [afplayState, setAfplayState] = useState<{name: null | string, pid: number | null}>({ name: null, pid: null });

  function updateSoundList(newSound: Sound) {
    setSoundList((prevSoundList) =>
      prevSoundList.map((sound) =>
        sound.filename === newSound.filename ? newSound : sound
      )
    );
  }

  async function playSoundAction(sound: Sound) {
    if (afplayState.pid) {
      console.log(`Killing ${afplayState.pid}`);
      process.kill(afplayState.pid);
      const stoppedSound = soundList.find(
        (snd) => snd.filename === afplayState.name
      );
      if (stoppedSound) {
        updateSoundList({ ...stoppedSound, isPlaying: false });
      }
    }

    if (afplayState.name === sound.filename) {
      setAfplayState({ name: null, pid: null });
      return;
    }

    if (sound.filename === "search") {
      if (searchText.length > 0) {
        setIsLoading(true);
        fetchSounds(searchText).then((sounds) => {
          setSoundList(sounds);
        }).finally(() => {
          setIsLoading(false);
        });
      }
    } else {
      setIsLoading(true);
      const { pid, onFinished } = await playSound(sound) ?? { pid: null, onFinished: () => {} };
      setIsLoading(false);

      if (pid) {
        setAfplayState({ name: sound.filename, pid });
        updateSoundList({ ...sound, isPlaying: true });

        onFinished().then(() => {
          updateSoundList({ ...sound, isPlaying: false });
          setAfplayState({ name: null, pid: null });
        });
        if (afplayState.name === sound.filename) {
          updateSoundList({ ...sound, isPlaying: false });
          setAfplayState({ name: null, pid: null });
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
            (!sound.isPlaying && !sound.isDownloading && sound.filename !== 'search' ? '▶️ ' : '') +
            sound.name + (sound.isDownloading ? ' (downloading)' : '')
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
