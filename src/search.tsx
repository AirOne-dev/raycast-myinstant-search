import { useEffect, useState } from "react";
import { Action, ActionPanel, List } from "@raycast/api";
import { fetchSounds, playSound, Sound, savePath, readAudioMetadata } from "./sound";
import fs, { PathLike } from "fs";

// Empty list for displaying a search prompt
const emptySoundList = [{ name: '🔍 Press [Enter] to search online', url: '', filename: 'search', isPlaying: false, isDownloading: false }] as [Sound];

export default function Command() {
  const [soundList, setSoundList] = useState([...emptySoundList]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [afplayState, setAfplayState] = useState<{name: null | string, pid: number | null}>({ name: null, pid: null });

  // Load downloaded sounds from the save directory
  function loadDownloadedSounds() {
    if (!fs.existsSync(savePath)) return;

    const files = fs.readdirSync(savePath);
    setSoundList((prevSoundList) => [...prevSoundList, { name: '', subtitle: 'Downloaded Sounds :', url: '', filename: 'search', isPlaying: false, isDownloading: false}]);
    files.forEach(async (file) => {
      const sound: Sound = {
        name: file.replace(".mp3", ""),
        url: "",
        filename: file,
        isPlaying: false,
        isDownloading: false,
        metadata: await readAudioMetadata(file),
      };
      setSoundList((prevSoundList) => [...prevSoundList, sound]);
    });
  }

  // Update a specific sound in the sound list
  function updateSoundList(newSound: Sound) {
    setSoundList((prevSoundList) =>
      prevSoundList.map((sound) =>
        sound.filename === newSound.filename ? newSound : sound
      )
    );
  }

  // Action to play or stop a sound
  async function playSoundAction(sound: Sound) {
    // Stop the currently playing sound if there is one
    if (afplayState.pid) {
      process.kill(afplayState.pid);
      const stoppedSound = soundList.find(
        (snd) => snd.filename === afplayState.name
      );
      if (stoppedSound) {
        updateSoundList({ ...stoppedSound, isPlaying: false });
      }
    }

    // If clicking on the same sound again, do not replay it
    if (afplayState.name === sound.filename) {
      setAfplayState({ name: null, pid: null });
      return;
    }

    // Perform the search if the sound is the search one
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
      // Otherwise, download and play the selected sound
      setIsLoading(true);
      updateSoundList({ ...sound, isDownloading: true });
      const { pid, onFinished } = await playSound(sound) ?? { pid: null, onFinished: () => null };
      updateSoundList({ ...sound, isDownloading: false });
      setIsLoading(false);

      if (pid) {
        setAfplayState({ name: sound.filename, pid });
        updateSoundList({ ...sound, isPlaying: true });

        // Update the playing state once the sound is finished
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

  // Action for searching
  function searchAction(text: string) {
    setSearchText(text);
    setSoundList([...emptySoundList]);
  }

  // Action for deleting a sound
  function deleteSoundAction(path: PathLike | PathLike[]) {
    const filename = path.toString().split("/").pop();
    setSoundList((prevSoundList) => prevSoundList.filter((snd) => snd.filename !== filename));
  }

  // Load downloaded sounds on component mount
  useEffect(() => {
    loadDownloadedSounds();
  }, []);

  return (
    <List
      onSearchTextChange={searchAction}
      searchBarPlaceholder="Search for sounds..."
      isLoading={isLoading}
    >
      {soundList.map((sound, index) => (
        <List.Item
          key={sound.filename + index}
          title={
            (sound.metadata?.picture 
              ? '' 
              : (sound.isDownloading ? '⏳ ' : '') +
                (sound.isPlaying ? '🔊 ' : '') +
                (!sound.isPlaying && !sound.isDownloading && sound.filename !== 'search' ? '▶️ ' : '')
            ) +
            (sound.metadata?.title ? sound.metadata?.title : sound.name)
          }
          subtitle={sound.subtitle ? sound.subtitle : (sound.isDownloading ? ' (downloading)' : '')}
          icon={sound.metadata?.picture ? `data:image/png;base64, ${sound.metadata.picture}` : undefined}
          actions={
            <ActionPanel>
              <Action title="Select" onAction={() => playSoundAction(sound)} />
              <Action.Trash paths={`${savePath}/${sound.filename}`} onTrash={deleteSoundAction} shortcut={{ modifiers: ["cmd"], key: "delete" }} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
