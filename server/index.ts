import dotenv from "dotenv";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Load environment variables from .env file
dotenv.config();

// Log environment status
if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL not set. Database features will be unavailable until configured.");
}

// Check for required environment variables
const requiredEnvVars = ['TELEGRAM_API_ID', 'TELEGRAM_API_HASH'];
const missingVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
  console.log(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
  console.log('📝 These are required for Telegram integration but the app will continue to run.');
  console.log('💡 Add them to your .env file when ready to use Telegram features.');
}

const app = express();

// Apply security middleware first
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Configure trust proxy for Replit environment
app.set('trust proxy', 1);

// Disable CSP in development for Vite HMR
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'", "data:"],
      },
    },
  }));
} else {
  // Development mode - minimal security for Vite compatibility
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
}

// Global rate limiting
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '::1' || req.ip === '127.0.0.1', // Skip localhost
});
app.use(globalRateLimit);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Only log response body for errors in production
      if (capturedJsonResponse && (res.statusCode >= 400 || process.env.NODE_ENV === 'development')) {
        const responseStr = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${responseStr.length > 100 ? responseStr.slice(0, 100) + "..." : responseStr}`;
      }

      if (logLine.length > 120) {
        logLine = logLine.slice(0, 119) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use PORT from environment or default to 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
