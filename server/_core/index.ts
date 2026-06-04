import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { getContractById, getWaybillDetails, migrateDatabase } from "../db";
import { generateContractPrintHtml } from "../contractPrintService";
import { generateWaybillPrintHtml } from "../waybillPrintService";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  await migrateDatabase();
  console.log("[Database] Migrations are up to date");

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  // Keep legacy PDF links pointed at the single approved SP-31 print form.
  app.get("/api/waybills/:id/pdf", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    res.redirect(307, `/api/waybills/${id}/print`);
  });

  // Printable grain waybill form based on the SP-31 sample.
  app.get("/api/waybills/:id/print", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }
      const details = await getWaybillDetails(id);
      if (!details) {
        res.status(404).json({ error: "Waybill not found" });
        return;
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.send(generateWaybillPrintHtml(details));
    } catch (err) {
      console.error("Waybill print generation error:", err);
      res.status(500).json({ error: "Failed to generate waybill print form" });
    }
  });

  // Contract print form endpoint
  app.get("/api/contracts/:id/print", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }
      const contractData = await getContractById(id);
      if (!contractData) {
        res.status(404).json({ error: "Contract not found" });
        return;
      }

      const html = generateContractPrintHtml({
        contract: contractData.contract,
        counterparty: contractData.counterparty,
      });

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.send(html);
    } catch (err) {
      console.error("Contract print generation error:", err);
      res.status(500).json({ error: "Failed to generate contract print form" });
    }
  });

  // Contract print form preview from draft fields (without DB save)
  app.post("/api/contracts/print-preview", async (req, res) => {
    try {
      const body = (req.body ?? {}) as {
        contract?: Record<string, unknown>;
        counterparty?: Record<string, unknown> | null;
      };

      const html = generateContractPrintHtml({
        contract: (body.contract ?? {}) as any,
        counterparty: (body.counterparty ?? null) as any,
      });

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.send(html);
    } catch (err) {
      console.error("Contract print preview generation error:", err);
      res.status(500).json({ error: "Failed to generate contract print preview" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port =
    process.env.NODE_ENV === "production"
      ? preferredPort
      : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
