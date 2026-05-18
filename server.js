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

  const clean =
    text.toLowerCase().trim();

  const greetings = [
    "hi",
    "hello",
    "hey",
    "hlo",
    "good morning",
    "good afternoon",
    "good evening",
  ];

  return greetings.includes(clean);
}

/*
====================================
MEMORY
====================================
*/

function rememberMessage(
  from,
  role,
  content
) {

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

async function sendMessage(
  to,
  message
) {

  const response = await fetch(
    `https://graph.facebook.com/v25.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        Authorization:
          `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },

      body: JSON.stringify({
        messaging_product:
          "whatsapp",

        to,

        text: {
          body: message,
        },
      }),
    }
  );

  const data =
    await response.json();

  console.log(data);
}

/*
====================================
INTENT DETECTION
====================================
*/

async function detectIntent(
  text
) {

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
    text.includes("switch domain")
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
    text.includes("offer letter") ||
    text.includes("payment")
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

function startEscalation(
  from,
  intent
) {

  if (
    intent ===
    INTENTS.LOGIN_ISSUE
  ) {

    userStates[from] =
      "collect_login_details";

    escalationData[from] = {
      issue:
        "TapTap Login Issue",
    };

    return `🔐 Please share:

1️⃣ Full Name
2️⃣ Registered Email ID
3️⃣ Mobile Number
4️⃣ Roll Number

📸 Also upload:
• screenshot
OR
• screen recording of the issue 😊`;
  }

  if (
    intent ===
    INTENTS.DOMAIN_CHANGE
  ) {

    userStates[from] =
      "collect_domain_change_details";

    escalationData[from] = {
      issue:
        "Domain Change Request",
    };

    return `📋 Please share:

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

  if (
    intent ===
    INTENTS.EXAM_ISSUE
  ) {

    userStates[from] =
      "collect_exam_issue";

    escalationData[from] = {
      issue:
        "Exam / Hackathon Issue",
    };

    return `📝 Please share:

1️⃣ Registered Email ID
2️⃣ Exam/Test Link
3️⃣ Screenshot of the issue

Our support team will assist you shortly 😊`;
  }

  if (
    intent ===
    INTENTS.PAYMENT_ISSUE
  ) {

    userStates[from] =
      "waiting_payment_confirmation";

    return `📩 Please don’t worry 😊

Offer letters are usually shared within 24-48 working hours after payment verification.

Please check:
• Spam folder
• Promotions tab
• All Mail section

If you still have not received it after 48 working hours, reply:

"still not received" 😊`;
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

Please upload the screenshot/proof related to your issue 😊`;
}

/*
====================================
SCREENSHOT HANDLING
====================================
*/

async function handleScreenshotEscalation(
  from,
  imageId
) {

  await sendMessage(
    from,

`✅ Your issue has been escalated successfully with screenshot proof.

Our support team will contact you shortly 😊`
  );

  resetUser(from);
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

Reply naturally like a friendly human support executive.

Keep replies:
- short
- WhatsApp style
- natural
- helpful
- conversational

Never generate fake information.

IMPORTANT INFORMATION:

• internships.blackbucks.me is only for registration & payment
• taptap.blackbucks.me is the LMS dashboard
• Live classes happen on Zoom
• Weekly schedules are shared every Sunday
• Zoom links shared in WhatsApp groups
• Recorded sessions available in lesson plans
• Lesson plans contain:
  - recordings
  - assignments
  - assessments
  - activities
  - study materials

REAL SUPPORT EXAMPLES:

Student:
I missed class

Assistant:
No problem 😊

The recorded class session will be available inside your lesson plan in TapTap LMS.

Student:
Where are live classes conducted?

Assistant:
🎥 Live classes are conducted through Zoom.

📅 Weekly schedules are shared every Sunday in your official WhatsApp group.

🔗 Zoom links are shared directly in the WhatsApp group before every session starts.

Student:
There is no login option

Assistant:
😊 internships.blackbucks.me is only the registration & payment website.

Your learning dashboard is:

🔗 taptap.blackbucks.me

Student:
Will there be projects involved?

Assistant:
Yes 😊

Students will work on assignments, assessments, activities and domain-related practical tasks during the internship.
`;

  const history =
    sessions[from] || [];

  const completion =
    await groq.chat.completions.create({

      model:
        "llama-3.3-70b-versatile",

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
    token ===
      process.env.VERIFY_TOKEN
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
MAIN WEBHOOK
====================================
*/

app.post(
  "/webhook",
  async (req, res) => {

    try {

      const message =
        req.body.entry?.[0]
          ?.changes?.[0]
          ?.value?.messages?.[0];

      if (
        !message ||
        message.from_me
      ) {
        return res.sendStatus(200);
      }

      const from =
        message.from;

      /*
      IMAGE
      */

      if (
        message.type === "image"
      ) {

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

      if (
        isGreeting(text)
      ) {

        await sendMessage(
          from,

`👋 Hi! I'm the Blackbucks AI Support Assistant 😊

Please tell me your issue or question and I’ll help you.`
        );

        return res.sendStatus(200);
      }

      /*
      REGISTRATION WEBSITE CONFUSION
      */

      if (
        text.includes(
          "no login option"
        ) ||
        text.includes(
          "only register"
        ) ||
        text.includes(
          "where is login"
        ) ||
        text.includes(
          "cannot find login"
        )
      ) {

        const reply =
`😊 Please don’t worry.

internships.blackbucks.me is only the internship registration & payment website.

Your student learning dashboard is available at:

🔗 taptap.blackbucks.me`;

        await sendMessage(
          from,
          reply
        );

        return res.sendStatus(200);
      }

      /*
      PAYMENT FOLLOW-UP
      */

      if (
        userStates[from] ===
        "waiting_payment_confirmation"
      ) {

        if (
          text.includes(
            "still not received"
          ) ||
          text.includes(
            "not received"
          )
        ) {

          userStates[from] =
            "collect_payment_issue";

          escalationData[from] =
            {
              issue:
                "Offer Letter / Payment Verification Issue",
            };

          await sendMessage(
            from,

`📩 Please share:

1️⃣ Registered Email ID
2️⃣ Payment Screenshot
3️⃣ Payment Date & Time

Our support team will verify and assist you 😊`
          );

          return res.sendStatus(200);
        }
      }

      /*
      SMALL TALK
      */

      if (
        text.includes(
          "how are you"
        )
      ) {

        await sendMessage(
          from,

`😊 I'm doing great and ready to help you.

Please tell me your internship-related query 😊`
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
      COLLECT DETAILS
      */

      if (
        [
          "collect_login_details",
          "collect_domain_change_details",
          "collect_exam_issue",
          "collect_payment_issue",
        ].includes(
          userStates[from]
        )
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
        await detectIntent(
          text
        );

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
      AI FALLBACK
      */

      const aiReply =
        await generateAiReply(
          from,
          text,
          detectedIntent
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

      return res.sendStatus(200);

    } catch (error) {

      console.log(error);

      return res.sendStatus(500);
    }
  }
);

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