const express = require("express");
const Razorpay = require("razorpay");
const bodyParser = require("body-parser");
const cors = require("cors");
const crypto = require("crypto");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔐 FIREBASE ADMIN SETUP
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🔐 RAZORPAY SETUP
const razorpay = new Razorpay({
  key_id: process.env.KEY_ID || "rzp_test_SB9zOunZP02yLl",
  key_secret: process.env.KEY_SECRET || "Twl9Rtkdy9wIlI2s4qA6awaz"
});

// ✅ HEALTH CHECK
app.get("/", (req, res) => {
  res.send("Razorpay Backend Running ✅");
});

// 🔥 CREATE ORDER
app.post("/create-order", async (req, res) => {
  try {
    const { amount, courseId } = req.body;

    const options = {
      amount: amount * 100, // ✅ convert to paise
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

// 🔥 VERIFY PAYMENT + UPDATE FIRESTORE
app.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
      courseId
    } = req.body;

    // 🔐 SIGNATURE VERIFICATION
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.KEY_SECRET || "Twl9Rtkdy9wIlI2s4qA6awaz")
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ status: "failure" });
    }

    // 🔥 UPDATE FIRESTORE (SECURE)
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

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
