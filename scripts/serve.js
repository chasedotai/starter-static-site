const http = require('http');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '../public');

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
};

// Create server handler
const requestHandler = (req, res) => {
    let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
    
    // Ensure the path is within the public directory
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
};

// Function to find an available port
const findAvailablePort = (startPort, maxTries = 10) => {
    return new Promise((resolve, reject) => {
        let currentPort = startPort;
        let tries = 0;

        const tryPort = () => {
            const server = http.createServer();

            server.once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    if (tries >= maxTries) {
                        reject(new Error(`Could not find an available port after ${maxTries} attempts`));
                        return;
                    }
                    tries++;
                    currentPort++;
                    tryPort();
                } else {
                    reject(err);
                }
            });

            server.once('listening', () => {
                server.close(() => resolve(currentPort));
            });

            server.listen(currentPort);
        };

        tryPort();
    });
};

// Start the server
async function startServer() {
    try {
        const port = await findAvailablePort(3000);
        const server = http.createServer(requestHandler);
        
        server.listen(port, () => {
            console.log(`Server running at http://localhost:${port}/`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

startServer(); 