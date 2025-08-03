"use client";
import React, { useEffect } from 'react';
import { io, Socket } from "socket.io-client";
import Image from 'next/image';
import { Credential, SystemInfo, User } from '@/lib/models';
import { useRouter } from 'next/navigation';
import SignInForm from '@/components/auth/SignInForm';
import Loading from '@/components/common/Loading';

export const SocketContext = React.createContext<SocketContextProps>({ setCreds: () => {} });

interface SocketContextProps {
    user?: User;
    socket?: Socket;
    systemInfo?: SystemInfo;
    setCreds : React.Dispatch<React.SetStateAction<Credential | undefined>>;
}   

export const useSocketContext = () => React.useContext(SocketContext);

export const SocketContextProvider = ({ children }: { children: React.ReactNode} ) => {

    const [socket, setSocket] = React.useState<Socket>();
    const [user, setUser] = React.useState<User>();
    const [systemInfo, setSystemInfo] = React.useState<SystemInfo>();
    const [loading, setLoading] = React.useState<'connecting' | 'reconnecting' | 'connected' | 'disconnected'>();
    const [creds, setCreds] = React.useState<Credential>();
    const router = useRouter();

    React.useEffect(() => {
                if(socket) return;
                if(!creds || !creds.username) {
                    return;
                }
                try {
                    setLoading('connecting');
                    const socketio = io(creds.host, {
                        reconnectionDelayMax: 10000,
                        auth: {
                            username: creds.username,
                            password: creds.password
                        },
                        timeout: 10000 // Add timeout to detect connection issues faster
                    });
                    socketio.connect();

                    setSocket(socketio);
                } catch (error) {
                    console.error('Socket initialization error:', error);
                    setLoading('disconnected');
                    alert('Failed to connect to server. Please check the host address.');
                    setCreds(undefined);
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
                } else {
                    console.error('Handshake failed:', response);
                    alert('Failed to authenticate. Please check your credentials.');
                    // setCreds(undefined);
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

        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            if (error.message.includes('auth')) {
                setLoading(undefined);
                alert('Authentication failed. Please check your credentials.');
            } else {
                setLoading(undefined);
                alert(`Cannot connect to server: ${error.message}`);
                socket.disconnect();
            }
            setCreds(undefined);
        });

        return () => {
            socket.off("connect");
            socket.off("reconnect");
            socket.off("disconnect");
        }
    }, [socket])

    return (
        <SocketContext.Provider value={{ user, socket, setCreds, systemInfo } }>
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