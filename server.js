const express = require("express");
const Razorpay = require("razorpay");
const bodyParser = require("body-parser");
const cors = require("cors");
const crypto = require("crypto");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(bodyParser.json());

/* =========================
   🔐 FIREBASE SETUP
========================= */

if (!process.env.FIREBASE_KEY) {
  throw new Error("FIREBASE_KEY missing in environment variables");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

// ✅ Fix private key formatting (IMPORTANT)
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

/* =========================
   💳 RAZORPAY SETUP
========================= */

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/* =========================
   ✅ HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.send("Razorpay Backend Running ✅");
});

/* =========================
   🔥 CREATE ORDER
========================= */

app.post("/create-order", async (req, res) => {
  try {
    const { amount, courseId } = req.body;

    const options = {
      amount: amount * 100, // convert to paise
      currency: "INR",
      receipt: "receipt_" + courseId + "_" + Date.now()
    };

    const order = await razorpay.orders.create(options);
    res.json(order);

  } catch (error) {
    console.error("Create Order Error:", error);
    res.status(500).json({ error: "Order creation failed" });
  }
});

/* =========================
   🔥 VERIFY PAYMENT
========================= */

app.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
      courseId
    } = req.body;

    // 🔐 Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ status: "failure" });
    }

    // 🔥 Update Firestore
    await db.collection("users")
      .doc(userId)
      .collection("courses")
      .doc(courseId)
      .set({
        paid: true,
        progress: 0,
        completed: false,
        certificate: false
      }, { merge: true });

    console.log(`✅ Payment verified & course unlocked for ${userId}`);

    res.json({ status: "success" });

  } catch (error) {
    console.error("Verification Error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});

/* =========================
   🚀 START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
