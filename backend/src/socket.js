const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let io;

const init = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authenticate every socket at handshake time
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    // Join personal room so notifications can be delivered to this user only
    socket.join(`user:${socket.user.id}`);

    socket.on('join_project', async (projectId) => {
      try {
        const membership = await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId: socket.user.id } }
        });
        if (!membership) {
          socket.emit('error', { message: 'You are not a member of this project' });
          return;
        }
        socket.join(`project:${projectId}`);
      } catch {
        socket.emit('error', { message: 'Failed to join project room' });
      }
    });

    socket.on('leave_project', (projectId) => socket.leave(`project:${projectId}`));
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

module.exports = { init, getIO };
