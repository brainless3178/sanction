import fs from 'fs';
import path from 'path';
import os from 'os';
import { Keypair } from '@solana/web3.js';

export interface CliConfig {
    rpcUrl: string;
    keypairPath: string;
    mintAddress?: string;
    preset?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.sss-token');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function loadConfig(): CliConfig {
    if (!fs.existsSync(CONFIG_FILE)) {
        return {
            rpcUrl: 'http://127.0.0.1:8899',
            keypairPath: path.join(os.homedir(), '.config', 'solana', 'id.json'),
        };
    }
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
}

export function saveConfig(config: CliConfig) {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getKeypair(config: CliConfig): Keypair {
    const keyData = fs.readFileSync(path.resolve(config.keypairPath), 'utf-8');
    const secretKey = Uint8Array.from(JSON.parse(keyData));
    return Keypair.fromSecretKey(secretKey);
}
