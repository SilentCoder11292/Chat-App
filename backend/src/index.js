import express from "express";
import "dotenv/config"
import connectDb from "./lib/db.js";
import { clerkMiddleware } from '@clerk/express';
import cors from "cors";
import job from "./lib/cron.js";
import clerkWebhook from "./webhooks/clerk.webhook.js";
import fs from "fs";
import authRoutes from "./routes/auth.route.js"
import messageRoutes from "./routes/message.route.js"
import path from "path";
import { app, server } from "./lib/socket.js";

const PORT = process.env.PORT;
const FRONTEND_URL = process.env.FRONTEND_URL;

const publicDir = path.join(process.cwd(), 'public');


//this will help to parse the raw data coming from webhook by clerk
app.use("/api/webhooks/clerk", express.raw({ type: "application/json" }), clerkWebhook)

app.use(clerkMiddleware());
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

app.use("/api/auth", authRoutes)
app.use("/api/messages", messageRoutes)


app.get("/health", (req, res) => {
    res.status(200).json({ ok: true })

})

if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));

    app.get("/{*any}", (req, res, next) => {
        res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
    });



}

server.listen(PORT, () => {
    connectDb();
    console.log(`Server is up and running on port ${PORT}`)

    if (process.env.NODE_ENV === "production") {
        job.start();
    }

});





