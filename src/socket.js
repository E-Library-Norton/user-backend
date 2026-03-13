const { Server } = require("socket.io");

let io;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: [
                "http://localhost:3000",
                "http://localhost:3001",
                "https://elibrary-user.vercel.app",
                "https://elibrary-dashboard.vercel.app"
            ],
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        console.log(`🔌 New client connected: ${socket.id}`);

        socket.on("disconnect", () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

module.exports = { initSocket, getIO };
