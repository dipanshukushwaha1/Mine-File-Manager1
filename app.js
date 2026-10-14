
const API = "/api";

// CREATE FILE
async function createFile() {
    const filename = document.getElementById("filename").value.trim();
    const content = document.getElementById("content").value;
    const message = document.getElementById("message");

    if (!filename) {
        message.textContent = "Please enter a filename.";
        return;
    }

    try {
        const response = await fetch(`${API}/files`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ filename, content })
        });

        const data = await response.json();
        message.textContent = data.message;

        if (response.ok) {
            document.getElementById("filename").value = "";
            document.getElementById("content").value = "";
            await getFiles();
        }
    } catch (error) {
        message.textContent = "Server connection failed.";
        console.error(error);
    }
}

// SHOW FILES
async function getFiles() {
    const fileList = document.getElementById("fileList");
    fileList.replaceChildren();

    try {
        const response = await fetch(`${API}/files`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to load files");
        }

        if (data.files.length === 0) {
            const li = document.createElement("li");
            li.textContent = "No files found.";
            fileList.appendChild(li);
            return;
        }

        data.files.forEach(filename => {
            const li = document.createElement("li");
            const name = document.createElement("span");
            name.textContent = filename + " ";

            const readButton = document.createElement("button");
            readButton.textContent = "Read";
            readButton.onclick = () => readFile(filename);

            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Delete";
            deleteButton.onclick = () => deleteFile(filename);

            li.append(name, readButton, deleteButton);
            fileList.appendChild(li);
        });
    } catch (error) {
        const li = document.createElement("li");
        li.textContent = "Unable to load files.";
        fileList.appendChild(li);
        console.error(error);
    }
}

// READ FILE
async function readFile(filename) {
    try {
        const response = await fetch(
            `${API}/files/${encodeURIComponent(filename)}`
        );
        const data = await response.json();

        if (!response.ok) {
            alert(data.message);
            return;
        }

        alert(`Filename: ${data.filename}\n\n${data.content}`);
    } catch (error) {
        alert("Unable to read the file.");
        console.error(error);
    }
}

// DELETE FILE
async function deleteFile(filename) {
    const confirmed = confirm(`Do you want to delete ${filename}?`);

    if (!confirmed) return;

    try {
        const response = await fetch(
            `${API}/files/${encodeURIComponent(filename)}`,
            { method: "DELETE" }
        );

        const data = await response.json();
        alert(data.message);

        if (response.ok) {
            await getFiles();
        }
    } catch (error) {
        alert("Unable to delete the file.");
        console.error(error);
    }
}

// SYSTEM INFORMATION
async function getSystemInfo() {
    const output = document.getElementById("systemInfo");

    try {
        const response = await fetch(`${API}/system`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Request failed");
        }

        output.textContent =
            `Operating System: ${data.operatingSystem}\n` +
            `Platform: ${data.platform}\n` +
            `Architecture: ${data.architecture}\n` +
            `Computer Name: ${data.hostname}\n` +
            `Total RAM: ${data.totalMemoryGB} GB\n` +
            `Free RAM: ${data.freeMemoryGB} GB\n` +
            `CPU Cores: ${data.cpuCores}\n` +
            `System Uptime: ${data.uptimeHours} hours`;
    } catch (error) {
        output.textContent = "Unable to get system information.";
        console.error(error);
    }
}
