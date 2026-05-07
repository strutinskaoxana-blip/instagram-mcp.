const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { ListToolsRequestSchema, CallToolRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const express = require("express");
const axios = require("axios");

const INSTAGRAM_TOKEN = "EAAVTGjd5agkBReEKPN38kQSNvZBaXuFx0rKZCJ6TuPZBprH7zGUQHYWnO7Ki0VbRlGtg7o0r4ZCJeIxII2IFSKBk94J1obTliINFbeI3coJGnLLjG2pUvMc1poHGiV9V3ORHbdCipENaIzRneZBHWAAtp2emsftVHL4dfubQT1Jnvxi1YXZCE9Rx45Hr7v6iCcEnvB81DW1gxNIvTYZAFkQgkN64utQLPewfAZDZD";
const INSTAGRAM_USER_ID = "2611356802599164";

const app = express();
app.use(express.json());

function createServer() {
  const server = new Server(
    { name: "instagram-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "get_profile",
        description: "Obtenir les infos du profil Instagram",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_posts",
        description: "Obtenir les derniers posts Instagram",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "get_profile") {
      const res = await axios.get(`https://graph.instagram.com/v21.0/me?fields=id,name,biography,followers_count,media_count&access_token=${INSTAGRAM_TOKEN}`);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }
    if (request.params.name === "get_posts") {
      const res = await axios.get(`https://graph.instagram.com/v21.0/${INSTAGRAM_USER_ID}/media?fields=id,caption,media_type,timestamp,like_count,comments_count&access_token=${INSTAGRAM_TOKEN}`);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }
    return { content: [{ type: "text", text: "Outil non trouvé" }] };
  });

  return server;
}

const transports = new Map();

app.get("/sse", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const server = createServer();
  const transport = new SSEServerTransport("/sse", res);
  transports.set(transport.sessionId, transport);
  res.on("close", () => transports.delete(transport.sessionId));
  await server.connect(transport);
});

app.post("/sse", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const sessionId = req.query.sessionId;
  const transport = transports.get(sessionId);
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).json({ error: "Session non trouvée" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur MCP Instagram prêt sur le port ${PORT} !`);
});