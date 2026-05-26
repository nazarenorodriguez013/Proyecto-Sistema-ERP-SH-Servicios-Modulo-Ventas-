import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../config';

const socket = io(API_BASE || window.location.origin);

export const useSocket = (event: string, handler: (data: unknown) => void) => {
  useEffect(() => {
    socket.on(event, handler);
    return () => { socket.off(event, handler); };
  }, [event, handler]);
};
