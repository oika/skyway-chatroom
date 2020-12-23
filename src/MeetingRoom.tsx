import React, { CSSProperties, useEffect, useRef, useState } from 'react';
import Peer, { RoomStream, SfuRoom } from 'skyway-js';
import './App.css';
import 'bootstrap/dist/css/bootstrap.css';
import styles from './MeetingRoom.module.css';
import { assertNotNull } from './Utils';

interface ScreenProps extends Member {
    allCount: number;
    index: number;
}

interface Member {
    id: string;
    name: string;
    stream: MediaStream | undefined;
    lastMessage?: string;
}

interface StreamData {
    name?: string;
    message?: string;
}

const Screen = (props: ScreenProps) => {

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


    const calcPosition = () => {
        if (props.allCount <= 0 || 26 <= props.allCount) return undefined;
        if (props.index < 0 || props.allCount <= props.index) return undefined;

        const clmCount = props.allCount <= 4 ? 2
                       : props.allCount <= 9 ? 3
                       : props.allCount <= 16 ? 4
                       : 5;
        const column = props.index % clmCount;
        const row = props.index / clmCount;

        return { column, row };
    }

    const pos = calcPosition();
    if (pos == null) {
        return <></>;
    }

    return (
        <div className={styles.screen} style={{ gridRow: pos.row + 1, gridColumn: pos.column + 1 }}>
            <video ref={refVideo} autoPlay muted playsInline></video>
            <div className={styles["user-name"]}>{props.name}</div>
        </div>

    );
}

interface MeetingRoomProps {
    userName: string;
    roomName: string;
    onLeave: () => void;
    myStream: MediaStream;
    peer: Peer;
}

export const MeetingRoom = (props: MeetingRoomProps) => {

    const [ room, setRoom ] = useState<SfuRoom>();
    const [ members, setMembers ] = useState<Member[]>([]);
    const [ isOpen, setIsOpen ] = useState(false);

    const refMembers = useRef(members);
    const refRoom = useRef(room);
    useEffect(() => {
        refMembers.current = members;
    },[members]);
    useEffect(() => {
        refRoom.current = room;
    }, [room]);

    useEffect(() => {
        if (room != null && isOpen) onJoin();

    }, [ room, isOpen ]);

    useEffect(() => {
        const room = props.peer.joinRoom(props.roomName, { mode: "sfu", stream: props.myStream });
        setRoom(room as SfuRoom);

        room.once("open", () => {
            console.log("open room!!");
            setIsOpen(true);
        });

        room.on("stream", (stream: RoomStream) => {
            console.log("stream!!", stream);

            onMemberJoin(stream);
        });

        room.on("data", ({ data, src }) => {
            console.log("data !!", data, src);

            recvData(src, data as StreamData);
        });

        room.on("peerLeave", id => {
            console.log("peerLeave!!", id);

            const target = refMembers.current.find(m => m.id === id);
            if (target != null) {
                target.stream?.getTracks().forEach(t => t.stop());
                setMembers(refMembers.current.filter(m => m.id !== id));
            }
        })

    }, []);

    const onJoin = () => {
        if (!assertNotNull(room, "room", "open")) return;

        sendData({ name: props.userName });

        //接続時に取りこぼされるストリームの情報をあとから拾う
        setTimeout(() => {
            const mems = [...refMembers.current];
            const remotes = room.remoteStreams;
            console.log("remote streams", remotes);
            Object.values(remotes).forEach(str => {
                const mem = mems.find(m => m.id === str.peerId);
                if (mem == null && str.peerId !== props.peer.id) {
                    mems.push({ id: str.peerId, stream: str, name: "..." });
                }
                if (mem != null && mem.stream == null) {
                    mem.stream = str;
                }
            });
            setMembers(mems);
        }, 5000);
    }
    const onMemberJoin = (stream: RoomStream) => {
        const mems = refMembers.current;
        if (mems.some(m => m.id === stream.peerId)) {
            setMembers(mems.map(m => m.id !== stream.peerId ? m : { ...m, stream: stream }));
        } else {
            setMembers([ ...mems, { id: stream.peerId, name:"...", stream }]);
        }

        //自分の名前を再送
        sendData({ name: props.userName });
    }

    const onLeave = () => {
        if (!assertNotNull(room, "room")) return;
        room.close();
        members.forEach(m => m.stream?.getTracks().forEach(t => t.stop()));

        props.onLeave();
    }

    const sendData = (data: StreamData) => {
        const room = refRoom.current;
        if (!assertNotNull(room, "room", "senddata")) return;

        room.send(data);
    }

    const recvData = (id: string, data: StreamData) => {
        const mems = refMembers.current;
        const target = mems.find(m => m.id === id);
        if (target == null) {
            if (data.name == null) return;
            setMembers([...mems, { id, name: data.name, stream: undefined, lastMessage: data.message }]);
            return;
        }

        setMembers(mems.map(m => m.id !== id ? m : { ...m, name: data.name ?? m.name, lastMessage: data.message ?? m.lastMessage }));
    }

    const screenCount = members.length + 1;

    const gridProps = (): CSSProperties => {
        //TODO 共通化
        const clmCount = screenCount <= 4 ? 2
                       : screenCount <= 9 ? 3
                       : screenCount <= 16 ? 4
                       : 5;
        const rowCount = screenCount / clmCount;
        return { gridTemplateColumns: "1fr ".repeat(clmCount), gridTemplateRows: "1fr ".repeat(rowCount) }

    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <button className="btn btn-secondary" onClick={onLeave}>退室</button>
            </div>
            <div className={styles.grid} style={gridProps()}>
                { props.peer.id != null && (
                    <Screen stream={props.myStream} name={props.userName} id={props.peer.id} allCount={screenCount} index={0} />
                )}
                { members.map((m,i) => (
                    <Screen key={m.id} {...m} allCount={screenCount} index={i+1} />
                ))}
            </div>
        </div>

    )
};
