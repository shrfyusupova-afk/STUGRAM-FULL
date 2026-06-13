const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");

const { env } = require("../config/env");
const logger = require("../utils/logger");
const { redis, isRedisReady } = require("../config/redis");
const { authenticateSocket } = require("./socketAuth");

let ioInstance = null;
let adapterPubClient = null;
let adapterSubClient = null;
let adapterStatus = { enabled: env.socketIoRedisAdapterEnabled, attached: false, reason: "not-initialized" };

const getSocketCorsOrigin = () => {
  if (env.clientUrl === true) return "*";
  return env.clientUrl;
};

const initSocketServer = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: getSocketCorsOrigin(),
      credentials: true,
    },
    pingInterval: 20000,
    pingTimeout: 30000,
    connectTimeout: 20000,
  });

  ioInstance.use(authenticateSocket);

  logger.info("Socket.IO initialized");
  return ioInstance;
};

const getIo = () => {
  if (!ioInstance) {
    throw new Error("Socket.IO is not initialized");
  }

  return ioInstance;
};

// Lets multiple Socket.IO instances (e.g. several Render instances behind a
// load balancer) share room membership and broadcast events to each other
// via Redis pub/sub. Disabled by default; opt in once a dedicated Redis is
// provisioned for horizontal scaling.
const attachRedisAdapter = async (io) => {
  if (!env.socketIoRedisAdapterEnabled) {
    adapterStatus = { enabled: false, attached: false, reason: "disabled" };
    logger.info("Socket.IO Redis adapter disabled; running in single-instance mode");
    return adapterStatus;
  }

  if (!isRedisReady()) {
    adapterStatus = { enabled: true, attached: false, reason: "redis-not-ready" };
    logger.warn("Socket.IO Redis adapter enabled but Redis is not ready; running in single-instance mode");
    return adapterStatus;
  }

  try {
    adapterPubClient = redis.duplicate();
    adapterSubClient = redis.duplicate();

    adapterPubClient.on("error", (error) => {
      logger.warn("Socket.IO Redis adapter pub client error", { message: error.message });
    });
    adapterSubClient.on("error", (error) => {
      logger.warn("Socket.IO Redis adapter sub client error", { message: error.message });
    });

    await Promise.all([adapterPubClient.connect(), adapterSubClient.connect()]);

    io.adapter(createAdapter(adapterPubClient, adapterSubClient, {
      key: `${env.redisPrefix}:socket.io`,
    }));

    adapterStatus = { enabled: true, attached: true, reason: "ok" };
    logger.info("Socket.IO Redis adapter attached; horizontal scaling enabled");
  } catch (error) {
    adapterStatus = { enabled: true, attached: false, reason: "attach-failed" };
    logger.error("Failed to attach Socket.IO Redis adapter; running in single-instance mode", {
      message: error.message,
    });

    await Promise.allSettled([adapterPubClient?.quit(), adapterSubClient?.quit()]);
    adapterPubClient = null;
    adapterSubClient = null;
  }

  return adapterStatus;
};

const getSocketAdapterStatus = () => ({ ...adapterStatus });

const closeSocketServer = async () => {
  if (ioInstance) {
    await new Promise((resolve) => {
      ioInstance.close(() => resolve());
    });

    ioInstance = null;
  }

  await Promise.allSettled([adapterPubClient?.quit(), adapterSubClient?.quit()]);
  adapterPubClient = null;
  adapterSubClient = null;
  adapterStatus = { enabled: env.socketIoRedisAdapterEnabled, attached: false, reason: "closed" };
};

module.exports = {
  initSocketServer,
  getIo,
  attachRedisAdapter,
  getSocketAdapterStatus,
  closeSocketServer,
};
