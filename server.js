const {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  AttributeIds,
  TimestampsToReturn,
  resolveNodeId
} = require("node-opcua");
const express = require("express");
const app = express();
const http = require("http");
const appServer = http.createServer(app);
const {Server} = require("socket.io");
const io = new Server(appServer, {
  cors: {
    origin: '*'
  }
});
const ejs = require("ejs");
const { string } = require("yargs");
var cors = require('cors')

const endpointUrl = "opc.tcp://localhost:49320";
const port = process.env.PORT || 3001;

async function readKepwareData() {
  let session, client;
  try {
    const connectionStrategy = {
      maxRetry: 10000,
      initialDelay: 2000,
      maxDelay: 20 * 1000,
    };

    client = OPCUAClient.create({
      applicationName: "NodeOPCUA-Client",
      connectionStrategy: connectionStrategy,
      securityMode: MessageSecurityMode.None,
      securityPolicy: SecurityPolicy.None,
      endpointMustExist: false,
      keepSessionAlive: true,
      reconnectOnFailure: true,
    });

    await client.connect(endpointUrl);

    console.log("connected !");

    session = await client.createSession();

    console.log("session created !");

    const groupName = "Simulation Examples.Functions.Sine2";

    const pathToTags = `ns=2;s=${groupName}`;

    //crear la subscription
    const subscription = await session.createSubscription2({
      requestedPublishingInterval: 1000,
      requestedLifetimeCount: 200,
      requestedMaxKeepAliveCount: 20,
      maxNotificationsPerPublish: 100,
      publishingEnabled: true,
      priority: 10,
    });

    subscription
      .on("started", function () {
        console.log(`Subscricion inciada - ID ${subscription.subscriptionId}`);
      })
      .on("keepalive", function () {
        console.log("keepalive");
      })
      .on("terminated", function () {
        console.log("terminated");
      });

    const itemToMonitor = {
      nodeId: resolveNodeId(pathToTags),
      attributeId: AttributeIds.Value,
    };
    const parameters = {
      samplingInterval: 1000,
      discardOldest: true,
      queueSize: 1,
    };

    const monitoredItem = await subscription.monitor(
      itemToMonitor,
      parameters,
      TimestampsToReturn.Both
    );

    monitoredItem.on("changed", (dataValue) => {
      const timestamp = new Date().getTime();
      const value = dataValue.value.value;
      console.log(" value has changed : ", dataValue.value.toString());
      io.emit("data", {
      timestamp,
      value,
      });
    });

    // Cerrar la sesión y desconectarse del servidor
  } catch (err) {
    console.error(err);
  } finally {
  }
}

readKepwareData();

// Configurar servidor web para servir la página HTML y los archivos JavaScript
// app.set("views engine", "ejs");
// app.use(express.static("public"));
app.use(cors({origin:'*'}))

app.get("/", (req, res) => {
  res.send("conectado")
});

// Iniciar servidor web
appServer.listen(port, () => {
  console.log(`Servidor web iniciado en el puerto ${port}`);
});
