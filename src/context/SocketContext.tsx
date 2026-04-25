"use client";
import React, { useEffect } from 'react';
import { io, Socket } from "socket.io-client";
import Image from 'next/image';
import { Credential, SystemInfo, User } from '@/lib/models';
import { useRouter } from 'next/navigation';
import SignInForm from '@/components/auth/SignInForm';
import Loading from '@/components/common/Loading';

export const SocketContext = React.createContext<SocketContextProps>({ setCreds: () => {}, error: null, setError: () => {} });

interface SocketContextProps {
    user?: User;
    socket?: Socket;
    systemInfo?: SystemInfo;
    setCreds : React.Dispatch<React.SetStateAction<Credential | undefined>>;
    error: string | null;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
}   

export const useSocketContext = () => React.useContext(SocketContext);

export const SocketContextProvider = ({ children }: { children: React.ReactNode} ) => {

    const [socket, setSocket] = React.useState<Socket>();
    const [user, setUser] = React.useState<User>();
    const [systemInfo, setSystemInfo] = React.useState<SystemInfo>();
    const [loading, setLoading] = React.useState<'connecting' | 'reconnecting' | 'connected' | 'disconnected'>();
    const [creds, setCreds] = React.useState<Credential>();
    const [error, setError] = React.useState<string | null>(null);
    const router = useRouter();

    React.useEffect(() => {
                if(socket) return;
                if(!creds || !creds.username) {
                    return;
                }
                try {
                    setLoading('connecting');
                    setError(null);
                    const socketio = io(creds.host, {
                        reconnectionDelayMax: 10000,
                        auth: {
                            username: creds.username,
                            password: creds.password
                        },
                        timeout: 10000, // Add timeout to detect connection issues faster
                        transports: ["websocket"]
                    });
                    socketio.connect();

                    setSocket(socketio);
                } catch (err) {
                    console.error('Socket initialization error:', err);
                    setLoading('disconnected');
                    setError('Failed to connect to server. Please check the host address.');
                    setCreds(undefined);
                    setSocket(undefined);
                }
                
    }, [creds]);


    useEffect(()=> {
        if(!socket) return;

        socket.on("connect", () => {
            setLoading("connected");
            console.log("Connected to server!");

            socket.emitWithAck('handshake', {}).then((response: { success: boolean, user?: User, systemInfo?: SystemInfo }) => {
                console.log('Handshake response:', response);
                if (response.success) {
                    setUser(response.user);
                    setSystemInfo(response.systemInfo);
                    setError(null);
                } else {
                    console.error('Handshake failed:', response);
                    setError('Failed to authenticate. Please check your credentials.');
                    socket.disconnect();
                    setSocket(undefined);
                    setCreds(undefined);
                }
            }

            )
        });

        socket.on("reconnect", () => {
            setLoading("reconnecting");
            console.log("Reconnecting to server!");
        });

        socket.on("disconnect", () => {
            setLoading("disconnected");
            console.log("Disconnected from server!");
        });

        socket.on('connect_error', (err) => {
            console.error('Connection error:', err);
            if (err.message.includes('auth')) {
                setLoading(undefined);
                setError('Authentication failed. Please check your credentials.');
            } else {
                setLoading(undefined);
                setError(`Cannot connect to server: ${err.message}`);
            }
            socket.disconnect();
            setSocket(undefined);
            setCreds(undefined);
        });

        return () => {
            socket.off("connect");
            socket.off("reconnect");
            socket.off("disconnect");
        }
    }, [socket])

    return (
        <SocketContext.Provider value={{ user, socket, setCreds, systemInfo, error, setError } }>
            <div className="h-[100dvh] w-screen m-0 p-0">
                <Loading 
                    message={loading === "reconnecting" ? "Reconnecting..." : "Connecting to server..."} 
                    show={loading === "reconnecting" || (creds != undefined && loading != "connected")} 
                    className='absolute'
                />
                {(creds == undefined || loading != "connected") ? <SignInForm /> : children}
            </div>
        </SocketContext.Provider>
    );
};

export type {User}