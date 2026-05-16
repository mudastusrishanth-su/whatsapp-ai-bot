require("dotenv").config();

const express = require("express");
const Groq = require("groq-sdk");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

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

  const VERIFY_TOKEN =
    process.env.VERIFY_TOKEN;

  const mode =
    req.query["hub.mode"];

  const token =
    req.query["hub.verify_token"];

  const challenge =
    req.query["hub.challenge"];

  if (
    mode &&
    token === VERIFY_TOKEN
  ) {

    console.log("Webhook Verified");

    res.status(200).send(challenge);

  } else {

    res.sendStatus(403);
  }
});

/*
====================================
MAIN WEBHOOK
====================================
*/

app.post("/webhook", async (req, res) => {

  try {

    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (
      message &&
      (
        message.type === "text" ||
        message.type === "image"
      ) &&
      !message.from_me
    ) {

      const from = message.from;

      /*
      ====================================
      SAFE TEXT HANDLING
      ====================================
      */

      let text = "";

      if (
        message.type === "text" &&
        message.text &&
        message.text.body
      ) {

        text =
          message.text.body
          .toLowerCase()
          .trim();

      } else if (
        message.type === "image"
      ) {

        text = "image uploaded";
      }

      console.log("Student:", text);

      /*
      ====================================
      RESET CHAT
      ====================================
      */

      if (text === "reset") {

        sessions[from] = [];
        userSessions[from] = null;
        escalationData[from] = null;

        await sendMessage(
          from,
          "✅ Your chat session has been reset.\n\nSend *Hi* to start again."
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      HANDLE IMAGE ESCALATION
      ====================================
      */

      if (
        message.type === "image" &&
        userSessions[from] ===
          "waiting_for_screenshot"
      ) {

        const teamNumber =
          process.env.TEAM_WHATSAPP_NUMBER;

        const issueData =
          escalationData[from];

        const escalationMessage =

`🚨 STUDENT ISSUE ESCALATION

👤 Student Details:
${issueData.details}

⚠️ Issue:
${issueData.issue}

📸 Screenshot proof submitted by student.

Please check and assist the student.`;

        await sendMessage(
          teamNumber,
          escalationMessage
        );

        await sendMessage(
          from,

`✅ Your issue has been escalated successfully along with screenshot proof.

Our support team will contact you shortly 😊`
        );

        delete escalationData[from];

        userSessions[from] = null;

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

      sessions[from].push({
        role: "user",
        content: text
      });

      /*
      ====================================
      MAIN MENU
      ====================================
      */

      if (
        text === "hi" ||
        text === "hello" ||
        text === "hey"
      ) {

        userSessions[from] = "main_menu";

        await sendMessage(
          from,

`👋 Welcome to Blackbucks Internship Support

Please choose an option:

1️⃣ Internship Registration
2️⃣ TapTap Website Support
3️⃣ Offer Letter Query
4️⃣ Internship Details
5️⃣ Payment Issue
6️⃣ Certificate Query

Type your issue anytime if you need support 😊`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      ISSUE DETECTION
      ====================================
      */

      const issueKeywords = [
        "payment",
        "login",
        "dashboard",
        "certificate",
        "offer letter",
        "portal",
        "not working",
        "issue",
        "problem",
        "error",
        "pay now",
        "unable",
        "failed",
        "lms",
        "tap tap",
        "taptap"
      ];

      const hasIssue =
        issueKeywords.some(keyword =>
          text.includes(keyword)
        );

      /*
      ====================================
      START ESCALATION FLOW
      ====================================
      */

      if (
        hasIssue &&
        userSessions[from] !==
          "collect_issue_details" &&
        userSessions[from] !==
          "waiting_for_screenshot"
      ) {

        userSessions[from] =
          "collect_issue_details";

        escalationData[from] = {
          issue: text
        };

        await sendMessage(
          from,

`✅ Please don’t worry 😊

The registration/payment website and TapTap LMS are different platforms.

• Registration website → internship registration & payment
• TapTap LMS → classes, lesson plans, assessments, assignments, activities

Sometimes the registration dashboard may still show "Pay Now" even after successful payment. This is normal in many cases.

📌 Please share:

1️⃣ Full Name
2️⃣ College Name
3️⃣ Registered Email ID
4️⃣ Roll Number
5️⃣ Registered Phone Number

📸 Also upload:
• Screenshot
OR
• Screen recording of the issue

This helps our support team resolve your issue faster.`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      COLLECT DETAILS
      ====================================
      */

      if (
        userSessions[from] ===
        "collect_issue_details"
      ) {

        escalationData[from].details =
          text;

        userSessions[from] =
          "waiting_for_screenshot";

        await sendMessage(
          from,

`📸 Thank you.

Now please upload:
• screenshot
OR
• screen recording of the issue 😊`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      GROQ AI RESPONSE
      ====================================
      */

      const completion =
        await groq.chat.completions.create({

          messages: [

            {
              role: "system",

              content: `
You are Blackbucks AI Internship Support Assistant.

You ONLY help students regarding:
- internship support
- TapTap LMS
- payments
- offer letters
- lesson plans
- assessments
- certificates
- internship classes

=========================================
IMPORTANT INFORMATION
=========================================

1. Dashboard showing "Pay Now" can be normal.

The registration website is mainly for:
- internship registration
- internship payment

After payment:
- classes
- lesson plans
- assessments
- assignments
- internship activities

are handled through:
- TapTap LMS
- official WhatsApp groups

2. Classes happen Monday to Saturday.

3. No classes on Sunday.

4. Assignment links and timings are shared in WhatsApp groups.

5. Each domain has separate lesson plans.

6. Share lesson plan links ONLY if:
- student completed payment
AND
- student received offer letter.

7. If students face login issues:
collect:
- roll number
- email
- phone number
- screenshot proof

Then support team will handle it.

=========================================
TAPTAP LMS
=========================================

https://taptap.blackbucks.me

=========================================
LESSON PLANS
=========================================

Quantum Systems Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80081&testType=collegeLessonPlan

Data Platform Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80082&testType=collegeLessonPlan

Generative AI Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80074&testType=collegeLessonPlan

AI Machine Learning Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80073&testType=collegeLessonPlan

Java Full Stack Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80086&testType=collegeLessonPlan

MERN Stack Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80087&testType=collegeLessonPlan

Cloud Infrastructure & DevOps Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80077&testType=collegeLessonPlan

Cyber Defense & Security Analyst:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80075&testType=collegeLessonPlan

Embedded & IoT Systems Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80078&testType=collegeLessonPlan

Semiconductor Design Engineer (VLSI):
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80083&testType=collegeLessonPlan

Python Automation Developer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80076&testType=collegeLessonPlan

Mobile Software Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80085&testType=collegeLessonPlan

Product UI/UX Designer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80080&testType=collegeLessonPlan

Data & Business Intelligence Analyst:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80079&testType=collegeLessonPlan

Associate Product Manager:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80084&testType=collegeLessonPlan

Growth Marketing & CRM Specialist:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80088&testType=collegeLessonPlan

=========================================
AI BEHAVIOR
=========================================

- Reply professionally
- Use friendly tone
- Use emojis naturally
- Keep replies short
- Understand Telugu and English
- Avoid robotic replies
- Never generate fake information
- If unclear ask student politely
`
            },

            ...sessions[from]
          ],

          model: "llama-3.1-8b-instant",
        });

      /*
      ====================================
      AI REPLY
      ====================================
      */

      const aiReply =
        completion.choices[0]
        .message.content;

      console.log("AI:", aiReply);

      /*
      ====================================
      STORE AI REPLY
      ====================================
      */

      sessions[from].push({
        role: "assistant",
        content: aiReply
      });

      /*
      ====================================
      LIMIT MEMORY
      ====================================
      */

      if (sessions[from].length > 10) {

        sessions[from] =
          sessions[from].slice(-10);
      }

      /*
      ====================================
      SEND AI REPLY
      ====================================
      */

      await sendMessage(
        from,
        aiReply
      );

      console.log("Reply Sent ✅");
    }

    res.sendStatus(200);

  } catch (error) {

    console.log(error);

    res.sendStatus(500);
  }
});

/*
====================================
START SERVER
====================================
*/

app.listen(3000, () => {

  console.log(
    "🚀 AI Server running on port 3000"
  );
});