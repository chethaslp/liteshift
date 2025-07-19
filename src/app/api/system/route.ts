import { NextResponse } from 'next/server';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
    try {
        // CPU information
        const loadAvg = os.loadavg();
        const cpuInfo = {
            loadAvg1min: Math.round(loadAvg[0] * 100) / 100,
            loadAvg5min: Math.round(loadAvg[1] * 100) / 100,
            loadAvg15min: Math.round(loadAvg[2] * 100) / 100,
            cores: os.cpus().length,
            formatted: `${loadAvg[0].toFixed(2)} / ${loadAvg[1].toFixed(2)} / ${loadAvg[2].toFixed(2)}`,
            usagePercentage: (loadAvg[0] / os.cpus().length * 100).toFixed(2)
        };

        // Memory information
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const total = formatBytes(totalMemory);
        const used = formatBytes(totalMemory - freeMemory);
        const memoryInfo = {
            total,
            used,
            formatted: `${used.value} / ${total.value} ${total.unit}`,
            usedPercentage: (((totalMemory - freeMemory) / totalMemory) * 100).toFixed(2),
        };

        // Disk information
        const diskInfo = await getDiskInfo();

        // System uptime
        const uptime =  os.uptime();

        const caddyStatus = await getCaddyStatus();

        return NextResponse.json({
            cpu: cpuInfo,
            memory: memoryInfo,
            disk: diskInfo,
            uptime: uptime,
            caddyStatus,
            timestamp: new Date(),
        });
    } catch (error) {
        console.error('Error fetching system analytics:', error);
        return NextResponse.json(
            { error: 'Failed to fetch system analytics' },
            { status: 500 }
        );
    }
}

// Helper functions

async function getDiskInfo() {
    try {
        if (process.platform === 'win32') {
            const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption');
            const lines = stdout.trim().split('\n').slice(1);
            
            let totalSize = 0;
            let totalFreeSpace = 0;
            
            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 3) {
                    const freeSpace = parseInt(parts[1]) || 0;
                    const size = parseInt(parts[2]) || 0;
                    totalFreeSpace += freeSpace;
                    totalSize += size;
                }
            });
            
            const total = formatBytes(totalSize);
            const used = formatBytes(totalSize - totalFreeSpace);

            return {
                total,
                used,
                formatted: `${used.value} / ${total.value} ${total.unit}`,
                usedPercentage: (((totalSize - totalFreeSpace) / totalSize) * 100).toFixed(2) || 0,
            };
        } else {
            const { stdout } = await execAsync('df -k');
            const lines = stdout.trim().split('\n').slice(1);
            
            let totalSize = 0;
            let totalUsed = 0;
            
            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 6) {
                    totalSize += parseInt(parts[1]) * 1024 || 0;
                    totalUsed += parseInt(parts[2]) * 1024 || 0;
                }
            });
            
            const total = formatBytes(totalSize);
            const used = formatBytes(totalUsed);
            return {
                total,
                used,
                formatted: `${used.value} ${used.unit} / ${total.value} ${total.unit}`,
                usedPercentage: ((totalUsed / totalSize) * 100).toFixed(2) || 0,
            };
        }
    } catch (error) {
        console.error('Error getting disk info:', error);
        return {
            total: formatBytes(0),
            free: formatBytes(0),
            used: formatBytes(0),
            usedPercentage: 0,
        };
    }
}

function getCaddyStatus() {
    // check if Caddy is running
    return new Promise((resolve) => {
        exec('systemctl is-active caddy', (error, stdout) => {
            if (error) {
                resolve('inactive');
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

function formatBytes(bytes: number) {
    if (bytes === 0) return { value: 0, unit: 'B', raw: 0 };
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return {
        value: parseFloat((bytes / Math.pow(k, i)).toFixed(2)),
        unit: sizes[i],
        raw: bytes
    };
}
