const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ✅ BODY PARSER
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ STATIC FILES
app.use(express.static("public"));

// 🔒 SECURED UPLOAD ACCESS
app.use("/uploads", express.static("uploads", {
    dotfiles: "deny",
    index: false,
    setHeaders: (res, filePath) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "private, no-store");
    }
}));

// 📁 CREATE uploads FOLDER IF NOT EXIST
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

let tickets = [];
let counter = 1;

// 📎 MULTER STORAGE
const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },

    filename: (req, file, cb) => {

        const safeName =
            Date.now() +
            "-" +
            file.originalname.replace(/\s+/g, "_");

        cb(null, safeName);
    }
});

const upload = multer({ storage });

// 📡 SOCKET CONNECTION
io.on("connection", (socket) => {

    console.log("✅ USER CONNECTED");

    // 📤 SEND CURRENT TICKETS
    socket.emit("update", tickets);

    // 🆕 SOCKET CREATE TICKET
    socket.on("new-ticket", (data) => {

        const now = new Date();

        const ticket = {

            id: Date.now(),

            ticketNo:
                "IT-" +
                String(counter).padStart(4, "0"),

            seat: data.seat,

            issue: data.issue,

            userMessage: data.userMessage,

            priority: data.priority,

            file: data.file || null,

            date: now.toLocaleDateString(),

            time: now.toLocaleTimeString(),

            createdAt: Date.now(),

            status: "Waiting"
        };

        counter++;

        tickets.push(ticket);

        io.emit("update", tickets);
    });

    // ✅ RESOLVE TICKET
    socket.on("resolve", (id) => {

        console.log("RESOLVE:", id);

        tickets = tickets.map(t => {

            if (t.id == id) {

                t.status = "Resolved";
            }

            return t;
        });

        io.emit("update", tickets);
    });

    // 🗑 DELETE TICKET
    socket.on("delete-ticket", (id) => {

        console.log("DELETE REQUEST:", id);

        // find ticket
        const ticket =
            tickets.find(t => t.id == id);

        // delete uploaded file
        if (ticket && ticket.file) {

            const filePath =
                path.join(__dirname, ticket.file);

            fs.unlink(filePath, (err) => {

                if (err) {

                    console.log(
                        "FILE DELETE ERROR:",
                        err.message
                    );
                }
            });
        }

        // remove ticket
        tickets = tickets.filter(
            t => t.id != id
        );

        io.emit("update", tickets);
    });
});

// 📤 HTTP FILE + TICKET UPLOAD
app.post(
    "/upload",
    upload.single("file"),
    (req, res) => {

        const fileUrl =
            req.file
            ? `/uploads/${req.file.filename}`
            : null;

        const now = new Date();

        const ticket = {

            id: Date.now(),

            ticketNo:
                "IT-" +
                String(counter).padStart(4, "0"),

            seat: req.body.seat,

            issue: req.body.issue,

            userMessage: req.body.userMessage,

            priority: req.body.priority,

            file: fileUrl,

            date: now.toLocaleDateString(),

            time: now.toLocaleTimeString(),

            createdAt: Date.now(),

            status: "Waiting"
        };

        counter++;

        tickets.push(ticket);

        io.emit("update", tickets);

        res.json({
            success: true
        });
    }
);

// 🚫 BLOCK DIRECT FILE DELETE
app.delete("/uploads/:file", (req, res) => {

    return res.status(403).json({
        error:
            "Direct file deletion is disabled."
    });
});

// 🚀 START SERVER
server.listen(3001, "0.0.0.0", () => {

    console.log(
        "✅ IT HELPDESK RUNNING ON PORT 3001"
    );
});