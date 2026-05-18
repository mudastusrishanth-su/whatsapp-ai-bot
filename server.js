require("dotenv").config();

const express = require("express");
const Groq = require("groq-sdk");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

app.use(express.json());

/*
====================================
GLOBAL MEMORY
====================================
*/

const userStates = {};
const escalationData = {};
const sessions = {};

/*
====================================
GROQ
====================================
*/

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/*
====================================
INTENTS
====================================
*/

const INTENTS = {
  LOGIN_ISSUE: "LOGIN_ISSUE",
  DOMAIN_CHANGE: "DOMAIN_CHANGE",
  EXAM_ISSUE: "EXAM_ISSUE",
  PAYMENT_ISSUE: "PAYMENT_ISSUE",
  LESSON_PLAN: "LESSON_PLAN",
  GENERAL: "GENERAL",
};

/*
====================================
ESCALATION FLOWS
====================================
*/

const ESCALATION_FLOWS = {
  LOGIN_ISSUE: "collect_login_details",
  DOMAIN_CHANGE: "collect_domain_change_details",
  EXAM_ISSUE: "collect_exam_issue",
  PAYMENT_ISSUE: "collect_payment_issue",
};

/*
====================================
RESET USER
====================================
*/

function resetUser(from) {
  delete userStates[from];
  delete escalationData[from];
  delete sessions[from];
}

/*
====================================
GREETING CHECK
====================================
*/

function isGreeting(text) {
  const greetings = [
    "hi",
    "hello",
    "hlo",
    "hey",
    "good morning",
    "good afternoon",
    "good evening",
  ];

  return greetings.some((g) => text.includes(g));
}

/*
====================================
MEMORY
====================================
*/

function rememberMessage(from, role, content) {
  if (!sessions[from]) {
    sessions[from] = [];
  }

  sessions[from].push({
    role,
    content,
  });

  sessions[from] =
    sessions[from].slice(-20);
}

/*
====================================
SEND MESSAGE
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
        to,
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
DETECT INTENT
====================================
*/

async function detectIntent(text) {

  if (
    text.includes("login") ||
    text.includes("cannot login") ||
    text.includes("can't login")
  ) {
    return INTENTS.LOGIN_ISSUE;
  }

  if (
    text.includes("domain change") ||
    text.includes("change domain") ||
    text.includes("switch domain") ||
    text.includes("change specialization")
  ) {
    return INTENTS.DOMAIN_CHANGE;
  }

  if (
    text.includes("exam") ||
    text.includes("hackathon") ||
    text.includes("test link")
  ) {
    return INTENTS.EXAM_ISSUE;
  }

  if (
    text.includes("payment") ||
    text.includes("offer letter") ||
    text.includes("paid")
  ) {
    return INTENTS.PAYMENT_ISSUE;
  }

  if (
    text.includes("lesson plan")
  ) {
    return INTENTS.LESSON_PLAN;
  }

  return INTENTS.GENERAL;
}

/*
====================================
START ESCALATION
====================================
*/

function startEscalation(from, intent) {

  if (intent === INTENTS.LOGIN_ISSUE) {

    userStates[from] =
      "collect_login_details";

    escalationData[from] = {
      issue: "Login Issue",
    };

    return `🔐 Please share the following details:

1️⃣ Full Name
2️⃣ Registered Email ID
3️⃣ Registered Mobile Number
4️⃣ Roll Number

📸 Also upload:
• screenshot
OR
• screen recording of the issue 😊`;
  }

  if (intent === INTENTS.DOMAIN_CHANGE) {

    userStates[from] =
      "collect_domain_change_details";

    escalationData[from] = {
      issue: "Domain Change Request",
    };

    return `📋 Please share the following details:

1️⃣ Full Name
2️⃣ Registered Email ID
3️⃣ Registered Mobile Number
4️⃣ Existing Domain
5️⃣ New Domain Requested

📸 Also upload:
• payment screenshot
OR
• offer letter screenshot 😊`;
  }

  if (intent === INTENTS.EXAM_ISSUE) {

    userStates[from] =
      "collect_exam_issue";

    escalationData[from] = {
      issue: "Exam / Test Issue",
    };

    return `📝 Please share:

1️⃣ Your Registered Email ID
2️⃣ Exam/Test Link
3️⃣ Screenshot of the issue

Our support team will assist you shortly 😊`;
  }

  if (intent === INTENTS.PAYMENT_ISSUE) {

    userStates[from] =
      "collect_payment_issue";

    escalationData[from] = {
      issue: "Payment Verification Issue",
    };

    return `💳 Please share:

1️⃣ Registered Email ID
2️⃣ Payment Screenshot
3️⃣ Payment Date & Time

Our support team will verify and assist you 😊`;
  }

  return null;
}

/*
====================================
COLLECT DETAILS
====================================
*/

function collectEscalationDetails(
  from,
  state,
  text
) {

  escalationData[from].details =
    text;

  userStates[from] =
    "waiting_for_screenshot";

  return `📸 Thank you for sharing the details.

Now please upload the screenshot/proof related to your issue 😊`;
}

/*
====================================
SCREENSHOT ESCALATION
====================================
*/

async function handleScreenshotEscalation(
  from,
  imageId
) {

  await sendMessage(
    from,

`✅ Your issue has been escalated successfully along with screenshot proof.

Our support team will contact you shortly 😊`
  );

  resetUser(from);
}

/*
====================================
LESSON PLAN
====================================
*/

