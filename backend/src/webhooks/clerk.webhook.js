import express from "express";
import User from "../models/user.model.js";
import { verifyWebhook } from "@clerk/backend/webhooks";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    if (!signingSecret) {
      console.error("Clerk Webhook Error: Webhook secret is not provided in environment variables");
      res.status(503).json({ message: "Webhook secret is not provided" });
      return;
    }

    // clerk's verifier expects a Web Request with the raw body; express.raw gives a Buffer.
    const payload = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body);

    console.log("Incoming Webhook Details:");
    console.log("- Is Body Buffer:", Buffer.isBuffer(req.body));
    console.log("- Payload Length:", payload ? payload.length : 0);
    console.log("- svix-id:", req.headers["svix-id"]);
    console.log("- svix-timestamp:", req.headers["svix-timestamp"]);
    console.log("- svix-signature:", req.headers["svix-signature"]);

    // Only forward required headers to prevent Fetch API header issues (like content-length/encoding mismatches)
    const svixHeaders = {
      "svix-id": req.headers["svix-id"] || "",
      "svix-timestamp": req.headers["svix-timestamp"] || "",
      "svix-signature": req.headers["svix-signature"] || "",
    };

    const request = new Request("http://internal/webhooks/clerk", {
      method: "POST",
      headers: new Headers(svixHeaders),
      body: payload,
    });

    // throws if the signature is wrong or the body was tampered with; only then do we trust evt.
    const evt = await verifyWebhook(request, { signingSecret });

    if (evt.type === "user.created" || evt.type === "user.updated") {
      const u = evt.data;

      if (!u || !u.id) {
        console.error("Clerk Webhook Error: Missing user data or user ID", u);
        res.status(400).json({ message: "Invalid user data in webhook payload" });
        return;
      }

      console.log(`Processing Clerk webhook: ${evt.type} for clerkId: ${u.id}`);

      const email =
        u.email_addresses?.find((e) => e.id === u.primary_email_address_id)?.email_address ??
        u.email_addresses?.[0]?.email_address;

      const fullName =
        [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || email?.split("@")[0];

      await User.findOneAndUpdate(
        { clerkId: u.id },
        { clerkId: u.id, email, fullName, profilePic: u.image_url },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      console.log(`Successfully synced clerk user: ${u.id}`);
    }

    if (evt.type === "user.deleted") {
      if (evt.data.id) {
        await User.findOneAndDelete({ clerkId: evt.data.id });
        console.log(`Successfully deleted clerk user: ${evt.data.id}`);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error in Clerk webhook verification:", error);
    res.status(400).json({ message: "Webhook verification failed", error: error.message });
  }
});

export default router;