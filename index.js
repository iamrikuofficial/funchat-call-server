const express = require("express");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    "https://funchat-a1250-default-rtdb.asia-southeast1.firebasedatabase.app/"
});

const db = admin.database();

app.get("/", (req, res) => {
  res.send("FunChat Call Server is running");
});

app.post("/send-incoming-call", async (req, res) => {
  try {
    const { callId, callerUid, callerName, callType, receiverUid } = req.body;

    if (!callId || !callerUid || !receiverUid) {
      return res.status(400).json({ error: "Missing call details" });
    }

    const snapshot = await db.ref("userFcmTokens/" + receiverUid).once("value");
const tokenData = snapshot.val();
const token = tokenData ? tokenData.token : null;

    if (!token) {
      return res.status(404).json({ error: "Receiver FCM token not found" });
    }

    const message = {
      token: token,
      data: {
        type: "incoming_call",
        callId: String(callId),
        callerUid: String(callerUid),
        callerName: String(callerName || "FunChat User"),
        callType: String(callType || "voice")
      },
      android: {
        priority: "high"
      }
    };

    const messageId = await admin.messaging().send(message);

    res.json({
      success: true,
      messageId: messageId
    });

  } catch (error) {
    console.error("Incoming call error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FunChat Call Server running on port " + PORT);
});
