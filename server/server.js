const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const GameSchema = new mongoose.Schema(
  {
    user1: {
      grid: [[Number]],
      cutNumbers: [Number],
    },
    user2: {
      grid: [[Number]],
      cutNumbers: [Number],
    },
    drawnNumbers: [Number],
    status: {
      type: String,
      enum: ["setup", "in_progress", "finished"],
      default: "setup",
    },
    winner: String,
  },
  { timestamps: true }
);

const Game = mongoose.model("Game", GameSchema);

// Create new game
app.post("/api/start", async (req, res) => {
  try {
    const { user1, user2 } = req.body;
    const newGame = new Game({
      user1: {
        grid: user1.grid,
        cutNumbers: [],
      },
      user2: {
        grid: user2.grid,
        cutNumbers: [],
      },
      drawnNumbers: [],
      status: "in_progress",
    });

    const savedGame = await newGame.save();
    io.emit("game_update", savedGame);
    res.status(201).json(savedGame);
  } catch (error) {
    res.status(500).json({ message: "Error creating game", error });
  }
});

app.post("/api/cut", async (req, res) => {
  try {
    const { gameId, number } = req.body;
    const game = await Game.findById(gameId);

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    game.drawnNumbers.push(number);

    if (
      game.user1.grid.flat().includes(number) &&
      !game.user1.cutNumbers.includes(number)
    ) {
      game.user1.cutNumbers.push(number);
    }
    if (
      game.user2.grid.flat().includes(number) &&
      !game.user2.cutNumbers.includes(number)
    ) {
      game.user2.cutNumbers.push(number);
    }

    const updatedGame = await game.save();
    io.emit("game_update", updatedGame);
    res.status(200).json(updatedGame);
  } catch (error) {
    res.status(500).json({ message: "Error updating game", error });
  }
});

const watchGames = () => {
  const changeStream = Game.watch([], { fullDocument: "updateLookup" });

  changeStream.on("change", async (change) => {
    try {
      const fullDocument = change.fullDocument;
      if (!fullDocument) return;

      if (fullDocument.status === "in_progress") {
        const winner = checkWin(fullDocument);

        if (winner) {
          const updatedGame = await Game.findByIdAndUpdate(
            fullDocument._id,
            {
              winner,
              status: "finished",
            },
            { new: true }
          );
          io.emit("game_update", updatedGame);
        }
      }
    } catch (error) {
      console.error("Error in change stream:", error);
    }
  });
};

const checkWin = (game) => {
  if (checkRows(game.user1) || checkColumns(game.user1)) {
    return "User 1";
  }

  if (checkRows(game.user2) || checkColumns(game.user2)) {
    return "User 2";
  }

  return null;
};

const checkRows = (user) => {
  return user.grid.some((row) =>
    row.every((num) => user.cutNumbers.includes(num))
  );
};

const checkColumns = (user) => {
  for (let col = 0; col < 3; col++) {
    const columnComplete = user.grid.every((row) =>
      user.cutNumbers.includes(row[col])
    );
    if (columnComplete) return true;
  }
  return false;
};

watchGames();

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
