// const debug = require("debug")("node-angular");
import debug from "debug";
import http from "http";
// import config from "config";
import dotenv from "dotenv";
import app from "./app.js";
import { Server } from "socket.io";

dotenv.config();

const normalizePort = val => {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
};

const onError = error => {
  if (error.syscall !== "listen") {
    throw error;
  }
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + port;
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
};

const onListening = () => {
  const addr = server.address();
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + port;
  debug("Listening on " + bind);
  console.log("Listening on " + bind);
};

// console.log(config.get('NODE_ENV'));
// console.log(config.get('PORT'));
// console.log(app.get('env'));

// const port = normalizePort(config.get('PORT') || "5000");
// const port = "80";
// const port = "4000";
const port = normalizePort(process.env.PORT || "5001");
app.set("port", port);

// process.env.TZ ="IST";
// console.log(new Date());

// const nDate = new Date().toLocaleString('en-US', {
//   timeZone: 'Asia/Calcutta'
// });

// console.log(nDate);

const server = http.createServer(app);

server.on("error", onError);
server.on("listening", onListening);

const io = new Server(server, {
  allowEIO3: true,
  cors: {
    origin: '*'
  }
});

// const io = new Server(server);

global.io = io;

io.on("connection", (socket) => {
  // console.log(process.env.FRONTEND_URL);
  // console.log(socket.id);
  socket.on('AllProduction', async (arg) => {
    socket.broadcast.emit('AllProduction', 'Refresh All Productions');
  })
  socket.on('PurchaseOrder', async (arg) => {
    socket.broadcast.emit('PurchaseOrder', 'Refresh All Purchase Orders');
  })
});

server.listen(port, () => {
  console.log(`Socket server is running on port ${port}`);
});

export default server;
// module.exports = server;