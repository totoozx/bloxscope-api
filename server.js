
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://golden-world-690169.framer.app"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const cache = new Map();

async function getJSON(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`Roblox respondió ${response.status}`);
  }

  return response.json();
}

app.get("/", (req, res) => {
  res.json({
    name: "Bloxscope API",
    status: "online"
  });
});

app.get("/api/game/:id", async (req, res) => {
  const id = req.params.id;

  if (!/^\d{1,20}$/.test(id)) {
    return res.status(400).json({ error: "ID inválido" });
  }

  const saved = cache.get(id);
  if (saved && Date.now() - saved.time < 300000) {
    return res.json(saved.data);
  }

  try {
    const [games, votes, icons] = await Promise.all([
      getJSON(
        `https://games.roblox.com/v1/games?universeIds=${id}`
      ),
      getJSON(
        `https://games.roblox.com/v1/games/votes?universeIds=${id}`
      ),
      getJSON(
        `https://thumbnails.roblox.com/v1/games/icons?universeIds=${id}&size=150x150&format=Png&isCircular=false`
      )
    ]);

    const game = games.data?.[0];

    if (!game) {
      return res.status(404).json({
        error: "Juego no encontrado"
      });
    }

    const vote = votes.data?.[0];
    const result = {
      id: game.id,
      name: game.name,
      description: game.description,
      creator: game.creator?.name,
      playing: game.playing,
      visits: game.visits,
      favorites: game.favoritedCount,
      likes: vote?.upVotes ?? null,
      dislikes: vote?.downVotes ?? null,
      icon: icons.data?.[0]?.imageUrl ?? null,
      placeId: game.rootPlaceId,
      updatedAt: new Date().toISOString()
    };

    cache.set(id, {
      time: Date.now(),
      data: result
    });

    res.json(result);
  } catch (error) {
    console.error(error.message);
    res.status(502).json({
      error: "No se pudieron obtener datos de Roblox"
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Bloxscope API funcionando en puerto ${PORT}`);
});
