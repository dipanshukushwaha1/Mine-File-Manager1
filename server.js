
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = 3001;

const publicDir = path.join(__dirname, "public");
const filesDir = path.join(__dirname, "myfiles");

// Create storage directory if it does not exist
fs.mkdirSync(filesDir, { recursive: true });

const mimeTypes = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".txt": "text/plain"
};

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8"
    });
    res.end(JSON.stringify(data));
}

// Read JSON sent by frontend
function getBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk;

            if (body.length > 1_000_000) {
                reject(new Error("Request body too large"));
                req.destroy();
            }
        });

        req.on("end", () => {
            try {
                resolve(JSON.parse(body || "{}"));
            } catch {
                reject(new Error("Invalid JSON"));
            }
        });
        req.on("error", reject);
    });
}

// Validate filename to prevent directory traversal
function isValidFilename(filename) {
    return (
        typeof filename === "string" &&
        filename.length > 0 &&
        filename.length <= 100 &&
        filename !== "." &&
        filename !== ".." &&
        !/[<>:"/\\|?*\x00-\x1F]/.test(filename)
    );
}

async function handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // 1. CREATE FILE
    if (req.method === "POST" && pathname === "/api/files") {
        let body;

        try {
            body = await getBody(req);
        } catch (error) {
            return sendJSON(res, 400, {
                message: error.message === "Invalid JSON"
                    ? "Invalid JSON data."
                    : "Request body is too large or invalid."
            });
        }
        const { filename, content } = body;

        if (
            !isValidFilename(filename) ||
            typeof content !== "string"
        ) {
            return sendJSON(res, 400, {
                message: "Enter a valid filename and text content."
            });
        }
        try {
            await fs.promises.writeFile(
                path.join(filesDir, filename),
                content,
                { encoding: "utf8", flag: "wx" }
            );

            return sendJSON(res, 201, {
                message: "File created successfully!"
            });
        } catch (error) {
            if (error.code === "EEXIST") {
                return sendJSON(res, 409, {
                    message: "This filename already exists."
                });
            }

            return sendJSON(res, 500, {
                message: "Unable to create file."
            });
        }
    }

    // 2. SHOW ALL FILES
    if (req.method === "GET" && pathname === "/api/files") {
        try {
            const entries = await fs.promises.readdir(filesDir, {
                withFileTypes: true
            });

            const files = entries
                .filter(entry => entry.isFile())
                .map(entry => entry.name);

            return sendJSON(res, 200, { files });
        } catch {
            return sendJSON(res, 500, {
                message: "Unable to list files."
            });
        }
    }

    // 3. SYSTEM INFORMATION
    if (req.method === "GET" && pathname === "/api/system") {
        return sendJSON(res, 200, {
            operatingSystem: os.type(),
            platform: os.platform(),
            architecture: os.arch(),
            hostname: os.hostname(),
            totalMemoryGB: (os.totalmem() / 1024 ** 3).toFixed(2),
            freeMemoryGB: (os.freemem() / 1024 ** 3).toFixed(2),
            cpuCores: os.cpus().length,
            uptimeHours: (os.uptime() / 3600).toFixed(2)
        });
    }

    // Match a request for one specific file
    const match = pathname.match(/^\/api\/files\/([^/]+)$/);

    if (match) {
        let filename;

        try {
            filename = decodeURIComponent(match[1]);
        } catch {
            return sendJSON(res, 400, {
                message: "Invalid filename."
            });
        }

        if (!isValidFilename(filename)) {
            return sendJSON(res, 400, {
                message: "Invalid filename."
            });
        }

        const filePath = path.join(filesDir, filename);

        // 4. READ FILE
        if (req.method === "GET") {
            try {
                const content = await fs.promises.readFile(
                    filePath,
                    "utf8"
                );

                return sendJSON(res, 200, {
                    filename,
                    content
                });
            } catch (error) {
                return sendJSON(
                    res,
                    error.code === "ENOENT" ? 404 : 500,
                    {
                        message: error.code === "ENOENT"
                            ? "File not found."
                            : "Unable to read file."
                    }
                );
            }
        }

        // 5. DELETE FILE
        if (req.method === "DELETE") {
            try {
                await fs.promises.unlink(filePath);

                return sendJSON(res, 200, {
                    message: "File deleted successfully!"
                });
            } catch (error) {
                return sendJSON(
                    res,
                    error.code === "ENOENT" ? 404 : 500,
                    {
                        message: error.code === "ENOENT"
                            ? "File not found."
                            : "Unable to delete file."
                    }
                );
            }
        }
    }

    // 6. SERVE HTML, CSS AND FRONTEND JS
    if (req.method === "GET") {
        let relativePath;

        try {
            relativePath = decodeURIComponent(pathname);
        } catch {
            return sendJSON(res, 400, {
                message: "Invalid URL."
            });
        }

        if (relativePath === "/") {
            relativePath = "/index.html";
        }

        const filePath = path.resolve(
            publicDir,
            "." + relativePath
        );

        // Prevent accessing files outside the public folder
        if (!filePath.startsWith(publicDir + path.sep)) {
            return sendJSON(res, 403, {
                message: "Access denied."
            });
        }

        try {
            const data = await fs.promises.readFile(filePath);
            const extension = path.extname(filePath);
            const contentType =
                mimeTypes[extension] || "application/octet-stream";

            res.writeHead(200, {
                "Content-Type": `${contentType}; charset=utf-8`
            });

            return res.end(data);
        } catch {
            return sendJSON(res, 404, {
                message: "Page or resource not found."
            });
        }
    }

    return sendJSON(res, 404, {
        message: "Route not found."
    });
}

const server = http.createServer((req, res) => {
    handleRequest(req, res).catch(error => {
        console.error(error);

        if (!res.headersSent) {
            sendJSON(res, 500, {
                message: "Internal server error."
            });
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
