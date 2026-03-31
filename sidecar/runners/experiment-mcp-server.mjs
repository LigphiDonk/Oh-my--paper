#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const NODES_CONFIG_PATH = path.join(os.homedir(), ".oh-my-paper", "compute-nodes.json");

// Helper to get active node
async function getActiveNode() {
  try {
    const data = await fs.readFile(NODES_CONFIG_PATH, "utf-8");
    const json = JSON.parse(data);
    if (!json.activeNodeId) {
      throw new Error("No activeNodeId defined in compute-nodes.json");
    }
    
    // Support nodes as array or object dict
    const nodesArray = Array.isArray(json.nodes) ? json.nodes : Object.values(json.nodes || {});
    const node = nodesArray.find(n => n.id === json.activeNodeId);
    
    if (!node) {
      throw new Error(`Active node ${json.activeNodeId} not found in nodes list.`);
    }
    return node;
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error("compute-nodes.json not found. Please configure a compute node first.");
    }
    throw err;
  }
}

const EXEC_TIMEOUT_MS = 300000; // 5 mins

// Helper to ensure sshpass is installed
async function ensureSshpass() {
  try {
    await execAsync("which sshpass");
  } catch {
    throw new Error("sshpass is not installed on the local system. Password authentication requires sshpass. Please install it (e.g. 'brew install sshpass' or 'apt-get install sshpass') or use SSH key authentication.");
  }
}

// Security: Constrain path to project root if provided
function validateLocalPath(targetPath) {
  const projectRoot = process.env.TARGET_PROJECT_ROOT;
  if (!projectRoot) return targetPath;
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(projectRoot);
  if (resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    return targetPath;
  }
  throw new Error(`Security Violation: Target local path ${targetPath} is completely outside of the project root ${projectRoot}`);
}

// Build SSH base commands
function buildSshCommand(node, commandContext) {
  let baseCmd = `ssh -p ${node.port || 22} `;
  let sshOptions = `-o StrictHostKeyChecking=accept-new `;
  
  if (node.authMethod === "key" && node.keyPath) {
    const keyPath = node.keyPath.startsWith('~') ? node.keyPath.replace('~', os.homedir()) : node.keyPath;
    baseCmd += `-i "${keyPath}" `;
    sshOptions += `-o BatchMode=yes `;
  } else if (node.password) {
    baseCmd = `sshpass -p "${node.password}" ` + baseCmd;
  }
  
  baseCmd += sshOptions;
  baseCmd += `"${node.user}@${node.host}" `;
  
  // Escape the command context properly for remote shell execution
  return baseCmd + `'${commandContext.replace(/'/g, "'\\''")}'`;
}

class ExperimentServer {
  server;

