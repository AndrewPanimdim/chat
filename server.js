const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.use(express.static('public'));

let waitingUser = null;

io.on('connection', (socket) => {

    socket.data.name   = '';
    socket.data.roomId = null;

    socket.on('find_stranger', (name) => {
        socket.data.name   = name;
        socket.data.roomId = null;

        if (waitingUser === null) {
            waitingUser = socket;
            socket.emit('waiting');
        } else {
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

    socket.on('message', ({ roomId, text }) => {
        socket.to(roomId).emit('message', {
            text: text,
            from: socket.data.name
        });
    });

    socket.on('next_stranger', () => {
        const roomId = socket.data.roomId;

        if (roomId) {
            socket.to(roomId).emit('partner_left');
            socket.leave(roomId);
            socket.data.roomId = null;

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

    socket.on('disconnect', () => {
        if (waitingUser === socket) {
            waitingUser = null;
        }

        const roomId = socket.data.roomId;
        if (roomId) {
            socket.to(roomId).emit('partner_left');
        }
    });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
