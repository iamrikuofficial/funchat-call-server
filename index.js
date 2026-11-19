
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

// Send incoming call notification
app.post("/send-incoming-call", async (req, res) => {
  try {
    const {
      callId,
      callerUid,
      callerName,
      callType,
      receiverUid
    } = req.body;

    if (!callId || !callerUid || !receiverUid) {
      return res.status(400).json({
        error: "Missing call details"
      });
    }

    const snapshot = await db
      .ref("userFcmTokens/" + receiverUid)
      .once("value");

    const tokenData = snapshot.val();
    const token = tokenData ? tokenData.token : null;

    if (!token) {
      return res.status(404).json({
        error: "Receiver FCM token not found"
      });
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

    // Save receiver details so we can notify them when the call ends.
    await db.ref("activeCalls/" + callId).set({
      receiverUid: String(receiverUid)
    });

    res.json({
      success: true,
      messageId: messageId
    });

  } catch (error) {
    console.error("Incoming call error:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

// Notify receiver when caller ends the call
app.post("/send-call-ended", async (req, res) => {
  try {
    const { callId } = req.body;

    if (!callId) {
      return res.status(400).json({
        error: "Missing callId"
      });
    }

    const callSnapshot = await db
      .ref("activeCalls/" + callId)
      .once("value");

    const callData = callSnapshot.val();

    if (!callData || !callData.receiverUid) {
      return res.status(404).json({
        error: "Active call or receiver not found"
      });
    }

    const receiverUid = callData.receiverUid;

    const tokenSnapshot = await db
      .ref("userFcmTokens/" + receiverUid)
      .once("value");

    const tokenData = tokenSnapshot.val();
    const token = tokenData ? tokenData.token : null;

    if (!token) {
      return res.status(404).json({
        error: "Receiver FCM token not found"
      });
    }

    const message = {
      token: token,
      data: {
        type: "call_ended",
        callId: String(callId)
      },
      android: {
        priority: "high"
      }
    };

    const messageId = await admin.messaging().send(message);

    await db.ref("activeCalls/" + callId).remove();

    res.json({
      success: true,
      messageId: messageId
    });

  } catch (error) {
    console.error("Call ended notification error:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FunChat Call Server running on port " + PORT);
});