  constructor() {
    this.server = new Server(
      {
        name: "oh-my-paper-experiment-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling to stderr so we don't pollute stdout (which MCP uses)
    this.server.onerror = (error) => console.error("[MCP Error]", error);
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "compute_describe_active_node",
          description: "Get the configuration of the currently active remote compute node.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "compute_sync_up",
          description: "Sync the current project directory to the active remote node's working directory. Excludes .git, node_modules, and __pycache__.",
          inputSchema: {
            type: "object",
            properties: {
              projectName: {
                type: "string",
                description: "The name of the project folder on the remote. Typically the current local directory name."
              },
              localPath: {
                type: "string",
                description: "Local absolute path to sync from. Defaults to current directory."
              }
            },
            required: ["projectName"]
          }
        },
        {
          name: "compute_run",
          description: "Run a foreground command on the active remote compute node.",
          inputSchema: {
            type: "object",
            properties: {
              projectName: {
                type: "string",
                description: "Project folder name on the remote to cd into before running the command."
              },
              command: {
                type: "string",
                description: "The shell command to execute remotely."
              }
            },
            required: ["projectName", "command"]
          }
        },
        {
          name: "compute_fetch_results",
          description: "Fetch explicit result files or folders from the active remote compute node to the local machine.",
          inputSchema: {
            type: "object",
            properties: {
              projectName: {
                type: "string",
                description: "Project folder name on the remote."
              },
              remoteResultPath: {
                type: "string",
                description: "Relative path (from the remote project dir) of the result file or directory to fetch."
              },
              localDestination: {
                type: "string",
                description: "Absolute local path where the result should be saved."
              }
            },
            required: ["projectName", "remoteResultPath", "localDestination"]
          }
        },
        {
          name: "compute_read_remote_file",
          description: "Read the contents of a specific file from the active remote compute node.",
          inputSchema: {
            type: "object",
            properties: {
              remoteFilePath: {
                type: "string",
                description: "Absolute or relative path (if relative, from home) of the remote file."
              }
            },
            required: ["remoteFilePath"]
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case "compute_describe_active_node": {
          try {
            const node = await getActiveNode();
            const temp = { ...node };
            delete temp.password;
            delete temp.keyPath;
            return {
              content: [{
                type: "text",
                text: JSON.stringify(temp, null, 2)
              }]
            };
          } catch (err) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
          }
        }
        
        case "compute_sync_up": {
          const { projectName, localPath = process.cwd() } = request.params.arguments;
          try {
            validateLocalPath(localPath);
            const node = await getActiveNode();
            if (node.password) await ensureSshpass();
            
            const remoteBaseDir = (node.workDir || "~").replace(/\/$/, ""); // trim trailing slash
            const targetPath = `${remoteBaseDir}/${projectName}`;
            
            // First ensure target directory exists
            const mkdirCmd = buildSshCommand(node, `mkdir -p "${targetPath}"`);
            await execAsync(mkdirCmd, { timeout: EXEC_TIMEOUT_MS });

            // Build rsync command
            let rsyncAuthCmd = `ssh -p ${node.port || 22}`;
            let rsyncOptions = ` -o StrictHostKeyChecking=accept-new`;
            if (node.authMethod === "key" && node.keyPath) {
               const keyPath = node.keyPath.startsWith('~') ? node.keyPath.replace('~', os.homedir()) : node.keyPath;
               rsyncAuthCmd += ` -i "${keyPath}"`;
               rsyncOptions += ` -o BatchMode=yes`;
            } else if (node.password) {
               rsyncAuthCmd = `sshpass -p "${node.password}" ` + rsyncAuthCmd;
            }
            rsyncAuthCmd += rsyncOptions;

            // Make sure local path ends with slash for rsync contents
            const syncSource = localPath.endsWith('/') ? localPath : `${localPath}/`;
            
            // Exclude common cache and dist directories
            const rsyncCmd = `rsync -avz --exclude '.git' --exclude 'node_modules' --exclude '__pycache__' --exclude '.oh-my-paper' -e '${rsyncAuthCmd}' "${syncSource}" "${node.user}@${node.host}:${targetPath}"`;
            
            const { stdout, stderr } = await execAsync(rsyncCmd, { timeout: EXEC_TIMEOUT_MS });
            return {
              content: [{ type: "text", text: `Sync successful.\nStdout: ${stdout}\nStderr: ${stderr}` }]
            };
          } catch (err) {
            return { content: [{ type: "text", text: `Sync failed: ${err.message}\nStderr: ${err.stderr || ''}` }], isError: true };
          }
        }

        case "compute_run": {
          const { projectName, command } = request.params.arguments;
          try {
             const node = await getActiveNode();
             if (node.password) await ensureSshpass();
             
             const remoteBaseDir = (node.workDir || "~").replace(/\/$/, "");
             const scriptCode = `cd "${remoteBaseDir}/${projectName}" && ${command}`;
             const sshCmd = buildSshCommand(node, scriptCode);
             
             const { stdout, stderr } = await execAsync(sshCmd, { timeout: EXEC_TIMEOUT_MS });
             return {
               content: [{ type: "text", text: `Command completed.\nStdout:\n${stdout}\nStderr:\n${stderr}` }]
             };
          } catch (err) {
             return { content: [{ type: "text", text: `Command failed: ${err.message}\nStderr: ${err.stderr || ''}\nStdout: ${err.stdout || ''}` }], isError: true };
          }
        }
        
        case "compute_fetch_results": {
           const { projectName, remoteResultPath, localDestination } = request.params.arguments;
           try {
             validateLocalPath(localDestination);
             const node = await getActiveNode();
             if (node.password) await ensureSshpass();
             
             const remoteBaseDir = (node.workDir || "~").replace(/\/$/, "");
             const remoteFullPath = `${remoteBaseDir}/${projectName}/${remoteResultPath}`;
             
             // Ensure local destination parent dir exists
             await fs.mkdir(path.dirname(localDestination), { recursive: true });

             let scpCmd = `scp -P ${node.port || 22} -r `;
             let scpOptions = `-o StrictHostKeyChecking=accept-new `;
             if (node.authMethod === "key" && node.keyPath) {
                 const keyPath = node.keyPath.startsWith('~') ? node.keyPath.replace('~', os.homedir()) : node.keyPath;
                 scpCmd += `-i "${keyPath}" `;
                 scpOptions += `-o BatchMode=yes `;
             } else if (node.password) {
                 scpCmd = `sshpass -p "${node.password}" ` + scpCmd;
             }
             scpCmd += `${scpOptions}"${node.user}@${node.host}:${remoteFullPath}" "${localDestination}"`;
             
             const { stdout, stderr } = await execAsync(scpCmd, { timeout: EXEC_TIMEOUT_MS });
             return {
               content: [{ type: "text", text: `Fetch successful to ${localDestination}.\nStdout: ${stdout}\nStderr: ${stderr}` }]
             };
           } catch (err) {
             return { content: [{ type: "text", text: `Fetch failed: ${err.message}\nStderr: ${err.stderr || ''}` }], isError: true };
           }
        }
        
        case "compute_read_remote_file": {
          const { remoteFilePath } = request.params.arguments;
          try {
             const node = await getActiveNode();
             if (node.password) await ensureSshpass();
             
             const sshCmd = buildSshCommand(node, `cat "${remoteFilePath}"`);
             const { stdout, stderr } = await execAsync(sshCmd, { timeout: EXEC_TIMEOUT_MS });
             return {
               content: [{ type: "text", text: stdout || stderr }]
             };
          } catch (err) {
             return { content: [{ type: "text", text: `Failed reading remote file: ${err.message}\nStderr: ${err.stderr || ''}\nStdout: ${err.stdout || ''}` }], isError: true };
          }
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Experiment MCP server running on stdio");
  }
}

const server = new ExperimentServer();
server.run().catch(console.error);
