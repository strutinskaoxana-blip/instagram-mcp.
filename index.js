const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { ListToolsRequestSchema, CallToolRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const express = require("express");
const axios = require("axios");

const INSTAGRAM_TOKEN = "EAAVTGjd5agkBReEKPN38kQSNvZBaXuFx0rKZCJ6TuPZBprH7zGUQHYWnO7Ki0VbRlGtg7o0r4ZCJeIxII2IFSKBk94J1obTliINFbeI3coJGnLLjG2pUvMc1poHGiV9V3ORHbdCipENaIzRneZBHWAAtp2emsftVHL4dfubQTlJnvxilYXZCE9Rx45Hr7v6iCcEnvB8lDWlgxNIvTYZAFkQgkN64utQLPewfAZDZD";
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
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Nombre de posts" },
          },
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "get_profile") {
      try {
        const res = await axios.get(
          `https://graph.instagram.com/${INSTAGRAM_USER_ID}?fields=id,username,account_type,media_count&access_token=${INSTAGRAM_TOKEN}`
        );
        return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Erreur: ${err.message}` }] };
      }
    }

    if (name === "get_posts") {
      try {
        const limit = args?.limit || 10;
        const res = await axios.get(
          `https://graph.instagram.com/${INSTAGRAM_USER_ID}/media?fields=id,caption,media_type,timestamp,permalink&limit=${limit}&access_token=${INSTAGRAM_TOKEN}`
        );
        return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Erreur: ${err.message}` }] };
      }
    }

    return { content: [{ type: "text", text: "Outil non trouvé" }] };
  });

  return server;
}

const transports = new Map();

app.get("/sse", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const server = createServer();
  const transport = new SSEServerTransport("/messages", res);
  transports.set(transport.sessionId, transport);
  res.on("close", () => transports.delete(transport.sessionId));
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const sessionId = req.query.sessionId;
  const transport = transports.get(sessionId);
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).json({ error: "Session non trouvée" });
  }
});

app.listen(3000, () => {
  console.log("Serveur MCP Instagram prêt sur le port 3000 !");
});
