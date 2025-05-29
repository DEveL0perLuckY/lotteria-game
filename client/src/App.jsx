import React, { useState, useEffect, useRef } from "react";
import {
  Button,
  TextField,
  Grid,
  Typography,
  Box,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import axios from "axios";
import io from "socket.io-client";

const socket = io("http://localhost:8080");

const createEmptyGrid = () =>
  Array(3)
    .fill()
    .map(() => Array(3).fill(""));

function App() {
  const [grid1, setGrid1] = useState(createEmptyGrid());
  const [grid2, setGrid2] = useState(createEmptyGrid());
  const [gameStatus, setGameStatus] = useState("setup"); // setup, in_progress, finished
  const [winner, setWinner] = useState(null);
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const intervalRef = useRef(null);
  const gameIdRef = useRef(null);

  useEffect(() => {
    socket.on("game_update", (game) => {
      setGrid1(game.user1.grid.map((row) => [...row]));
      setGrid2(game.user2.grid.map((row) => [...row]));
      setDrawnNumbers(game.drawnNumbers || []);

      if (game.winner) {
        setWinner(game.winner);
        setGameStatus("finished");
        if (intervalRef.current) clearInterval(intervalRef.current);
        setOpenDialog(true);
      }
    });

    return () => {
      socket.off("game_update");
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleChange = (gridSetter, grid, r, c, val) => {
    const numValue = Number(val);
    if (val === "" || (numValue >= 1 && numValue <= 9)) {
      const newGrid = grid.map((row) => [...row]);
      newGrid[r][c] = val === "" ? "" : numValue;
      gridSetter(newGrid);
    }
  };

  const validateGrid = (grid) => {
    const flatGrid = grid.flat();
    return (
      flatGrid.length === 9 &&
      flatGrid.every((num) => num >= 1 && num <= 9) &&
      new Set(flatGrid).size === 9
    );
  };

  const startGame = async () => {
    if (!validateGrid(grid1) || !validateGrid(grid2)) {
      alert("Each grid must contain unique numbers from 1-9!");
      return;
    }

    try {
      const response = await axios.post("http://localhost:8080/api/start", {
        user1: { grid: grid1 },
        user2: { grid: grid2 },
      });

      gameIdRef.current = response.data._id;
      setGameStatus("in_progress");
      startNumberGeneration();
    } catch (error) {
      console.error("Error starting game:", error);
    }
  };

  const startNumberGeneration = () => {
    const availableNumbers = [...Array(9).keys()].map((n) => n + 1);
    shuffleArray(availableNumbers);

    intervalRef.current = setInterval(async () => {
      if (availableNumbers.length === 0 || gameStatus === "finished") {
        clearInterval(intervalRef.current);
        return;
      }

      const number = availableNumbers.shift();
      try {
        await axios.post("http://localhost:8080/api/cut", {
          gameId: gameIdRef.current,
          number,
        });
      } catch (error) {
        console.error("Error cutting number:", error);
      }
    }, 1500);
  };

  const stopGame = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setGameStatus("finished");
  };

  const resetGame = () => {
    setGrid1(createEmptyGrid());
    setGrid2(createEmptyGrid());
    setGameStatus("setup");
    setWinner(null);
    setDrawnNumbers([]);
    setOpenDialog(false);
    gameIdRef.current = null;
  };

  const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const isNumberDrawn = (number) => drawnNumbers.includes(number);

  const renderGrid = (grid, userIndex) => (
    <Paper elevation={3} sx={{ p: 2, mb: 2, backgroundColor: "#f5f5f5" }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold" }}>
        User {userIndex + 1} Grid
      </Typography>
      {grid.map((row, rIdx) => (
        <Grid container spacing={1} key={rIdx} justifyContent="center">
          {row.map((num, cIdx) => (
            <Grid item xs={4} key={cIdx}>
              <TextField
                value={num}
                onChange={(e) =>
                  handleChange(
                    userIndex === 0 ? setGrid1 : setGrid2,
                    grid,
                    rIdx,
                    cIdx,
                    e.target.value
                  )
                }
                type="number"
                disabled={gameStatus !== "setup"}
                fullWidth
                inputProps={{
                  min: 1,
                  max: 9,
                  style: {
                    textAlign: "center",
                    textDecoration: isNumberDrawn(num)
                      ? "line-through"
                      : "none",
                    fontWeight: isNumberDrawn(num) ? "bold" : "normal",
                    color: isNumberDrawn(num) ? "#f44336" : "#000",
                  },
                }}
                sx={{
                  "& .MuiInputBase-root": {
                    height: 60,
                    fontSize: "1.5rem",
                  },
                  backgroundColor: isNumberDrawn(num) ? "#ffebee" : "#fff",
                }}
              />
            </Grid>
          ))}
        </Grid>
      ))}

      <Box sx={{ mt: 2, display: "flex", justifyContent: "center", gap: 1 }}>
        <Button
          variant="contained"
          color="success"
          onClick={startGame}
          disabled={gameStatus !== "setup"}
          sx={{ flex: 1 }}
        >
          START GAME
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={stopGame}
          disabled={gameStatus !== "in_progress"}
          sx={{ flex: 1 }}
        >
          STOP GAME
        </Button>
      </Box>
    </Paper>
  );

  return (
    <Box p={4} maxWidth={800} margin="0 auto">
      <Typography
        variant="h4"
        gutterBottom
        sx={{
          textAlign: "center",
          fontWeight: "bold",
          color: "#2e7d32",
          mb: 4,
        }}
      >
        El Lotteria Game
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          {renderGrid(grid1, 0)}
        </Grid>
        <Grid item xs={12} md={6}>
          {renderGrid(grid2, 1)}
        </Grid>
      </Grid>

      {drawnNumbers.length > 0 && (
        <Box sx={{ mt: 4, textAlign: "center" }}>
          <Typography variant="h6">Drawn Numbers:</Typography>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 1,
              mt: 1,
            }}
          >
            {drawnNumbers.map((num, idx) => (
              <Paper
                key={idx}
                sx={{
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  fontSize: "1.2rem",
                  backgroundColor: "#e8f5e9",
                }}
              >
                {num}
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {gameStatus === "finished" && !openDialog && (
        <Box sx={{ mt: 4, textAlign: "center" }}>
          <Button variant="contained" onClick={resetGame}>
            PLAY AGAIN
          </Button>
        </Box>
      )}

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle
          sx={{
            textAlign: "center",
            backgroundColor: "#4caf50",
            color: "white",
          }}
        >
          🎉 Winner! 🎉
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center", py: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: "bold" }}>
            {winner}
          </Typography>
          <Typography variant="body1" sx={{ mt: 2 }}>
            Congratulations on winning the game!
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 3 }}>
          <Button variant="contained" onClick={resetGame} sx={{ px: 5, py: 1 }}>
            PLAY AGAIN
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default App;