function getLessonPlanReply(text) {

  return `📚 Lesson plans inside TapTap LMS contain:

• recorded sessions
• assignments
• assessments
• activities
• study materials

Please check your lesson plan section 😊`;
}

/*
====================================
AI REPLY
====================================
*/

async function generateAiReply(
  from,
  text,
  intent
) {

  const systemPrompt = `
You are Blackbucks AI Support Assistant.

Reply like a friendly human support executive.

Keep replies:
- short
- natural
- WhatsApp style
- clear
- helpful

Never generate fake information.

LIVE CLASSES:
- conducted through Zoom
- schedules shared every Sunday in WhatsApp groups
- Zoom links shared in WhatsApp groups
- recordings available in TapTap LMS lesson plans

If student missed class:
say recordings available in lesson plans.

REAL SUPPORT EXAMPLES:

Student:
I paid but no offer letter

Assistant:
Please don’t worry 😊

Offer letters are usually shared within 24-48 working hours after payment verification.

Please share:
• Registered Email ID
• Payment Screenshot

Student:
I missed class

Assistant:
No problem 😊

The recorded class session will be available inside your lesson plan in TapTap LMS.

Student:
Where will we get live classes?

Assistant:
🎥 Live classes are conducted through Zoom.

📅 Weekly schedules are shared every Sunday in your official WhatsApp group.

🔗 Zoom links are shared directly in the WhatsApp group before every session starts.

Student:
I cannot find resources

Assistant:
Please check your lesson plan inside TapTap LMS 😊

All resources will be available there.
`;

  const history =
    sessions[from] || [];

  const completion =
    await groq.chat.completions.create({
      model: "llama3-70b-8192",

      messages: [
        {
          role: "system",
          content: systemPrompt,
        },

        ...history,

        {
          role: "user",
          content: text,
        },
      ],

      temperature: 0.5,
    });

  return completion.choices[0]
    .message.content;
}

/*
====================================
HOME
====================================
*/

app.get("/", (req, res) => {
  res.send(
    "Blackbucks AI Bot Running 🚀"
  );
});

/*
====================================
VERIFY WEBHOOK
====================================
*/

app.get("/webhook", (req, res) => {

  const mode =
    req.query["hub.mode"];

  const token =
    req.query["hub.verify_token"];

  const challenge =
    req.query["hub.challenge"];

  if (
    mode &&
    token === process.env.VERIFY_TOKEN
  ) {

    console.log(
      "Webhook Verified"
    );

    return res
      .status(200)
      .send(challenge);
  }

  return res.sendStatus(403);
});

/*
====================================
WEBHOOK
====================================
*/

app.post("/webhook", async (req, res) => {

  try {

    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (
      !message ||
      message.from_me
    ) {
      return res.sendStatus(200);
    }

    const from = message.from;

    /*
    IMAGE
    */

    if (message.type === "image") {

      if (
        userStates[from] ===
        "waiting_for_screenshot"
      ) {

        await handleScreenshotEscalation(
          from,
          message.image.id
        );
      }

      return res.sendStatus(200);
    }

    /*
    ONLY TEXT
    */

    if (
      message.type !== "text"
    ) {
      return res.sendStatus(200);
    }

    const text =
      message.text.body
        .toLowerCase()
        .trim();

    console.log(
      "Student:",
      text
    );

    /*
    RESET
    */

    if (
      text === "reset" ||
      text === "restart"
    ) {

      resetUser(from);

      await sendMessage(
        from,

`✅ Chat reset successful.

Send Hi to start again 😊`
      );

      return res.sendStatus(200);
    }

    /*
    GREETING
    */

    if (isGreeting(text)) {

      await sendMessage(
        from,

`👋 Hi! I'm the Blackbucks AI Support Assistant 😊

Please tell me your issue or question and I’ll help you.`
      );

      return res.sendStatus(200);
    }

    /*
    MEMORY
    */

    rememberMessage(
      from,
      "user",
      text
    );

    /*
    QUICK REPLIES
    */

    if (
      text.includes("missed class")
    ) {

      const reply =
`📚 No problem 😊

The recorded class session will be available inside your lesson plan in TapTap LMS.`;

      await sendMessage(
        from,
        reply
      );

      return res.sendStatus(200);
    }

    if (
      text.includes("live class") ||
      text.includes("zoom link")
    ) {

      const reply =
`🎥 Live classes are conducted through Zoom.

📅 Weekly schedules are shared every Sunday in your official WhatsApp group.

🔗 Zoom links are shared directly in the WhatsApp group before every session starts.`;

      await sendMessage(
        from,
        reply
      );

      return res.sendStatus(200);
    }

    /*
    COLLECT DETAILS
    */

    if (
      [
        "collect_login_details",
        "collect_domain_change_details",
        "collect_exam_issue",
        "collect_payment_issue",
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
    DETECT INTENT
    */

    const detectedIntent =
      await detectIntent(text);

    console.log(
      "Detected Intent:",
      detectedIntent
    );

    /*
    ESCALATION
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
    LESSON PLAN
    */

    if (
      detectedIntent ===
      INTENTS.LESSON_PLAN
    ) {

      const reply =
        getLessonPlanReply(text);

      await sendMessage(
        from,
        reply
      );

      return res.sendStatus(200);
    }

    /*
    AI
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

/*
====================================
SERVER
====================================
*/

app.listen(3000, () => {

  console.log(
    "🚀 AI Server running on port 3000"
  );
});