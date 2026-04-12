const express = require("express");
const Razorpay = require("razorpay");
const bodyParser = require("body-parser");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔴 RAZORPAY TEST KEYS
const razorpay = new Razorpay({
    key_id: "rzp_test_SB9zOunZP02yLl",
    key_secret: "Twl9Rtkdy9wIlI2s4qA6awaz"
});

// Health check
app.get("/", (req, res) => res.send("Razorpay Backend Running ✅"));

// CREATE ORDER
app.post("/create-order", async (req, res) => {
    try {
        const amount = req.body.amount;
        const courseId = req.body.courseId;

        const options = {
            amount: amount,
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

// VERIFY PAYMENT
app.post("/verify-payment", (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", razorpay.key_secret)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature === razorpay_signature) {
            res.json({ status: "success" });
        } else {
            res.status(400).json({ status: "failure" });
        }

    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ error: "Verification failed" });
    }
});

app.listen(3000, () => console.log("Server running on port 3000"));
