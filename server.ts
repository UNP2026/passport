import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const NP_API_URL = "https://api.novaposhta.ua/v2.0/json/";
  const NP_API_KEY = process.env.NOVA_POSHTA_API_KEY;

  // Nova Poshta Proxy Routes
  app.post("/api/np/cities", async (req, res) => {
    try {
      const { search } = req.body;
      const response = await axios.post(NP_API_URL, {
        apiKey: NP_API_KEY,
        modelName: "Address",
        calledMethod: "getCities",
        methodProperties: {
          FindByString: search,
          Limit: "20",
        },
      });
      res.json(response.data);
    } catch (error) {
      console.error("NP Cities Error:", error);
      res.status(500).json({ error: "Failed to fetch cities" });
    }
  });

  app.post("/api/np/streets", async (req, res) => {
    try {
      const { cityRef, search } = req.body;
      const response = await axios.post(NP_API_URL, {
        apiKey: NP_API_KEY,
        modelName: "Address",
        calledMethod: "getStreet",
        methodProperties: {
          CityRef: cityRef,
          FindByString: search,
          Limit: "20",
        },
      });
      res.json(response.data);
    } catch (error) {
      console.error("NP Streets Error:", error);
      res.status(500).json({ error: "Failed to fetch streets" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
