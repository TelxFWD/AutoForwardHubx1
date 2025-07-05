import { storage } from "./storage";
import { otpRequestSchema, otpVerifySchema } from "@shared/schema";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import type { Express } from "express";

// Enhanced OTP verification system with database persistence and security
export function registerEnhancedOtpRoutes(app: Express) {
  
  // Enhanced OTP request with rate limiting and database persistence
  app.post("/api/sessions/request-otp", 
    rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 3, // 3 requests per minute per IP
      message: { message: "Too many OTP requests. Please wait before trying again." }
    }),
    async (req, res) => {
      try {
        // Support both formats: { phoneNumber, sessionName } and { phone }
        const phoneNumber = req.body.phoneNumber || req.body.phone;
        const sessionName = req.body.sessionName || `user_${phoneNumber?.replace(/[+\-\s]/g, '')}`;
        
        const validatedData = otpRequestSchema.parse({
          phoneNumber,
          sessionName
        });
        
        // Clean up expired OTP verifications
        await storage.cleanExpiredOtpVerifications();
        
        // Check if there's an existing pending verification
        const existingVerification = await storage.getOtpVerification(phoneNumber);
        if (existingVerification && existingVerification.status === "pending") {
          const timeRemaining = Math.max(0, existingVerification.expiresAt.getTime() - Date.now());
          if (timeRemaining > 0) {
            return res.status(429).json({
              success: false,
              message: "OTP already requested. Please wait before requesting again.",
              expiresIn: timeRemaining,
              canRetryAt: existingVerification.expiresAt.toISOString()
            });
          }
        }
        
        // Create temporary Python script for OTP request
        const { writeFile, unlink } = await import("fs/promises");
        const tempScriptPath = `temp_otp_request_${Date.now()}.py`;
        
        const pythonScript = `
import asyncio
import json
import os
from pathlib import Path
from telethon import TelegramClient
from telethon.errors import PhoneNumberInvalidError, FloodWaitError
from dotenv import load_dotenv

load_dotenv()

api_id = int(os.getenv("TELEGRAM_API_ID", "0"))
api_hash = os.getenv("TELEGRAM_API_HASH", "")

async def request_otp():
    if not api_id or not api_hash:
        print(json.dumps({"status": "error", "message": "API credentials not configured"}))
        return
    
    phone = "${phoneNumber}"
    session_name = "${sessionName}"
    
    sessions_dir = Path("sessions")
    sessions_dir.mkdir(exist_ok=True)
    session_file = sessions_dir / f"{session_name}.session"
    
    try:
        client = TelegramClient(str(session_file), api_id, api_hash)
        await client.connect()
        
        if await client.is_user_authorized():
            await client.disconnect()
            print(json.dumps({"status": "error", "message": "Session already exists and is authorized"}))
            return
        
        # Request OTP
        sent_code = await client.send_code_request(phone)
        await client.disconnect()
        
        result = {
            "status": "success",
            "message": f"OTP sent to {phone}",
            "phone_code_hash": sent_code.phone_code_hash,
            "session_name": session_name
        }
        print(json.dumps(result))
        
    except PhoneNumberInvalidError:
        print(json.dumps({"status": "error", "message": "Invalid phone number format"}))
    except FloodWaitError as e:
        print(json.dumps({"status": "error", "message": f"Rate limited. Please wait {e.seconds} seconds."}))
    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Error requesting OTP: {str(e)}"}))

if __name__ == "__main__":
    asyncio.run(request_otp())
`;
        
        await writeFile(tempScriptPath, pythonScript);
        
        // Execute the script with timeout
        const { spawn } = await import("child_process");
        const pythonProcess = spawn("python", [tempScriptPath]);
        
        let output = "";
        let errorOutput = "";
        let processTimedOut = false;
        
        // Set timeout for process execution
        const processTimeout = setTimeout(() => {
          processTimedOut = true;
          pythonProcess.kill();
          if (!res.headersSent) {
            res.status(408).json({ 
              success: false, 
              message: "OTP request timed out. Please try again." 
            });
          }
        }, 30000); // 30 seconds timeout
        
        pythonProcess.stdout.on("data", (data) => {
          output += data.toString();
        });
        
        pythonProcess.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });
        
        pythonProcess.on("close", async (code) => {
          clearTimeout(processTimeout);
          
          // Clean up temporary script
          try {
            await unlink(tempScriptPath);
          } catch (err) {
            console.error("Failed to clean up temp script:", err);
          }
          
          if (processTimedOut || res.headersSent) return;
          
          try {
            if (code === 0) {
              const result = JSON.parse(output.trim());
              
              if (result.status === "success") {
                // Store OTP verification in database with 2-minute expiration
                const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
                
                await storage.createOtpVerification({
                  phoneNumber: phoneNumber,
                  phoneCodeHash: result.phone_code_hash,
                  sessionName: sessionName,
                  userId: null, // Will be set after successful verification
                  status: "pending",
                  expiresAt: expiresAt
                });
                
                // Log activity
                await storage.createActivity({
                  type: "otp_requested",
                  message: `OTP requested for ${phoneNumber}`,
                  details: `Session: ${sessionName}, Expires: ${expiresAt.toISOString()}`,
                  severity: "info",
                });
                
                res.json({
                  success: true,
                  message: "OTP sent successfully",
                  sessionName: sessionName,
                  expiresAt: expiresAt.toISOString(),
                  expiresIn: 2 * 60 * 1000 // 2 minutes in milliseconds
                });
              } else {
                res.status(400).json({
                  success: false,
                  message: result.message || "Failed to send OTP",
                });
              }
            } else {
              console.error("Python script failed:", errorOutput);
              res.status(500).json({ 
                success: false, 
                message: "Failed to process OTP request" 
              });
            }
          } catch (parseError) {
            console.error("Failed to parse Python output:", output, errorOutput);
            res.status(500).json({ 
              success: false, 
              message: "Failed to process OTP request" 
            });
          }
        });
        
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ 
            success: false,
            message: "Invalid request data", 
            errors: error.errors 
          });
        }
        console.error("OTP request error:", error);
        res.status(500).json({ 
          success: false, 
          message: "Internal server error" 
        });
      }
    });

  // Enhanced OTP verification with database validation and security
  app.post("/api/sessions/verify-otp", 
    rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 5, // 5 verification attempts per minute per IP
      message: { message: "Too many verification attempts. Please wait before trying again." }
    }),
    async (req, res) => {
      try {
        // Support both formats: { phoneNumber, code } and { phone, otp }
        const phoneNumber = req.body.phoneNumber || req.body.phone;
        const code = req.body.code || req.body.otp;
        
        const validatedData = otpVerifySchema.parse({
          phoneNumber,
          code
        });
        
        // Clean up expired OTP verifications
        await storage.cleanExpiredOtpVerifications();
        
        // Get OTP verification from database
        const otpVerification = await storage.getOtpVerification(phoneNumber);
        
        if (!otpVerification) {
          return res.status(400).json({
            success: false,
            message: "No OTP session found. Please request a new OTP."
          });
        }
        
        if (otpVerification.status !== "pending") {
          return res.status(400).json({
            success: false,
            message: "OTP session is not pending. Please request a new OTP."
          });
        }
        
        // Check if OTP has expired
        if (new Date() > otpVerification.expiresAt) {
          // Mark as expired and clean up
          await storage.updateOtpVerification(phoneNumber, { status: "expired" });
          await storage.deleteOtpVerification(phoneNumber);
          
          return res.status(400).json({
            success: false,
            message: "OTP has expired. Please request a new code."
          });
        }
        
        // Create temporary Python script for OTP verification
        const { writeFile, unlink } = await import("fs/promises");
        const tempScriptPath = `temp_otp_verify_${Date.now()}.py`;
        
        const pythonScript = `
import asyncio
import json
import os
from pathlib import Path
from telethon import TelegramClient
from telethon.errors import PhoneCodeInvalidError, SessionPasswordNeededError
from dotenv import load_dotenv

load_dotenv()

api_id = int(os.getenv("TELEGRAM_API_ID", "0"))
api_hash = os.getenv("TELEGRAM_API_HASH", "")

async def verify_otp():
    if not api_id or not api_hash:
        print(json.dumps({"status": "error", "message": "API credentials not configured"}))
        return
    
    phone = "${phoneNumber}"
    otp_code = "${code}"
    session_name = "${otpVerification.sessionName}"
    phone_code_hash = "${otpVerification.phoneCodeHash}"
    
    sessions_dir = Path("sessions")
    sessions_dir.mkdir(exist_ok=True)
    session_file = sessions_dir / f"{session_name}.session"
    
    try:
        client = TelegramClient(str(session_file), api_id, api_hash)
        await client.connect()
        
        # Verify OTP using stored phone_code_hash
        await client.sign_in(
            phone=phone,
            code=otp_code,
            phone_code_hash=phone_code_hash
        )
        
        if await client.is_user_authorized():
            user = await client.get_me()
            await client.disconnect()
            
            result = {
                "status": "success",
                "message": f"OTP verified successfully for {user.first_name}",
                "session_name": session_name,
                "user_info": {
                    "id": user.id,
                    "first_name": user.first_name,
                    "username": user.username
                }
            }
            print(json.dumps(result))
        else:
            await client.disconnect()
            print(json.dumps({"status": "error", "message": "OTP verification failed"}))
            
    except PhoneCodeInvalidError:
        print(json.dumps({"status": "error", "message": "Invalid OTP code. Please try again."}))
    except SessionPasswordNeededError:
        print(json.dumps({"status": "error", "message": "Two-step verification enabled. Please disable it temporarily."}))
    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Error verifying OTP: {str(e)}"}))

if __name__ == "__main__":
    asyncio.run(verify_otp())
`;
        
        await writeFile(tempScriptPath, pythonScript);
        
        // Execute the script with timeout
        const { spawn } = await import("child_process");
        const pythonProcess = spawn("python", [tempScriptPath]);
        
        let output = "";
        let errorOutput = "";
        let processTimedOut = false;
        
        // Set timeout for process execution
        const processTimeout = setTimeout(() => {
          processTimedOut = true;
          pythonProcess.kill();
          if (!res.headersSent) {
            res.status(408).json({ 
              success: false, 
              message: "OTP verification timed out. Please try again." 
            });
          }
        }, 30000); // 30 seconds timeout
        
        pythonProcess.stdout.on("data", (data) => {
          output += data.toString();
        });
        
        pythonProcess.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });
        
        pythonProcess.on("close", async (code) => {
          clearTimeout(processTimeout);
          
          // Clean up temporary script
          try {
            await unlink(tempScriptPath);
          } catch (err) {
            console.error("Failed to clean up temp script:", err);
          }
          
          if (processTimedOut || res.headersSent) return;
          
          try {
            if (code === 0) {
              const result = JSON.parse(output.trim());
              
              if (result.status === "success") {
                // Update OTP verification as successful
                await storage.updateOtpVerification(phoneNumber, { status: "verified" });
                
                // Create session in database
                const session = await storage.createSession({
                  name: result.session_name,
                  phone: phoneNumber,
                  sessionFile: `sessions/${result.session_name}.session`,
                  status: "active",
                  userId: 1 // Default user for now
                });
                
                // Log activity
                await storage.createActivity({
                  type: "session_created",
                  message: `Session created successfully: ${result.session_name}`,
                  details: `Phone: ${phoneNumber} - User: ${result.user_info?.first_name || 'Unknown'}`,
                  sessionId: session.id,
                  severity: "success",
                });
                
                // Clean up OTP verification after successful use
                await storage.deleteOtpVerification(phoneNumber);
                
                res.json({
                  success: true,
                  message: "OTP verified successfully",
                  session: session,
                  userInfo: result.user_info
                });
              } else {
                res.status(400).json({
                  success: false,
                  message: result.message || "OTP verification failed"
                });
              }
            } else {
              console.error("Python script failed:", errorOutput);
              res.status(500).json({ 
                success: false, 
                message: "Failed to process OTP verification" 
              });
            }
          } catch (parseError) {
            console.error("Failed to parse Python output:", output, errorOutput);
            res.status(500).json({ 
              success: false, 
              message: "Failed to process OTP verification" 
            });
          }
        });
        
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ 
            success: false,
            message: "Invalid request data", 
            errors: error.errors 
          });
        }
        console.error("OTP verification error:", error);
        res.status(500).json({ 
          success: false, 
          message: "Internal server error" 
        });
      }
    });

  // OTP status check endpoint
  app.get("/api/sessions/otp-status/:phoneNumber", async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      
      // Clean up expired OTP verifications
      await storage.cleanExpiredOtpVerifications();
      
      const otpVerification = await storage.getOtpVerification(phoneNumber);
      
      if (!otpVerification) {
        return res.json({ 
          hasSession: false, 
          message: "No active OTP session" 
        });
      }
      
      const timeRemaining = Math.max(0, otpVerification.expiresAt.getTime() - Date.now());
      
      if (timeRemaining <= 0) {
        // Clean up expired session
        await storage.deleteOtpVerification(phoneNumber);
        return res.json({ 
          hasSession: false, 
          message: "OTP session expired" 
        });
      }
      
      res.json({
        hasSession: true,
        sessionName: otpVerification.sessionName,
        status: otpVerification.status,
        expiresIn: timeRemaining,
        expiresAt: otpVerification.expiresAt.toISOString()
      });
      
    } catch (error) {
      console.error("OTP status error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });

  // Resend OTP endpoint
  app.post("/api/sessions/resend-otp", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ 
          success: false, 
          message: "phoneNumber is required" 
        });
      }
      
      // Get existing session name if available
      const existingVerification = await storage.getOtpVerification(phoneNumber);
      const sessionName = existingVerification?.sessionName || `user_${phoneNumber.replace(/[+\-\s]/g, '')}`;
      
      // Delete existing verification to allow fresh request
      if (existingVerification) {
        await storage.deleteOtpVerification(phoneNumber);
      }
      
      // Forward to request-otp endpoint
      req.body.sessionName = sessionName;
      
      // Find and execute request-otp handler
      const requestOtpRoute = app._router.stack.find((layer: any) => 
        layer.route?.path === '/api/sessions/request-otp' && 
        layer.route.methods.post
      );
      
      if (requestOtpRoute && requestOtpRoute.route.stack[0]) {
        return requestOtpRoute.route.stack[0].handle(req, res);
      }
      
      res.status(500).json({ 
        success: false, 
        message: "Failed to resend OTP" 
      });
      
    } catch (error) {
      console.error("Resend OTP error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });
}