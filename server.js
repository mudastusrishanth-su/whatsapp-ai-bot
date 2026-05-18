require("dotenv").config();

const express = require("express");
const Groq = require("groq-sdk");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const userStates = {};
const escalationData = {};
const sessions = {};
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/*
====================================
MEMORY STORAGE
====================================
*/

const sessions = {};
const userSessions = {};
const escalationData = {};

/*
====================================
SEND WHATSAPP MESSAGE
====================================
*/

async function sendMessage(to, message) {

  const response = await fetch(
    `https://graph.facebook.com/v25.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        Authorization:
          `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },

      body: JSON.stringify({
        messaging_product: "whatsapp",

        to: to,

        text: {
          body: message,
        },
      }),
    }
  );

  const data = await response.json();

  console.log(data);
}

/*
====================================
HOME ROUTE
====================================
*/

app.get("/", (req, res) => {

  res.send("Blackbucks AI Bot Running 🚀");
});

/*
====================================
WEBHOOK VERIFY
====================================
*/

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === process.env.VERIFY_TOKEN) {
    console.log("Webhook Verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});
function resetUser(from) {

  delete userStates[from];

  delete escalationData[from];

  delete sessions[from];
}
app.post("/webhook", async (req, res) => {
  try {

    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message || message.from_me) {
      return res.sendStatus(200);
    }

    const from = message.from;

    /*
    ====================================
    IMAGE HANDLING
    ====================================
    */

    if (message.type === "image") {

      if (userStates[from] === "waiting_for_screenshot") {

        await handleScreenshotEscalation(
          from,
          message.image.id
        );
      }

      return res.sendStatus(200);
    }

    /*
    ====================================
    ONLY TEXT
    ====================================
    */

    if (message.type !== "text") {
      return res.sendStatus(200);
    }

    const text =
      message.text.body.toLowerCase().trim();

    console.log("Student:", text);

    /*
    ====================================
    RESET CHAT
    ====================================
    */

    if (
      text === "reset" ||
      text === "restart"
    ) {

      resetUser(from);

      await sendMessage(
        from,

`✅ Your chat session has been reset.

Send Hi to start again 😊`
      );

      return res.sendStatus(200);
    }

    /*
    ====================================
    GREETING
    ====================================
    */

    if (isGreeting(text)) {

      userStates[from] =
        "waiting_for_query";

      await sendMessage(
        from,

`👋 Hi! I'm the Blackbucks AI Support Assistant 😊

Please tell me your issue or question and I’ll help you.`
      );

      return res.sendStatus(200);
    }

    /*
    ====================================
    CREATE SESSION
    ====================================
    */

    if (!sessions[from]) {
      sessions[from] = [];
    }

    /*
    ====================================
    STORE USER MESSAGE
    ====================================
    */

    rememberMessage(
      from,
      "user",
      text
    );

    /*
    ====================================
    CONTEXTUAL QUICK HANDLING
    ====================================
    */

    /*
    RESOURCE / MATERIAL ISSUE
    */

    if (
      text.includes("resource") ||
      text.includes("materials") ||
      text.includes("cannot find") ||
      text.includes("can't find") ||
      text.includes("no resources")
    ) {

      const reply =
`📚 Please check your lesson plan inside TapTap LMS 😊

All resources including:
• recorded sessions
• assignments
• assessments
• activities
• study materials

will be available there.

If you still cannot access them, please share:
• your domain
• registered email ID
• screenshot of the issue`;

      rememberMessage(
        from,
        "assistant",
        reply
      );

      await sendMessage(
        from,
        reply
      );

      return res.sendStatus(200);
    }

    /*
    MISSED CLASS
    */

    if (
      text.includes("missed class") ||
      text.includes("missed session") ||
      text.includes("couldn't attend") ||
      text.includes("not attended")
    ) {

      const reply =
`📚 No problem 😊

The recorded class session will be available inside your lesson plan in TapTap LMS.`;

      rememberMessage(
        from,
        "assistant",
        reply
      );

      await sendMessage(
        from,
        reply
      );

      return res.sendStatus(200);
    }

    /*
    LIVE CLASS QUERY
    */

    if (
      text.includes("live class") ||
      text.includes("zoom link") ||
      text.includes("class link") ||
      text.includes("where class")
    ) {

      const reply =
`🎥 Live classes are conducted through Zoom.

📅 Weekly schedules are shared every Sunday in your official WhatsApp group.

🔗 Zoom links are shared directly in the WhatsApp group before every session starts.

📚 Recorded sessions will later be available inside TapTap LMS lesson plans.`;

      rememberMessage(
        from,
        "assistant",
        reply
      );

      await sendMessage(
        from,
        reply
      );

      return res.sendStatus(200);
    }

    /*
    ====================================
    COLLECT ESCALATION DETAILS
    ====================================
    */

    if (
      [
        "collect_login_details",
        "collect_domain_change_details",
        "collect_exam_issue",
        "collect_payment_issue"
      ].includes(userStates[from])
    ) {

      const reply =
        collectEscalationDetails(
          from,
          userStates[from],
          text
        );

      await sendMessage(
        from,
        reply
      );

      return res.sendStatus(200);
    }

    /*
    ====================================
    AI INTENT DETECTION
    ====================================
    */

    const detectedIntent =
      await detectIntent(text);

    console.log(
      "Detected Intent:",
      detectedIntent
    );

    /*
    ====================================
    ESCALATION FLOWS
    ====================================
    */

    if (
      ESCALATION_FLOWS[
        detectedIntent
      ]
    ) {

      const reply =
        startEscalation(
          from,
          detectedIntent
        );

      await sendMessage(
        from,
        reply
      );

      return res.sendStatus(200);
    }

    /*
    ====================================
    LESSON PLAN HANDLING
    ====================================
    */

    if (
      detectedIntent ===
      INTENTS.LESSON_PLAN
    ) {

      const reply =
        getLessonPlanReply(text);

      rememberMessage(
        from,
        "assistant",
        reply
      );

      await sendMessage(
        from,
        reply
      );

      return res.sendStatus(200);
    }

    /*
    ====================================
    AI REPLY
    ====================================
    */

    const aiReply =
      await generateAiReply(
        from,
        text,
        detectedIntent
      );

    console.log(
      "AI:",
      aiReply
    );

    rememberMessage(
      from,
      "assistant",
      aiReply
    );

    await sendMessage(
      from,
      aiReply
    );

    console.log(
      "Reply Sent ✅"
    );

    return res.sendStatus(200);

  } catch (error) {

    console.log(error);

    return res.sendStatus(500);
  }
});

app.listen(3000, () => {

  console.log(
    "🚀 AI Server running on port 3000"
  );
});