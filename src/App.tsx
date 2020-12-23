import React, { useEffect, useRef, useState } from 'react';
import Peer from 'skyway-js';
import './App.css';
import 'bootstrap/dist/css/bootstrap.css';
import { MeetingRoom } from './MeetingRoom';

interface EntryProps {
  onSubmit:(userName: string, roomName: string) => void;
  defaultUserName?: string;
  defaultRoomName?: string;
  stream: MediaStream;
}

const Entry = (props:EntryProps) => {
  const [ userName, setUserName ] = useState("");
  const [ roomName, setRoomName ] = useState("");

  const refVideo = useRef<HTMLVideoElement|null>(null);

  useEffect(() => {
    if (refVideo.current != null) 
    {
        refVideo.current.srcObject = props.stream ?? null;
        if (props.stream != null) {
            refVideo.current.play();
        }
    }
  }, [ props.stream, refVideo ]);

  useEffect(() => {
    setUserName(props.defaultUserName ?? "");
    setRoomName(props.defaultRoomName ?? "");

  }, [ props.defaultUserName, props.defaultRoomName ]);

  return (
    <div className="entry-container">
      <div>
        <video ref={refVideo} width="400px" autoPlay muted playsInline></video>
      </div>
      <div className="input-row">
        <label>あなたの名前</label>
        <input type="text" className="form-control"
          value={userName} onChange={e => setUserName(e.target.value) } />
      </div>
      <div className="input-row">
        <label>部屋の名前</label>
        <input type="text" className="form-control"
          value={roomName} onChange={e => setRoomName(e.target.value)} />
      </div>
      <button className="btn btn-success btn-entry"
        disabled={userName === "" || roomName === ""}
        onClick={() => props.onSubmit(userName, roomName)}>入室</button>
    </div>
  )

}

const App = () => {
  const [ roomName, setRoomName ] = useState<string>();
  const [ userName, setUserName ] = useState<string>();
  const [ lastUserName, setLastUserName ] = useState<string>();
  const [ lastRoomName, setLastRoomName ] = useState<string>();
  const [ peer, setPeer ] = useState<Peer>();
  const [ stream, setStream ] = useState<MediaStream>();

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const str = await navigator.mediaDevices.getUserMedia({ video: { width: { max: 280 }, height: { max: 240 }, frameRate: { max: 12 } }, audio: true })
      .catch(er => {
        console.error("failed to load stream", er);
        return undefined;
      });
    setStream(str);

    const key = process.env.REACT_APP_SKYWAY_KEY;
    if (key == null) {
      console.error("REACT_APP_SKYWAY_KEY not defined");
      return;
    }

    const p = new Peer({
      key: key,
      debug: 2
    });
    setPeer(p);
  }

  return (
    <div>
      { stream == null && (
        <div>メディアストリーム取得中</div>
      )}
      {
        roomName == null && stream != null && (
          <Entry defaultRoomName={lastRoomName} defaultUserName={lastUserName}
            stream={stream}
            onSubmit={(u,r) => { setUserName(u); setRoomName(r); setLastUserName(u); setLastRoomName(r); }} />
        )
      }
      {
        roomName != null && userName != null && stream != null && peer != null && (
          <MeetingRoom userName={userName} roomName={roomName}
            myStream={stream} peer={peer}
            onLeave={() => { setUserName(undefined); setRoomName(undefined); }}/>
        )
      }
    </div>
  );
}

export default App;
