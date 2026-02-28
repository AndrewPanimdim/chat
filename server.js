const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// ─── THE WAITING QUEUE ───
// null = nobody waiting
// has a value = one person sitting, waiting for a match
let waitingUser = null;

io.on('connection', (socket) => {

    socket.data.name   = '';
    socket.data.roomId = null;

    // ─── FIND A STRANGER ───
    socket.on('find_stranger', (name) => {
        socket.data.name   = name;
        socket.data.roomId = null;

        // SITUATION 1: nobody is waiting
        if (waitingUser === null) {
            waitingUser = socket;
            socket.emit('waiting');
        }

        // SITUATION 2: someone is already waiting
        else {
            const roomId = randomUUID();

            waitingUser.join(roomId);
            socket.join(roomId);

            waitingUser.data.roomId = roomId;
            socket.data.roomId      = roomId;

            waitingUser.emit('matched', { roomId, partnerName: socket.data.name });
            socket.emit('matched',      { roomId, partnerName: waitingUser.data.name });

            waitingUser = null;
        }
    });

    // ─── MESSAGE ───
    socket.on('message', ({ roomId, text }) => {
        socket.to(roomId).emit('message', {
            text: text,
            from: socket.data.name
        });
    });

    // ─── NEXT STRANGER ───
    socket.on('next_stranger', () => {
        const roomId = socket.data.roomId;

        if (roomId) {
            socket.to(roomId).emit('partner_left');
            socket.leave(roomId);
            socket.data.roomId = null;

            // put them back in the queue
            if (waitingUser === null) {
                waitingUser = socket;
                socket.emit('waiting');
            } else {
                const newRoomId = randomUUID();

                waitingUser.join(newRoomId);
                socket.join(newRoomId);

                waitingUser.data.roomId = newRoomId;
                socket.data.roomId      = newRoomId;

                waitingUser.emit('matched', { roomId: newRoomId, partnerName: socket.data.name });
                socket.emit('matched',      { roomId: newRoomId, partnerName: waitingUser.data.name });

                waitingUser = null;
            }
        }
    });

    // ─── DISCONNECT ───
    socket.on('disconnect', () => {

        // if the disconnected user was waiting, clear the queue
        if (waitingUser === socket) {
            waitingUser = null;
        }

        // if they were in a room, notify their partner
        const roomId = socket.data.roomId;
        if (roomId) {
            socket.to(roomId).emit('partner_left');
        }
    });

});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});