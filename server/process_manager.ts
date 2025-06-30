/**
 * Process Management for AutoForwardX
 * Handles starting, stopping, and monitoring Python components
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';

interface ProcessInfo {
  pid: number;
  name: string;
  command: string;
  status: 'running' | 'stopped' | 'error';
  startTime: number;
  lastCheck: number;
  restartCount: number;
}

interface ProcessMap {
  [key: string]: ProcessInfo;
}

class ProcessManager {
  private processes: Map<string, ChildProcess> = new Map();
  private processInfo: ProcessMap = {};
  private processMapFile = join(process.cwd(), 'process_map.json');

  constructor() {
    this.loadProcessMap();
  }

  private async loadProcessMap(): Promise<void> {
    try {
      const data = await fs.readFile(this.processMapFile, 'utf-8');
      this.processInfo = JSON.parse(data);
    } catch (error) {
      // File doesn't exist or invalid JSON, start with empty map
      this.processInfo = {};
    }
  }

  private async saveProcessMap(): Promise<void> {
    try {
      await fs.writeFile(this.processMapFile, JSON.stringify(this.processInfo, null, 2));
    } catch (error) {
      console.error('Failed to save process map:', error);
    }
  }

  private getComponentCommand(component: string): string[] {
    const commands: Record<string, string[]> = {
      'userbot': ['python3', 'telegram_reader/main.py'],
      'poster': ['python3', 'telegram_poster_enhanced.py'],
      'discord_bot': ['python3', 'discord_bot.py'],
      'copier': ['python3', 'telegram_copier/copier_multi_session.py'],
      'admin_bot': ['python3', 'telegram_admin_bot.py']
    };

    return commands[component] || [];
  }

  async startComponent(component: string): Promise<{ success: boolean; pid?: number; message: string }> {
    try {
      // Check if component is already running
      if (this.processes.has(component)) {
        const existing = this.processes.get(component);
        if (existing && !existing.killed) {
          return {
            success: false,
            message: `Component ${component} is already running with PID ${existing.pid}`
          };
        }
      }

      const command = this.getComponentCommand(component);
      if (command.length === 0) {
        return {
          success: false,
          message: `Unknown component: ${component}`
        };
      }

      const [cmd, ...args] = command;
      const child = spawn(cmd, args, {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      if (!child.pid) {
        return {
          success: false,
          message: `Failed to start ${component}: No PID assigned`
        };
      }

      // Store process reference
      this.processes.set(component, child);

      // Update process info
      this.processInfo[component] = {
        pid: child.pid,
        name: component,
        command: command.join(' '),
        status: 'running',
        startTime: Date.now(),
        lastCheck: Date.now(),
        restartCount: (this.processInfo[component]?.restartCount || 0) + 1
      };

      // Set up event handlers
      child.on('exit', (code, signal) => {
        console.log(`Component ${component} exited with code ${code}, signal ${signal}`);
        this.processes.delete(component);
        if (this.processInfo[component]) {
          this.processInfo[component].status = code === 0 ? 'stopped' : 'error';
        }
        this.saveProcessMap();
      });

      child.on('error', (error) => {
        console.error(`Component ${component} error:`, error);
        this.processes.delete(component);
        if (this.processInfo[component]) {
          this.processInfo[component].status = 'error';
        }
        this.saveProcessMap();
      });

      // Capture logs
      child.stdout?.on('data', (data) => {
        console.log(`[${component}] ${data.toString().trim()}`);
      });

      child.stderr?.on('data', (data) => {
        console.error(`[${component}] ${data.toString().trim()}`);
      });

      await this.saveProcessMap();

      return {
        success: true,
        pid: child.pid,
        message: `Component ${component} started successfully with PID ${child.pid}`
      };

    } catch (error) {
      console.error(`Error starting ${component}:`, error);
      return {
        success: false,
        message: `Failed to start ${component}: ${error}`
      };
    }
  }

  async stopComponent(component: string): Promise<{ success: boolean; message: string }> {
    try {
      const process = this.processes.get(component);
      
      if (!process) {
        // Check if we have process info but no active process
        if (this.processInfo[component]) {
          this.processInfo[component].status = 'stopped';
          await this.saveProcessMap();
        }
        return {
          success: false,
          message: `Component ${component} is not running`
        };
      }

      // Try graceful shutdown first
      process.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          // Force kill if graceful shutdown takes too long
          if (!process.killed) {
            process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        process.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.processes.delete(component);
      
      if (this.processInfo[component]) {
        this.processInfo[component].status = 'stopped';
      }
      
      await this.saveProcessMap();

      return {
        success: true,
        message: `Component ${component} stopped successfully`
      };

    } catch (error) {
      console.error(`Error stopping ${component}:`, error);
      return {
        success: false,
        message: `Failed to stop ${component}: ${error}`
      };
    }
  }

  async getComponentStatus(component: string): Promise<{
    success: boolean;
    status?: ProcessInfo;
    message: string;
  }> {
    try {
      const processRef = this.processes.get(component);
      const processInfo = this.processInfo[component];

      if (!processInfo) {
        return {
          success: true,
          status: {
            pid: 0,
            name: component,
            command: '',
            status: 'stopped',
            startTime: 0,
            lastCheck: Date.now(),
            restartCount: 0
          },
          message: `No status information for ${component}`
        };
      }

      // Update last check time
      processInfo.lastCheck = Date.now();

      // Verify process is still running
      if (processRef && !processRef.killed) {
        processInfo.status = 'running';
      } else if (processInfo.status === 'running') {
        processInfo.status = 'stopped';
      }

      await this.saveProcessMap();

      return {
        success: true,
        status: processInfo,
        message: `Status retrieved for ${component}`
      };

    } catch (error) {
      console.error(`Error getting status for ${component}:`, error);
      return {
        success: false,
        message: `Failed to get status for ${component}: ${error}`
      };
    }
  }

  async getAllStatuses(): Promise<ProcessMap> {
    // Update all statuses
    for (const component of Object.keys(this.processInfo)) {
      await this.getComponentStatus(component);
    }
    return this.processInfo;
  }

  async restartComponent(component: string): Promise<{ success: boolean; pid?: number; message: string }> {
    // Stop first
    await this.stopComponent(component);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start again
    return this.startComponent(component);
  }
}

export const processManager = new ProcessManager();